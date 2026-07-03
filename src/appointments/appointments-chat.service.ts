import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from '../entities/appointment.entity';
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
import { WherebyService } from '../whereby/whereby.service';
import { VideoCallSession } from '../entities/video-call-session.entity';

const APPOINTMENT_ACTIONS: AppointmentActionType[] = [
  'request',
  'confirm',
  'reject',
  'cancel',
];

function formatTimeLabel(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}

@Injectable()
export class AppointmentsChatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsChatService.name);
  private reminderTimer: ReturnType<typeof setInterval> | null = null;

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
    private readonly schedulesService: SchedulesService,
    private readonly usersService: UsersService,
    private readonly presenceGateway: PresenceGateway,
    private readonly pushNotifications: PushNotificationsService,
    private readonly wherebyService: WherebyService,
  ) {}

  onModuleInit(): void {
    this.reminderTimer = setInterval(() => {
      void this.processDueReminders().catch((err) => {
        this.logger.error('Appointment reminder check failed', err);
      });
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
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
    this.presenceGateway.emitToUser(recipientId, 'message:new', {
      message: mapped,
      peer_id: senderId,
    });
    this.presenceGateway.emitToUser(senderId, 'message:new', {
      message: mapped,
      peer_id: recipientId,
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

  async bookFromChat(
    patientUserId: string,
    doctorUserId: string,
    date: string,
    time: string,
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

    const patient = await this.upsertClinicPatient(
      profile,
      doctor.default_clinic_id,
    );
    const count = await this.appointmentRepo.count({
      where: { doctor_id: doctor.id, date },
    });

    const appointment = await this.appointmentRepo.save(
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
      }),
    );

    const meta: AppointmentActionMeta = {
      appointment_id: appointment.id,
      action: 'request',
      date,
      time: timeDb,
      status: appointment.status,
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

  async handleAction(
    actorUserId: string,
    recipientId: string,
    meta: AppointmentActionMeta,
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

    if (action === 'confirm' || action === 'reject') {
      if (actorUserId !== doctorUserId) {
        throw new ForbiddenException('Only the doctor can confirm or reject');
      }
      if (appointment.status !== AppointmentStatus.PENDING) {
        throw new BadRequestException('Appointment is no longer pending');
      }
      appointment.status =
        action === 'confirm'
          ? AppointmentStatus.CONFIRMED
          : AppointmentStatus.REJECTED;
      await this.appointmentRepo.save(appointment);
    }

    if (action === 'cancel') {
      if (
        appointment.status === AppointmentStatus.CANCELLED ||
        appointment.status === AppointmentStatus.REJECTED ||
        appointment.status === AppointmentStatus.DONE
      ) {
        throw new BadRequestException('Appointment cannot be cancelled');
      }
      appointment.status = AppointmentStatus.CANCELLED;
      await this.appointmentRepo.save(appointment);
    }

    const updatedMeta: AppointmentActionMeta = {
      appointment_id: appointment.id,
      action,
      date: appointment.date,
      time: appointment.time ?? '',
      status: appointment.status,
      meeting_link: appointment.meeting_link,
    };

    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        type: 'appointment_action',
        content: AppointmentsChatService.appointmentActionLabel(
          action,
          appointment.date,
          appointment.time,
        ),
        creator: actorUserId,
        recipient: recipientId,
        attachment_url: null,
        attachment_meta: updatedMeta,
      }),
    );

    const actorName = await this.usersService.getDisplayName(actorUserId);
    await this.emitChatMessage(saved, actorUserId, recipientId, {
      actor_id: actorUserId,
      actor_name: actorName,
      action,
      date: appointment.date,
      time: formatTimeLabel(appointment.time),
      status: appointment.status,
    });

    void this.pushNotifications
      .sendAppointmentStatus({
        recipientId,
        appointmentId: appointment.id,
        actorName,
        action,
        date: appointment.date,
        time: formatTimeLabel(appointment.time),
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

  async processDueReminders(): Promise<void> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const appointments = await this.appointmentRepo.find({
      where: {
        status: AppointmentStatus.CONFIRMED,
        date: today,
        reminder_sent_at: IsNull(),
      },
    });

    for (const appointment of appointments) {
      if (!appointment.time || !appointment.patient_user_id) continue;
      const doctor = appointment.doctor_id
        ? await this.doctorRepo.findOne({ where: { id: appointment.doctor_id } })
        : null;
      if (!doctor?.user_id) continue;

      const [h, m] = appointment.time.split(':').map((v) => parseInt(v, 10));
      const start = new Date(now);
      start.setHours(h, m, 0, 0);
      const diffMs = start.getTime() - now.getTime();
      if (diffMs > 5 * 60_000 || diffMs < -10 * 60_000) continue;

      const patientName = await this.usersService.getDisplayName(
        appointment.patient_user_id,
      );
      const doctorName = await this.usersService.getDisplayName(doctor.user_id);

      const { roomUrl } = await this.wherebyService.createRoom();
      const session = await this.videoCallRepo.save(
        this.videoCallRepo.create({
          patient_user_id: appointment.patient_user_id,
          doctor_user_id: doctor.user_id,
          room_url: roomUrl,
          status: 'accepted',
          patient_name: patientName,
          doctor_name: doctorName,
        }),
      );

      appointment.meeting_link = roomUrl;
      appointment.video_call_session_id = session.id;
      appointment.reminder_sent_at = new Date();
      await this.appointmentRepo.save(appointment);

      const when = `${appointment.date} ${formatTimeLabel(appointment.time)}`;
      const reminderMeta: AppointmentActionMeta = {
        appointment_id: appointment.id,
        action: 'confirm',
        date: appointment.date,
        time: appointment.time ?? '',
        status: appointment.status,
        meeting_link: roomUrl,
      };
      const reminderMessage = await this.messageRepo.save(
        this.messageRepo.create({
          type: 'appointment_action',
          content: `Meeting ready for ${when} — tap Join to enter`,
          creator: doctor.user_id,
          recipient: appointment.patient_user_id,
          attachment_url: null,
          attachment_meta: reminderMeta,
        }),
      );
      await this.emitChatMessage(
        reminderMessage,
        doctor.user_id,
        appointment.patient_user_id,
      );

      for (const userId of [appointment.patient_user_id, doctor.user_id]) {
        void this.pushNotifications
          .sendAppointmentReminder({
            recipientId: userId,
            appointmentId: appointment.id,
            sessionId: session.id,
            meetingLink: roomUrl,
            when,
          })
          .catch((err) =>
            this.logger.error(`Reminder push failed for ${userId}`, err),
          );

        this.presenceGateway.emitToUser(userId, 'appointment:reminder', {
          appointment_id: appointment.id,
          session_id: session.id,
          meeting_link: roomUrl,
          when,
        });
      }

      this.logger.log(`Sent appointment reminder for ${appointment.id}`);
    }
  }
}
