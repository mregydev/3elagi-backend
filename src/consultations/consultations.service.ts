import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { PointsService } from '../points/points.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { DiagnosisService } from '../diagnosis/diagnosis.service';
import { UsersService } from '../users/users.service';
import { clampConsultationPrice } from '../points/message-price.constants';
import { DocumentType } from '../entities/medical-document.entity';
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
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private points: PointsService,
    private presence: PresenceGateway,
    private diagnosis: DiagnosisService,
    private users: UsersService,
  ) {}

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
    return mapped;
  }

  private mapConsultation(c: Consultation) {
    return {
      id: c.id,
      patient_id: c.patient_id,
      doctor_id: c.doctor_id,
      status: c.status,
      description: c.description,
      reserved_points: c.reserved_points,
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

  /** Open consultation between the given user and peer, if any. */
  async findActiveWithPeer(userId: string, peerId: string) {
    const rows = await this.consultationRepo
      .createQueryBuilder('c')
      .where('c.status = :open', { open: 'open' })
      .andWhere(
        '((c.patient_id = :userId AND c.doctor_id = :peerId) OR (c.patient_id = :peerId AND c.doctor_id = :userId))',
        { userId, peerId },
      )
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
    return rows.map((c, i) => ({
      ...this.mapConsultation(c),
      patient_name: names[i],
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

  async start(patientUserId: string, dto: StartConsultationDto) {
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
      where: { patient_id: patientUserId, doctor_id: dto.doctor_id, status: 'open' },
    });
    if (existing) {
      throw new BadRequestException('You already have an open consultation with this doctor');
    }

    // Reserve first so an insufficient balance fails before we create anything.
    await this.points.reservePoints(patientUserId, price);

    let saved: Consultation;
    try {
      const created = this.consultationRepo.create({
        patient_id: patientUserId,
        doctor_id: dto.doctor_id,
        status: 'open',
        description: dto.description?.trim() ?? '',
        reserved_points: price,
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
        status: 'open',
        reserved_points: price,
      },
    );

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
      const created = await this.diagnosis.create(
        {
          desc: details,
          patient_id: c.patient_id,
          doctor_id: doctor.id,
          symptoms: dto.diagnosis_details?.symptoms,
          document_ids: dto.diagnosis_details?.document_ids,
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

    return { consultation: this.mapConsultation(saved) };
  }
}
