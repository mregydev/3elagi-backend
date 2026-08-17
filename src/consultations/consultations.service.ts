import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConsultationComplaint } from '../entities/consultation-complaint.entity';
import {
  Consultation,
  ConsultationCancelReasonType,
} from '../entities/consultation.entity';
import {
  ConsultationActionMeta,
  ConsultationActionType,
  ConsultationDiagnosisSummary,
  Message,
} from '../entities/message.entity';
import { Doctor } from '../entities/doctor.entity';
import { User, UserRole } from '../entities/user.entity';
import { KnowledgeIndexerService } from '../ai/knowledge-indexer.service';
import { DoctorPatientAccessService } from '../doctor-patient-access/doctor-patient-access.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { PointsService } from '../points/points.service';
import { PointPricingService } from '../points/point-pricing.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { DiagnosisService } from '../diagnosis/diagnosis.service';
import { UsersService } from '../users/users.service';
import {
  clampConsultationPrice,
  CONSULTATION_POINT_COST,
} from '../points/message-price.constants';
import { DocumentType } from '../entities/medical-document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import {
  CancelConsultationDto,
  EndConsultationDto,
  StartConsultationDto,
} from './dto/consultation.dto';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private consultationRepo: Repository<Consultation>,
    @InjectRepository(ConsultationComplaint)
    private complaintRepo: Repository<ConsultationComplaint>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private points: PointsService,
    private pointPricing: PointPricingService,
    private presence: PresenceGateway,
    private diagnosis: DiagnosisService,
    private users: UsersService,
    private knowledgeIndexer: KnowledgeIndexerService,
    private doctorPatientAccess: DoctorPatientAccessService,
    private pushNotifications: PushNotificationsService,
  ) {}

  private scheduleIndexConsultation(consultationId: string): void {
    void this.knowledgeIndexer
      .indexConsultation(consultationId)
      .catch(() => undefined);
  }

  private mapMessage(row: Message) {
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      creator: row.creator,
      recipient: row.recipient,
      datetime: row.datetime,
      attachment_url: row.attachment_url,
      attachment_meta: row.attachment_meta,
      read_at: row.read_at,
      edited_at: row.edited_at,
    };
  }

  /** Post a consultation_action chat message from `creator` to `recipient` and push it live. */
  private async postActionMessage(
    creator: string,
    recipient: string,
    content: string,
    meta: ConsultationActionMeta,
    opts?: { alwaysPush?: boolean; notifyBody?: string },
  ) {
    const created = this.messageRepo.create({
      type: 'consultation_action',
      content,
      creator,
      recipient,
      attachment_url: null,
      attachment_meta: meta,
    });
    const saved = await this.messageRepo.save(created);
    const mapped = this.mapMessage(saved);
    this.presence.emitToUser(recipient, 'message:new', {
      message: mapped,
      peer_id: creator,
    });
    this.presence.emitToUser(creator, 'message:new', {
      message: mapped,
      peer_id: recipient,
    });

    // Socket only reaches an open app. This also files the in-app notification
    // and pushes to the device when the recipient is away.
    void this.notifyRecipient(
      creator,
      recipient,
      mapped.id,
      opts?.notifyBody ?? content,
      opts,
    ).catch(() => undefined);

    return mapped;
  }

  private async notifyRecipient(
    senderId: string,
    recipientId: string,
    messageId: string,
    body: string,
    opts?: { alwaysPush?: boolean },
  ): Promise<void> {
    if (senderId === recipientId) return;
    const senderName = await this.users.getDisplayName(senderId);
    await this.pushNotifications.sendChatMessage(
      {
        recipientId,
        chatId: senderId,
        messageId,
        senderId,
        senderName,
        body,
      },
      opts,
    );
  }

  private mapConsultation(c: Consultation) {
    return {
      id: c.id,
      patient_id: c.patient_id,
      doctor_id: c.doctor_id,
      status: c.status,
      description: c.description,
      reserved_points: c.reserved_points,
      patient_country: c.patient_country,
      // numeric comes back from pg as a string.
      point_price_usd:
        c.point_price_usd === null ? null : Number(c.point_price_usd),
      doctor_note: c.doctor_note,
      diagnosis_id: c.diagnosis_id,
      cancel_reason_type: c.cancel_reason_type,
      cancel_reason: c.cancel_reason,
      created_at: c.created_at,
      closed_at: c.closed_at,
    };
  }

  /** True when an open consultation exists between the two users. */
  async hasOpenBetween(userA: string, userB: string): Promise<boolean> {
    const count = await this.consultationRepo
      .createQueryBuilder('c')
      .where('c.status = :open', { open: 'open' })
      .andWhere(
        '((c.patient_id = :a AND c.doctor_id = :b) OR (c.patient_id = :b AND c.doctor_id = :a))',
        { a: userA, b: userB },
      )
      .getCount();
    return count > 0;
  }

  /**
   * Opens a consultation for a call the doctor just answered, unless one is
   * already live. Without this, messaging (and record sharing) stays blocked
   * during a video consultation — the message gate requires an open one.
   */
  async ensureOpenForVideoCall(
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    if (await this.hasOpenBetween(doctorUserId, patientUserId)) return;

    const consultation = this.consultationRepo.create({
      patient_id: patientUserId,
      doctor_id: doctorUserId,
      status: 'open',
      description: 'Video consultation',
      // Video calls are free for now; the doctor collects the fee directly.
      reserved_points: 0,
    });
    const saved = await this.consultationRepo.save(consultation);

    await this.postActionMessage(
      doctorUserId,
      patientUserId,
      'Video consultation started — you can message now',
      {
        consultation_id: saved.id,
        action: 'accept',
        status: 'open',
      },
    );
  }

  /**
   * Opens (or accepts) a consultation when a doctor confirms an appointment.
   * Chat messaging is gated on an open consultation, so the thread must go
   * live as soon as the slot is approved — same as an answered video call.
   */
  async ensureOpenForConfirmedAppointment(
    doctorUserId: string,
    patientUserId: string,
    description?: string | null,
  ): Promise<void> {
    if (await this.hasOpenBetween(doctorUserId, patientUserId)) return;

    const pending = await this.consultationRepo.findOne({
      where: {
        doctor_id: doctorUserId,
        patient_id: patientUserId,
        status: 'pending',
      },
      order: { created_at: 'DESC' },
    });
    if (pending) {
      await this.accept(doctorUserId, pending.id);
      return;
    }

    const trimmedDescription = description?.trim() || 'Appointment consultation';
    const consultation = this.consultationRepo.create({
      patient_id: patientUserId,
      doctor_id: doctorUserId,
      status: 'open',
      description: trimmedDescription,
      reserved_points: 0,
    });
    const saved = await this.consultationRepo.save(consultation);

    await this.postActionMessage(
      doctorUserId,
      patientUserId,
      'Appointment confirmed — consultation is open, you can message now',
      {
        consultation_id: saved.id,
        action: 'accept',
        status: 'open',
      },
      { alwaysPush: true },
    );

    this.scheduleIndexConsultation(saved.id);
  }

  /** Open consultation between the given user and peer, if any. */
  /**
   * The live consultation between two users — pending counts as live, otherwise
   * the doctor never sees the request they are meant to accept or decline.
   * Pending is preferred so a fresh request wins over a stale open one.
   */
  async findActiveWithPeer(userId: string, peerId: string) {
    const rows = await this.consultationRepo
      .createQueryBuilder('c')
      .where('c.status IN (:...live)', { live: ['pending', 'open'] })
      .andWhere(
        '((c.patient_id = :userId AND c.doctor_id = :peerId) OR (c.patient_id = :peerId AND c.doctor_id = :userId))',
        { userId, peerId },
      )
      .orderBy(`CASE WHEN c.status = 'pending' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('c.created_at', 'DESC')
      .getOne();
    return rows ? this.mapConsultation(rows) : null;
  }

  /** All consultations for a doctor, newest first, with patient display names. */
  async listForDoctor(doctorUserId: string) {
    await this.assertRole(doctorUserId, UserRole.DOCTOR);
    const rows = await this.consultationRepo.find({
      where: { doctor_id: doctorUserId },
      order: { created_at: 'DESC' },
    });
    const names = await Promise.all(
      rows.map((r) => this.users.getDisplayName(r.patient_id)),
    );
    // Patient country drives what the consultation is worth to the doctor
    // (EG / JO / rest of world), so the app can price the list without a
    // second round trip per row. Rows created before the IP capture have no
    // country of their own — fall back to the patient's profile.
    const countries = await Promise.all(
      rows.map(async (r) => {
        if (r.patient_country) return r.patient_country;
        const profile = await this.patientProfileRepo.findOne({
          where: { user_id: r.patient_id },
        });
        return profile?.country ?? null;
      }),
    );
    const ids = rows.map((r) => r.id);
    const complaints = ids.length
      ? await this.complaintRepo.find({
          where: { consultation_id: In(ids) },
        })
      : [];
    const complaintByConsultation = new Map(
      complaints.map((c) => [c.consultation_id, c.status]),
    );
    return rows.map((c, i) => ({
      ...this.mapConsultation(c),
      patient_name: names[i],
      patient_country: countries[i],
      complaint_status: complaintByConsultation.get(c.id) ?? null,
    }));
  }

  /** All consultations for a patient, newest first, with doctor display names. */
  async listForPatient(patientUserId: string) {
    await this.assertRole(patientUserId, UserRole.PATIENT);
    const rows = await this.consultationRepo.find({
      where: { patient_id: patientUserId },
      order: { created_at: 'DESC' },
    });
    const names = await Promise.all(
      rows.map((r) => this.users.getDisplayName(r.doctor_id)),
    );
    return rows.map((c, i) => ({
      ...this.mapConsultation(c),
      doctor_name: names[i],
    }));
  }

  private async assertRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== role) {
      throw new ForbiddenException('Not allowed');
    }
    return user;
  }

  async start(
    patientUserId: string,
    dto: StartConsultationDto,
    patientCountry?: string | null,
  ) {
    await this.assertRole(patientUserId, UserRole.PATIENT);
    if (dto.doctor_id === patientUserId) {
      throw new BadRequestException('Invalid doctor');
    }
    const doctorUser = await this.userRepo.findOne({
      where: { id: dto.doctor_id },
    });
    if (!doctorUser || doctorUser.role !== UserRole.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: dto.doctor_id },
    });
    const price = clampConsultationPrice(doctor?.consultation_price ?? 10);

    const existing = await this.consultationRepo.findOne({
      where: [
        { patient_id: patientUserId, doctor_id: dto.doctor_id, status: 'open' },
        { patient_id: patientUserId, doctor_id: dto.doctor_id, status: 'pending' },
      ],
    });
    if (existing) {
      throw new BadRequestException(
        existing.status === 'pending'
          ? 'This doctor has not answered your previous request yet'
          : 'You already have an open consultation with this doctor',
      );
    }

    // Egypt / Jordan / rest of world, at the admin-set rate of the moment.
    // Resolved before reserving so a pricing failure cannot strand credits.
    const country = patientCountry?.trim().toUpperCase() || null;
    const pointPrice = (await this.pointPricing.resolve(country)).pricePerPoint;

    // Reserve first so an insufficient balance fails before we create anything.
    // Free for now — see CONSULTATION_POINT_COST.
    await this.points.reservePoints(patientUserId, CONSULTATION_POINT_COST);

    let saved: Consultation;
    try {
      const created = this.consultationRepo.create({
        patient_id: patientUserId,
        doctor_id: dto.doctor_id,
        // Awaits the doctor's answer; credits stay reserved meanwhile.
        status: 'pending',
        description: dto.description?.trim() ?? '',
        reserved_points: price,
        patient_country: country,
        point_price_usd: pointPrice.toFixed(2),
      });
      saved = await this.consultationRepo.save(created);
    } catch (e) {
      // Unique open-pair index race, etc. — give the points back.
      await this.points.refundReserved(patientUserId, price);
      throw new BadRequestException('Could not start consultation');
    }

    await this.postActionMessage(
      patientUserId,
      dto.doctor_id,
      saved.description || 'Consultation request',
      {
        consultation_id: saved.id,
        action: 'start',
        status: 'pending',
        reserved_points: price,
        patient_country: saved.patient_country,
      },
      // The doctor has to answer before anything happens, so this notifies like
      // an incoming call: presence can still list a backgrounded or stale socket
      // as online, and suppressing the push there left requests unanswered.
      {
        alwaysPush: true,
        notifyBody: saved.description?.trim()
          ? `New consultation request: ${saved.description.trim()}`
          : 'New consultation request',
      },
    );

    // Starting a consultation implies the doctor may view the patient's records.
    try {
      const accessStatus = await this.doctorPatientAccess.applyAccessAction(
        patientUserId,
        dto.doctor_id,
        'grant_records',
      );
      this.presence.emitToUser(dto.doctor_id, 'access:updated', {
        status: accessStatus,
        peer_id: patientUserId,
      });
      this.presence.emitToUser(patientUserId, 'access:updated', {
        status: accessStatus,
        peer_id: dto.doctor_id,
      });
    } catch {
      // Already granted or chat blocked — consultation still stands.
    }

    this.scheduleIndexConsultation(saved.id);

    const summary = await this.points.getSummary(patientUserId);
    return { consultation: this.mapConsultation(saved), points: summary };
  }

  private async loadOpenForDoctor(consultationId: string, doctorUserId: string) {
    await this.assertRole(doctorUserId, UserRole.DOCTOR);
    const c = await this.consultationRepo.findOne({
      where: { id: consultationId },
    });
    if (!c) throw new NotFoundException('Consultation not found');
    if (c.doctor_id !== doctorUserId) {
      throw new ForbiddenException('Not your consultation');
    }
    if (c.status !== 'open') {
      throw new BadRequestException('Consultation is not open');
    }
    return c;
  }

  private async loadPendingForDoctor(
    consultationId: string,
    doctorUserId: string,
  ): Promise<Consultation> {
    const c = await this.consultationRepo.findOne({
      where: { id: consultationId },
    });
    if (!c) throw new NotFoundException('Consultation not found');
    if (c.doctor_id !== doctorUserId) {
      throw new ForbiddenException('Not your consultation');
    }
    if (c.status !== 'pending') {
      throw new BadRequestException('This request has already been answered');
    }
    return c;
  }

  /** Doctor accepts a pending request — chat and credits go live. */
  async accept(doctorUserId: string, consultationId: string) {
    await this.assertRole(doctorUserId, UserRole.DOCTOR);
    const c = await this.loadPendingForDoctor(consultationId, doctorUserId);

    c.status = 'open';
    const saved = await this.consultationRepo.save(c);

    await this.postActionMessage(
      doctorUserId,
      c.patient_id,
      'Accepted your consultation request — you can message now',
      {
        consultation_id: saved.id,
        action: 'accept',
        status: 'open',
        reserved_points: saved.reserved_points,
      },
      { alwaysPush: true },
    );

    this.scheduleIndexConsultation(saved.id);
    return { consultation: this.mapConsultation(saved) };
  }

  /** Doctor declines — the patient's held credits go straight back. */
  async reject(doctorUserId: string, consultationId: string, reason?: string) {
    await this.assertRole(doctorUserId, UserRole.DOCTOR);
    const c = await this.loadPendingForDoctor(consultationId, doctorUserId);

    c.status = 'rejected';
    const held = c.reserved_points ?? 0;
    c.reserved_points = 0;
    const saved = await this.consultationRepo.save(c);

    if (held > 0) {
      // A failed refund must not strand the request in pending.
      await this.points
        .refundReserved(c.patient_id, held)
        .catch(() => undefined);
    }

    const declineBody =
      reason?.trim() ||
      (held > 0
        ? `Declined your consultation request — ${held} credits refunded`
        : 'Declined your consultation request');

    await this.postActionMessage(
      doctorUserId,
      c.patient_id,
      declineBody,
      {
        consultation_id: saved.id,
        action: 'reject',
        status: 'rejected',
        reserved_points: 0,
      },
      { alwaysPush: true },
    );

    return { consultation: this.mapConsultation(saved) };
  }

  async end(doctorUserId: string, consultationId: string, dto: EndConsultationDto) {
    const c = await this.loadOpenForDoctor(consultationId, doctorUserId);

    let diagnosisId: string | null = null;
    let diagnosisSummary: ConsultationDiagnosisSummary | null = null;
    const doctor = await this.doctorRepo.findOne({
      where: { user_id: doctorUserId },
    });

    const details = dto.diagnosis_details?.desc?.trim();
    const legacyDiagnosisText = dto.diagnosis?.trim();

    if (details && doctor) {
      const detailsDto = dto.diagnosis_details!;
      const created = await this.diagnosis.create(
        {
          desc: details,
          patient_id: c.patient_id,
          doctor_id: doctor.id,
          body_part: detailsDto.body_part,
          symptoms: detailsDto.symptoms,
          document_ids: detailsDto.document_ids,
          prescription_id: detailsDto.prescription_id,
          prescription: detailsDto.prescription,
          intake_exam_assignment_id: detailsDto.intake_exam_assignment_id,
          intake_exam: detailsDto.intake_exam,
        },
        doctorUserId,
        UserRole.DOCTOR,
      );
      diagnosisId = created.id;
      diagnosisSummary = this.mapDiagnosisSummary(created);
    } else if (legacyDiagnosisText && doctor) {
      const created = await this.diagnosis.create(
        {
          desc: legacyDiagnosisText,
          patient_id: c.patient_id,
          doctor_id: doctor.id,
          symptoms: [],
        },
        doctorUserId,
        UserRole.DOCTOR,
      );
      diagnosisId = created.id;
      diagnosisSummary = this.mapDiagnosisSummary(created);
    }

    // Completed work — the patient's reserved points are credited to the doctor.
    await this.points.settleReservedToDoctor(
      c.patient_id,
      c.doctor_id,
      c.reserved_points,
    );

    c.status = 'ended';
    c.doctor_note = dto.note?.trim() || null;
    c.diagnosis_id = diagnosisId;
    c.closed_at = new Date();
    const saved = await this.consultationRepo.save(c);

    await this.postActionMessage(
      doctorUserId,
      c.patient_id,
      saved.doctor_note || 'Consultation ended',
      {
        consultation_id: saved.id,
        action: 'end',
        status: 'ended',
        diagnosis_id: diagnosisId,
        diagnosis_summary: diagnosisSummary,
      },
    );

    this.scheduleIndexConsultation(saved.id);

    return { consultation: this.mapConsultation(saved) };
  }

  private mapDiagnosisSummary(created: {
    id: string;
    desc: string;
    symptoms?: { desc: string }[];
    documents?: { id: string; title: string; type: DocumentType }[];
  }): ConsultationDiagnosisSummary {
    return {
      id: created.id,
      desc: created.desc,
      symptoms: (created.symptoms ?? []).map((s) => ({ desc: s.desc })),
      linked_records: (created.documents ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title?.trim() || 'Medical record',
        record_type: doc.type === DocumentType.LAB ? 'lab' : 'xray',
      })),
    };
  }

  async cancel(
    doctorUserId: string,
    consultationId: string,
    dto: CancelConsultationDto,
  ) {
    const c = await this.loadOpenForDoctor(consultationId, doctorUserId);

    // Doctor couldn't complete it — patient gets the points back.
    await this.points.refundReserved(c.patient_id, c.reserved_points);

    const reasonType = dto.reason_type as ConsultationCancelReasonType;
    c.status = 'cancelled';
    c.cancel_reason_type = reasonType;
    c.cancel_reason = dto.reason?.trim() || null;
    c.closed_at = new Date();
    const saved = await this.consultationRepo.save(c);

    await this.postActionMessage(
      doctorUserId,
      c.patient_id,
      saved.cancel_reason || 'Consultation cancelled',
      {
        consultation_id: saved.id,
        action: 'cancel' as ConsultationActionType,
        status: 'cancelled',
        cancel_reason_type: reasonType,
        cancel_reason: saved.cancel_reason ?? undefined,
      },
    );

    this.scheduleIndexConsultation(saved.id);

    return { consultation: this.mapConsultation(saved) };
  }
}
