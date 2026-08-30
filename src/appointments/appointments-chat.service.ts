import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from '../entities/appointment.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import {
  AppointmentActionMeta,
  AppointmentActionType,
  Message,
} from '../entities/message.entity';
import { PresenceGateway } from '../presence/presence.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SchedulesService } from '../schedules/schedules.service';
import { UsersService } from '../users/users.service';
import { DailyService } from '../daily/daily.service';
import { VideoCallSession } from '../entities/video-call-session.entity';
import { PointsService } from '../points/points.service';
import { ConsultationsService } from '../consultations/consultations.service';
import { clampConsultationPrice } from '../points/message-price.constants';
import { resolveDoctorFee } from '../doctors/doctor-fees';
import { deleteAppointmentActionMessages } from './appointment-chat-messages';

const APPOINTMENT_ACTIONS: AppointmentActionType[] = [
  'request',
  'confirm',
  'reject',
  'cancel',
  'payment_request',
  'payment_submitted',
  'payment_approved',
  'payment_rejected',
  'reschedule_request',
  'reschedule_accepted',
  'reschedule_declined',
  'cancel_request',
  'cancel_approved',
  'cancel_declined',
];
const CAIRO_TIME_ZONE = 'Africa/Cairo';

function formatTimeLabel(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

function cairoNowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TIME_ZONE,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
    hour: Number.parseInt(lookup('hour') || '0', 10),
    minute: Number.parseInt(lookup('minute') || '0', 10),
    second: Number.parseInt(lookup('second') || '0', 10),
  };
}

function localDateYmd(date = new Date()): string {
  const { year, month, day } = cairoNowParts(date);
  return `${year}-${month}-${day}`;
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map((value) => Number.parseInt(value, 10));
  return hour * 60 + minute;
}

function cairoMinutesSinceMidnight(date = new Date()): number {
  const { hour, minute, second } = cairoNowParts(date);
  return hour * 60 + minute + second / 60;
}

function isAppointmentExpiredByMoreThanMinutes(
  dateStr: string,
  time: string | null,
  graceMinutes: number,
  now = new Date(),
): boolean {
  const today = localDateYmd(now);
  if (dateStr < today) return true;
  if (dateStr > today || !time) return false;
  return cairoMinutesSinceMidnight(now) - timeToMinutes(time) > graceMinutes;
}

function isFutureSlot(dateStr: string, time: string, now = new Date()): boolean {
  const today = localDateYmd(now);
  if (dateStr !== today) return dateStr > today;
  return timeToMinutes(time) > cairoMinutesSinceMidnight(now);
}

@Injectable()
export class AppointmentsChatService {
  private readonly logger = new Logger(AppointmentsChatService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(PatientProfile)
    private readonly profileRepo: Repository<PatientProfile>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(VideoCallSession)
    private readonly videoCallRepo: Repository<VideoCallSession>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    private readonly schedulesService: SchedulesService,
    private readonly usersService: UsersService,
    private readonly presenceGateway: PresenceGateway,
    private readonly pushNotifications: PushNotificationsService,
    private readonly dailyService: DailyService,
    private readonly pointsService: PointsService,
    private readonly consultationsService: ConsultationsService,
  ) {}

  private async releaseAppointmentCredits(
    appointment: Appointment,
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    const amount = appointment.reserved_points ?? 0;
    if (amount <= 0) return;

    if (appointment.points_settled) {
      await this.pointsService.reverseSettlement(
        patientUserId,
        doctorUserId,
        amount,
      );
      appointment.points_settled = false;
    } else {
      await this.pointsService.refundReserved(patientUserId, amount);
    }
    appointment.reserved_points = 0;
  }

  static appointmentActionLabel(
    action: AppointmentActionType,
    date: string,
    time: string,
  ): string {
    const when = `${date} ${formatTimeLabel(time)}`.trim();
    switch (action) {
      case 'request':
        return `Appointment requested for ${when}`;
      case 'confirm':
        return `Appointment confirmed for ${when}`;
      case 'reject':
        return `Appointment declined for ${when}`;
      case 'cancel':
        return `Appointment cancelled for ${when}`;
      case 'payment_request':
        return `Payment required for ${when}`;
      case 'payment_submitted':
        return `Payment receipt sent for ${when}`;
      case 'payment_approved':
        return `Payment approved — appointment confirmed for ${when}`;
      case 'payment_rejected':
        return `Payment rejected for ${when}`;
      case 'reschedule_request':
        return `Asked to move the appointment to ${when}`;
      case 'reschedule_accepted':
        return `Appointment moved to ${when}`;
      case 'reschedule_declined':
        return `Kept the appointment at ${when}`;
      case 'cancel_request':
        return `Asked to cancel the appointment for ${when}`;
      case 'cancel_approved':
        return `Appointment cancelled for ${when}`;
      case 'cancel_declined':
        return `Cancellation declined for ${when}`;
      default:
        return `Appointment update for ${when}`;
    }
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

  private async emitChatMessage(
    saved: Message,
    senderId: string,
    recipientId: string,
    extra?: {
      actor_id?: string;
      actor_name?: string;
      action?: AppointmentActionType;
      date?: string;
      time?: string;
      status?: AppointmentStatus;
    },
  ) {
    const mapped = this.mapMessage(saved);
    const [senderName, recipientName] = await Promise.all([
      this.usersService.getDisplayName(senderId),
      this.usersService.getDisplayName(recipientId),
    ]);
    this.presenceGateway.emitToUser(recipientId, 'message:new', {
      message: mapped,
      peer_id: senderId,
      peer_name: senderName,
    });
    this.presenceGateway.emitToUser(senderId, 'message:new', {
      message: mapped,
      peer_id: recipientId,
      peer_name: recipientName,
    });
    this.presenceGateway.emitToUser(recipientId, 'appointment:updated', {
      appointment_id: (saved.attachment_meta as AppointmentActionMeta)
        ?.appointment_id,
      peer_id: senderId,
      ...extra,
    });
    this.presenceGateway.emitToUser(senderId, 'appointment:updated', {
      appointment_id: (saved.attachment_meta as AppointmentActionMeta)
        ?.appointment_id,
      peer_id: recipientId,
      ...extra,
    });
  }

  private async upsertClinicPatient(
    profile: PatientProfile,
    clinicId: string,
  ): Promise<Patient> {
    const existing = await this.patientRepo.findOne({
      where: { phone: profile.phone, clinic_id: clinicId },
    });
    if (existing) return existing;
    const created = this.patientRepo.create({
      clinic_id: clinicId,
      name: profile.name,
      phone: profile.phone,
      photo_url: profile.photo_url,
    });
    return this.patientRepo.save(created);
  }

  /**
   * Doctor-facing insight for a chat booking. Prefer the AI-composed insight
   * (it can pull findings from shared images/labs); otherwise fall back to the
   * patient's stated reason enriched with their recent diagnoses, so the doctor
   * always gets some useful context.
   */
  private async buildDoctorInsight(
    patientUserId: string,
    reason?: string,
    patientInsight?: string,
  ): Promise<string> {
    const composed = (patientInsight ?? '').trim();
    if (composed) return composed.slice(0, 4000);

    const parts: string[] = [];
    const r = (reason ?? '').trim();
    if (r) parts.push(`Reason for visit: ${r}`);

    try {
      const recent = await this.diagnosisRepo.find({
        where: { patient_id: patientUserId },
        order: { created_at: 'DESC' },
        take: 3,
      });
      const history = recent
        .map((d) => d.desc?.trim())
        .filter((d): d is string => !!d);
      if (history.length) parts.push(`Recent history: ${history.join('; ')}`);
    } catch {
      // best-effort enrichment
    }

    return parts.join('\n').slice(0, 4000);
  }

  async bookFromChat(
    patientUserId: string,
    doctorUserId: string,
    date: string,
    time: string,
    reason?: string,
    patientInsight?: string,
    patientCountry?: string | null,
  ): Promise<{ appointment: Appointment; message: ReturnType<typeof this.mapMessage> }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new BadRequestException('time must be HH:mm');
    }

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: doctorUserId },
    });
    if (!doctor || doctor.approval_status !== 'approved') {
      throw new NotFoundException('Doctor not found');
    }
    if (!doctor.default_clinic_id) {
      throw new BadRequestException('Doctor has no clinic configured');
    }

    const profile = await this.profileRepo.findOne({
      where: { user_id: patientUserId },
    });
    if (!profile) throw new NotFoundException('Patient profile not found');

    const validSlots = await this.schedulesService.slotTimesForDate(
      doctor.id,
      date,
    );
    if (!validSlots.includes(time)) {
      throw new BadRequestException('Selected time slot is not available');
    }
    if (date === localDateYmd() && !isFutureSlot(date, time)) {
      throw new BadRequestException('Selected time slot has already passed');
    }

    const timeDb = `${time}:00`;
    const conflict = await this.appointmentRepo.findOne({
      where: {
        doctor_id: doctor.id,
        date,
        time: timeDb,
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED]),
        ),
      },
    });
    if (conflict) throw new BadRequestException('Time slot already booked');

    const insightForDoctor = await this.buildDoctorInsight(
      patientUserId,
      reason,
      patientInsight,
    );
    const price = clampConsultationPrice(doctor.video_consultation_price ?? 1);
    await this.pointsService.reservePoints(
      patientUserId,
      price,
      'Booking a video appointment',
    );

    const patient = await this.upsertClinicPatient(
      profile,
      doctor.default_clinic_id,
    );
    const count = await this.appointmentRepo.count({
      where: { doctor_id: doctor.id, date },
    });

    let appointment: Appointment;
    try {
      appointment = await this.appointmentRepo.save(
        this.appointmentRepo.create({
          clinic_id: doctor.default_clinic_id,
          doctor_id: doctor.id,
          patient_id: patient.id,
          patient_name: profile.name,
          patient_phone: profile.phone,
          date,
          time: timeDb,
          status: AppointmentStatus.PENDING,
          queue_position: count + 1,
          booked_via_app: true,
          patient_user_id: patientUserId,
          patient_country: patientCountry?.trim().toUpperCase() || null,
          reserved_points: price,
          points_settled: false,
          ai_patient_insight: insightForDoctor || null,
        }),
      );
    } catch (e) {
      await this.pointsService.refundReserved(patientUserId, price);
      throw e;
    }

    // No room until the doctor confirms — and, when there is a fee, not until
    // the payment clears. The link is created in confirmAppointment().
    const meta: AppointmentActionMeta = {
      appointment_id: appointment.id,
      action: 'request',
      date,
      time: timeDb,
      status: appointment.status,
      meeting_link: null,
      duration_minutes: doctor.video_consultation_minutes ?? 30,
      ...(insightForDoctor ? { patient_insight: insightForDoctor } : {}),
    };

    const savedMessage = await this.messageRepo.save(
      this.messageRepo.create({
        type: 'appointment_action',
        content: AppointmentsChatService.appointmentActionLabel(
          'request',
          date,
          timeDb,
        ),
        creator: patientUserId,
        recipient: doctorUserId,
        attachment_url: null,
        attachment_meta: meta,
      }),
    );

    await this.emitChatMessage(savedMessage, patientUserId, doctorUserId);

    void this.pushNotifications
      .sendAppointmentRequest({
        recipientId: doctorUserId,
        appointmentId: appointment.id,
        patientUserId,
        patientName: profile.name,
        date,
        time: formatTimeLabel(timeDb),
      })
      .catch((err) => this.logger.error('Appointment request push failed', err));

    return { appointment, message: this.mapMessage(savedMessage) };
  }

  private async ensureMeetingAssets(
    appointment: Appointment,
    doctorUserId: string,
    patientUserId: string,
  ): Promise<{ roomUrl: string; sessionId: string }> {
    let roomUrl = appointment.meeting_link ?? null;
    let sessionId = appointment.video_call_session_id ?? null;

    const doctorRow = await this.doctorRepo.findOne({
      where: { user_id: doctorUserId },
      select: ['video_consultation_minutes'],
    });
    const durationMinutes = doctorRow?.video_consultation_minutes ?? 30;

    if (!roomUrl) {
      // Room lives until the appointment's end (start + the doctor's video length),
      // so Daily auto-removes the meeting once its time passes.
      const expiresAtUnix =
        appointment.time && appointment.date
          ? Math.floor(
              new Date(`${appointment.date}T${appointment.time}`).getTime() / 1000,
            ) +
            durationMinutes * 60
          : undefined;
      const created = await this.dailyService.createRoom({
        expiresAtUnix,
        durationMinutes,
      });
      roomUrl = created.roomUrl;
      appointment.meeting_link = roomUrl;
    }

    if (!sessionId) {
      const patientName = await this.usersService.getDisplayName(patientUserId);
      const doctorName = await this.usersService.getDisplayName(doctorUserId);
      const session = await this.videoCallRepo.save(
        this.videoCallRepo.create({
          patient_user_id: patientUserId,
          doctor_user_id: doctorUserId,
          room_url: roomUrl,
          status: 'accepted',
          patient_name: patientName,
          doctor_name: doctorName,
          duration_minutes: durationMinutes,
        }),
      );
      sessionId = session.id;
      appointment.video_call_session_id = session.id;
    }

    if (
      appointment.meeting_link !== roomUrl ||
      appointment.video_call_session_id !== sessionId
    ) {
      appointment.meeting_link = roomUrl;
      appointment.video_call_session_id = sessionId;
    }

    await this.appointmentRepo.save(appointment);
    return { roomUrl, sessionId };
  }

  /** Cash the doctor charges this patient for a video visit, if any. */
  private resolveVisitFee(
    doctor: Doctor | null,
    appointment: Appointment,
    requestCountry?: string | null,
  ) {
    if (!doctor) return { amount: 0, currency: 'USD' as const, payment_link: null };
    const country =
      appointment.patient_country?.trim().toUpperCase() ||
      requestCountry?.trim().toUpperCase() ||
      null;
    return resolveDoctorFee(doctor, country, 'video');
  }

  /**
   * Everything that makes a visit real: credits settled, room created, chat
   * opened. Runs once the doctor confirms — or once the payment clears.
   */
  private async confirmAppointment(
    appointment: Appointment,
    doctorUserId: string,
    patientUserId: string,
  ): Promise<void> {
    appointment.status = AppointmentStatus.CONFIRMED;
    await this.appointmentRepo.save(appointment);

    if (appointment.reserved_points > 0 && !appointment.points_settled) {
      await this.pointsService.settleReservedToDoctor(
        patientUserId,
        doctorUserId,
        appointment.reserved_points,
      );
      appointment.points_settled = true;
      await this.appointmentRepo.save(appointment);
    }
    const ensured = await this.ensureMeetingAssets(
      appointment,
      doctorUserId,
      patientUserId,
    );
    appointment.meeting_link = ensured.roomUrl;
    appointment.video_call_session_id = ensured.sessionId;
    await this.consultationsService
      .ensureOpenForConfirmedAppointment(
        doctorUserId,
        patientUserId,
        appointment.ai_patient_insight,
      )
      .catch((err) =>
        this.logger.error(
          'Failed to open consultation for confirmed appointment',
          err,
        ),
      );
  }

  async handleAction(
    actorUserId: string,
    recipientId: string,
    meta: AppointmentActionMeta,
    requestCountry?: string | null,
  ): Promise<Message> {
    const action = meta.action;
    if (!APPOINTMENT_ACTIONS.includes(action) || action === 'request') {
      throw new BadRequestException('invalid appointment action');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id: meta.appointment_id },
      relations: ['doctor'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const doctor = appointment.doctor_id
      ? await this.doctorRepo.findOne({ where: { id: appointment.doctor_id } })
      : null;
    const doctorUserId = doctor?.user_id ?? null;
    const patientUserId = appointment.patient_user_id;

    if (!doctorUserId || !patientUserId) {
      throw new BadRequestException('Appointment participants are incomplete');
    }

    const participants = new Set([doctorUserId, patientUserId]);
    if (!participants.has(actorUserId) || !participants.has(recipientId)) {
      throw new ForbiddenException('Not a participant in this appointment');
    }

    // What the thread ends up showing: confirming a paid visit asks for money
    // rather than opening it.
    let emitted: AppointmentActionType = action;

    if (action === 'confirm' || action === 'reject') {
      if (actorUserId !== doctorUserId) {
        throw new ForbiddenException('Only the doctor can confirm or reject');
      }
      if (appointment.status !== AppointmentStatus.PENDING) {
        throw new BadRequestException('Appointment is no longer pending');
      }
      if (action === 'reject') {
        appointment.status = AppointmentStatus.REJECTED;
        await this.releaseAppointmentCredits(
          appointment,
          doctorUserId,
          patientUserId,
        );
        await this.appointmentRepo.save(appointment);
      } else {
        const fee = this.resolveVisitFee(doctor, appointment, requestCountry);
        if (fee.amount > 0 && appointment.payment_status !== 'paid') {
          // Stays pending, and stays without a meeting link, until the patient
          // pays and the doctor approves the receipt.
          appointment.payment_status = 'awaiting_payment';
          appointment.payment_amount = fee.amount.toFixed(2);
          appointment.payment_currency = fee.currency;
          appointment.payment_proof_url = null;
          await this.appointmentRepo.save(appointment);
          emitted = 'payment_request';
        } else {
          await this.confirmAppointment(
            appointment,
            doctorUserId,
            patientUserId,
          );
        }
      }
    }

    if (action === 'payment_submitted') {
      if (actorUserId !== patientUserId) {
        throw new ForbiddenException('Only the patient can send a receipt');
      }
      if (
        appointment.payment_status !== 'awaiting_payment' &&
        appointment.payment_status !== 'proof_submitted'
      ) {
        throw new BadRequestException('No payment was requested');
      }
      const proof = meta.payment_proof_url?.trim();
      if (!proof) throw new BadRequestException('Attach the payment receipt');
      appointment.payment_proof_url = proof;
      appointment.payment_status = 'proof_submitted';
      await this.appointmentRepo.save(appointment);
    }

    if (action === 'payment_approved' || action === 'payment_rejected') {
      if (actorUserId !== doctorUserId) {
        throw new ForbiddenException('Only the doctor can review the payment');
      }
      if (appointment.payment_status !== 'proof_submitted') {
        throw new BadRequestException('There is no receipt to review');
      }
      if (action === 'payment_approved') {
        appointment.payment_status = 'paid';
        await this.confirmAppointment(appointment, doctorUserId, patientUserId);
      } else {
        appointment.payment_status = 'awaiting_payment';
        appointment.payment_proof_url = null;
        await this.appointmentRepo.save(appointment);
      }
    }

    if (action === 'cancel' || action === 'reschedule_request') {
      if (appointment.pending_change) {
        throw new BadRequestException('There is already a pending request');
      }
    }

    if (action === 'cancel') {
      if (
        appointment.status === AppointmentStatus.CANCELLED ||
        appointment.status === AppointmentStatus.REJECTED ||
        appointment.status === AppointmentStatus.DONE
      ) {
        throw new BadRequestException('Appointment cannot be cancelled');
      }
      if (appointment.status === AppointmentStatus.PENDING) {
        // Never approved by the doctor — either side may just drop it.
        appointment.status = AppointmentStatus.CANCELLED;
        await this.releaseAppointmentCredits(
          appointment,
          doctorUserId,
          patientUserId,
        );
        await this.appointmentRepo.save(appointment);
      } else {
        // Already agreed: the other side has to agree to undo it too.
        appointment.pending_change = { kind: 'cancel', by: actorUserId };
        await this.appointmentRepo.save(appointment);
        emitted = 'cancel_request';
      }
    }

    if (action === 'reschedule_request') {
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new BadRequestException('Only confirmed appointments can be moved');
      }
      const currentTime = appointment.time?.trim();
      if (!currentTime || !isFutureSlot(appointment.date, currentTime)) {
        throw new BadRequestException(
          'Cannot change the time after the meeting has started',
        );
      }
      const date = meta.proposed_date?.trim();
      const time = meta.proposed_time?.trim();
      if (!date || !time) {
        throw new BadRequestException('Pick the new date and time');
      }
      if (!isFutureSlot(date, time)) {
        throw new BadRequestException('Pick a slot in the future');
      }
      appointment.pending_change = {
        kind: 'reschedule',
        by: actorUserId,
        date,
        time,
      };
      await this.appointmentRepo.save(appointment);
    }

    if (
      action === 'reschedule_accepted' ||
      action === 'reschedule_declined' ||
      action === 'cancel_approved' ||
      action === 'cancel_declined'
    ) {
      const pending = appointment.pending_change;
      const wantsReschedule = action.startsWith('reschedule_');
      if (!pending || pending.kind !== (wantsReschedule ? 'reschedule' : 'cancel')) {
        throw new BadRequestException('There is nothing to answer');
      }
      // Whoever asked cannot also answer.
      if (pending.by === actorUserId) {
        throw new ForbiddenException('The other person has to answer this');
      }

      if (action === 'reschedule_accepted') {
        appointment.date = pending.date ?? appointment.date;
        appointment.time = pending.time ?? appointment.time;
        // The old room expires at the old time — mint one for the new slot.
        appointment.meeting_link = null;
        appointment.video_call_session_id = null;
      }
      if (action === 'cancel_approved') {
        appointment.status = AppointmentStatus.CANCELLED;
        await this.releaseAppointmentCredits(
          appointment,
          doctorUserId,
          patientUserId,
        );
      }
      appointment.pending_change = null;
      await this.appointmentRepo.save(appointment);

      if (
        action === 'reschedule_accepted' &&
        appointment.status === AppointmentStatus.CONFIRMED
      ) {
        const ensured = await this.ensureMeetingAssets(
          appointment,
          doctorUserId,
          patientUserId,
        );
        appointment.meeting_link = ensured.roomUrl;
        appointment.video_call_session_id = ensured.sessionId;
        await this.appointmentRepo.save(appointment);
      }
    }

    const updatedMeta: AppointmentActionMeta = {
      appointment_id: appointment.id,
      action: emitted,
      date: appointment.date,
      time: appointment.time ?? '',
      status: appointment.status,
      meeting_link: appointment.meeting_link,
      payment_status: appointment.payment_status,
      payment_amount:
        appointment.payment_amount === null
          ? null
          : Number(appointment.payment_amount),
      payment_currency: appointment.payment_currency,
      // Sent whenever money is still owed — including after a rejected receipt.
      payment_link:
        appointment.payment_status === 'awaiting_payment'
          ? (doctor?.payment_link?.trim() ?? null) || null
          : null,
      payment_proof_url: appointment.payment_proof_url,
      pending_by: appointment.pending_change?.by ?? null,
      proposed_date: appointment.pending_change?.date ?? null,
      proposed_time: appointment.pending_change?.time ?? null,
    };

    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        type: 'appointment_action',
        content: AppointmentsChatService.appointmentActionLabel(
          emitted,
          // A reschedule request is about the proposed slot, not the old one.
          appointment.pending_change?.date ?? appointment.date,
          appointment.pending_change?.time ?? appointment.time,
        ),
        creator: actorUserId,
        recipient: recipientId,
        attachment_url: null,
        attachment_meta: updatedMeta,
      }),
    );

    const actorName = await this.usersService.getDisplayName(actorUserId);
    const pushDate =
      emitted === 'reschedule_request' && appointment.pending_change?.date
        ? appointment.pending_change.date
        : appointment.date;
    const pushTime =
      emitted === 'reschedule_request' && appointment.pending_change?.time
        ? formatTimeLabel(appointment.pending_change.time)
        : formatTimeLabel(appointment.time);
    await this.emitChatMessage(saved, actorUserId, recipientId, {
      actor_id: actorUserId,
      actor_name: actorName,
      action: emitted,
      date: appointment.date,
      time: formatTimeLabel(appointment.time),
      status: appointment.status,
    });

    void this.pushNotifications
      .sendAppointmentStatus({
        recipientId,
        appointmentId: appointment.id,
        actorName,
        action: emitted,
        date: pushDate,
        time: pushTime,
        proposedDate:
          emitted === 'reschedule_request'
            ? (appointment.pending_change?.date ?? undefined)
            : undefined,
        proposedTime:
          emitted === 'reschedule_request'
            ? (appointment.pending_change?.time ?? undefined)
            : undefined,
      })
      .catch((err) => this.logger.error('Appointment status push failed', err));

    return saved;
  }

  async cancelFromList(actorUserId: string, appointmentId: string): Promise<Message> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['doctor'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const doctor = appointment.doctor_id
      ? await this.doctorRepo.findOne({ where: { id: appointment.doctor_id } })
      : null;
    const doctorUserId = doctor?.user_id ?? null;
    const patientUserId = appointment.patient_user_id;

    if (!doctorUserId || !patientUserId) {
      throw new BadRequestException('Appointment participants are incomplete');
    }

    if (actorUserId !== doctorUserId && actorUserId !== patientUserId) {
      throw new ForbiddenException('Not a participant in this appointment');
    }

    const recipientId = actorUserId === doctorUserId ? patientUserId : doctorUserId;
    return this.handleAction(actorUserId, recipientId, {
      appointment_id: appointmentId,
      action: 'cancel',
      date: appointment.date,
      time: appointment.time ?? '',
    });
  }

  async sendDueReminders(): Promise<{
    deletedAppointments: number;
    checkedAppointments: number;
    remindedAppointments: number;
    notifiedParticipants: number;
  }> {
    const now = new Date();
    const today = localDateYmd(now);
    const nowMinutes = cairoMinutesSinceMidnight(now);
    const cleanupCandidates = await this.appointmentRepo.find({
      where: {
        date: today,
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED]),
        ),
      },
    });
    const olderAppointments = await this.appointmentRepo.find({
      where: {
        date: LessThan(today),
        status: Not(
          In([AppointmentStatus.CANCELLED, AppointmentStatus.REJECTED]),
        ),
      },
    });
    const expiredAppointments = [...cleanupCandidates, ...olderAppointments].filter(
      (appointment) =>
        isAppointmentExpiredByMoreThanMinutes(
          appointment.date,
          appointment.time,
          30,
          now,
        ),
    );

    if (expiredAppointments.length) {
      for (const appointment of expiredAppointments) {
        if (
          appointment.patient_user_id &&
          appointment.reserved_points > 0 &&
          !appointment.points_settled
        ) {
          const doctor = appointment.doctor_id
            ? await this.doctorRepo.findOne({
                where: { id: appointment.doctor_id },
              })
            : null;
          if (doctor?.user_id) {
            await this.releaseAppointmentCredits(
              appointment,
              doctor.user_id,
              appointment.patient_user_id,
            );
          } else {
            await this.pointsService.refundReserved(
              appointment.patient_user_id,
              appointment.reserved_points,
            );
          }
        }
      }
      const videoSessionIds = expiredAppointments
        .map((appointment) => appointment.video_call_session_id)
        .filter((value): value is string => !!value);
      if (videoSessionIds.length) {
        await this.videoCallRepo.delete(videoSessionIds);
      }
      const expiredIds = expiredAppointments.map((item) => item.id);
      await deleteAppointmentActionMessages(this.messageRepo, expiredIds);
      await this.appointmentRepo.delete(expiredIds);
      this.logger.log(
        `Deleted ${expiredAppointments.length} expired appointments during reminder check`,
      );
    }

    const appointments = await this.appointmentRepo.find({
      where: {
        status: AppointmentStatus.CONFIRMED,
        date: today,
        reminder_sent_at: IsNull(),
      },
    });

    let remindedAppointments = 0;
    let notifiedParticipants = 0;

    for (const appointment of appointments) {
      if (!appointment.time || !appointment.patient_user_id) continue;
      const doctor = appointment.doctor_id
        ? await this.doctorRepo.findOne({ where: { id: appointment.doctor_id } })
        : null;
      if (!doctor?.user_id) continue;

      const diffMinutes = timeToMinutes(appointment.time) - nowMinutes;
      if (diffMinutes > 5 || diffMinutes < 0) continue;

      const { roomUrl, sessionId } = await this.ensureMeetingAssets(
        appointment,
        doctor.user_id,
        appointment.patient_user_id,
      );
      const [doctorName, patientName] = await Promise.all([
        this.usersService.getDisplayName(doctor.user_id),
        this.usersService.getDisplayName(appointment.patient_user_id),
      ]);

      const claim = await this.appointmentRepo.update(
        { id: appointment.id, reminder_sent_at: IsNull() },
        { reminder_sent_at: new Date() },
      );
      if (!claim.affected) {
        this.logger.debug(`Reminder already claimed for ${appointment.id}`);
        continue;
      }

      const when = `${appointment.date} ${formatTimeLabel(appointment.time)}`;
      for (const userId of [appointment.patient_user_id, doctor.user_id]) {
        const otherParticipantName =
          userId === appointment.patient_user_id ? doctorName : patientName;
        void this.pushNotifications
          .sendAppointmentReminder({
            recipientId: userId,
            appointmentId: appointment.id,
            sessionId,
            meetingLink: roomUrl,
            when,
            otherParticipantName,
          })
          .catch((err) =>
            this.logger.error(`Reminder push failed for ${userId}`, err),
          );

        this.presenceGateway.emitToUser(userId, 'appointment:reminder', {
          appointment_id: appointment.id,
          session_id: sessionId,
          meeting_link: roomUrl,
          when,
          other_participant_name: otherParticipantName,
        });
        notifiedParticipants += 1;
      }

      remindedAppointments += 1;
      this.logger.log(`Sent appointment reminder for ${appointment.id}`);
    }

    return {
      deletedAppointments: expiredAppointments.length,
      checkedAppointments: appointments.length,
      remindedAppointments,
      notifiedParticipants,
    };
  }

}
