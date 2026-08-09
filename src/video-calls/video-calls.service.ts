import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import {
  VideoCallSession,
  type VideoCallStatus,
} from '../entities/video-call-session.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { PointsService } from '../points/points.service';
import { clampConsultationPrice } from '../points/message-price.constants';
import { PresenceGateway } from '../presence/presence.gateway';
import { UsersService } from '../users/users.service';
import { DailyService } from '../daily/daily.service';
import { CreateVideoCallDto } from './dto/create-video-call.dto';

export interface VideoCallSessionView {
  id: string;
  roomUrl: string;
  status: VideoCallStatus;
  patientUserId: string;
  doctorUserId: string;
  patientName: string;
  doctorName: string;
  durationMinutes: number;
  /** Credits held from the patient for this call. */
  reservedPoints: number;
}

@Injectable()
export class VideoCallsService {
  private readonly logger = new Logger(VideoCallsService.name);

  constructor(
    @InjectRepository(VideoCallSession)
    private readonly sessionRepo: Repository<VideoCallSession>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    private readonly daily: DailyService,
    private readonly points: PointsService,
    private readonly push: PushNotificationsService,
    private readonly presenceGateway: PresenceGateway,
    private readonly users: UsersService,
  ) {}

  private toView(session: VideoCallSession): VideoCallSessionView {
    return {
      id: session.id,
      roomUrl: session.room_url,
      status: session.status,
      patientUserId: session.patient_user_id,
      doctorUserId: session.doctor_user_id,
      patientName: session.patient_name,
      doctorName: session.doctor_name,
      durationMinutes: session.duration_minutes ?? 30,
      reservedPoints: session.reserved_points ?? 0,
    };
  }

  /** Live = the doctor's line is busy (someone is ringing them or talking). */
  private static readonly LIVE_STATUSES: VideoCallStatus[] = [
    'ringing',
    'accepted',
  ];
  private static readonly RING_TIMEOUT_SEC = 60;

  private async findLiveSessionForDoctor(
    doctorUserId: string,
  ): Promise<VideoCallSession | null> {
    // Clean up stale ringing sessions (no answer in 60s = caller hung up or network failed).
    const staleThreshold = new Date(
      Date.now() - VideoCallsService.RING_TIMEOUT_SEC * 1000,
    );
    const stale = await this.sessionRepo.find({
      where: {
        doctor_user_id: doctorUserId,
        status: 'ringing',
      },
    });
    for (const session of stale) {
      if (new Date(session.created_at) < staleThreshold) {
        await this.refundReservation(session);
        session.status = 'missed';
        await this.sessionRepo.save(session);
      }
    }

    return this.sessionRepo.findOne({
      where: {
        doctor_user_id: doctorUserId,
        status: In(VideoCallsService.LIVE_STATUSES),
      },
    });
  }

  /** Release the patient's held credits — declined, missed, or never answered. */
  private async refundReservation(session: VideoCallSession): Promise<void> {
    const held = session.reserved_points ?? 0;
    if (held <= 0) return;
    session.reserved_points = 0;
    await this.sessionRepo.save(session);
    try {
      await this.points.refundReserved(session.patient_user_id, held);
    } catch (err) {
      this.logger.error(
        `Failed to refund ${held} credits for call ${session.id}`,
        err,
      );
    }
  }

  /** Answered call: the held credits go to the doctor. */
  private async settleReservation(session: VideoCallSession): Promise<void> {
    const held = session.reserved_points ?? 0;
    if (held <= 0) return;
    session.reserved_points = 0;
    await this.sessionRepo.save(session);
    try {
      await this.points.settleReservedToDoctor(
        session.patient_user_id,
        session.doctor_user_id,
        held,
      );
    } catch (err) {
      this.logger.error(
        `Failed to settle ${held} credits for call ${session.id}`,
        err,
      );
    }
  }

  private async assertDoctorUser(doctorUserId: string): Promise<User> {
    const doctorUser = await this.userRepo.findOne({
      where: { id: doctorUserId },
    });
    if (!doctorUser || doctorUser.role !== UserRole.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }
    return doctorUser;
  }

  private assertParticipant(
    session: VideoCallSession,
    userId: string,
  ): void {
    if (
      userId !== session.patient_user_id &&
      userId !== session.doctor_user_id
    ) {
      throw new ForbiddenException('Not a participant in this call');
    }
  }

  async initiate(
    patientUserId: string,
    dto: CreateVideoCallDto,
  ): Promise<VideoCallSessionView> {
    await this.assertDoctorUser(dto.doctor_user_id);

    const doctor = await this.doctorRepo.findOne({
      where: { user_id: dto.doctor_user_id },
      select: [
        'video_consultation_minutes',
        'video_consultation_price',
        'immediate_call_enabled',
      ],
    });
    if (!doctor?.immediate_call_enabled) {
      throw new ForbiddenException('This doctor is not accepting calls');
    }

    // One line per doctor: whoever is already ringing or talking holds it.
    const live = await this.findLiveSessionForDoctor(dto.doctor_user_id);
    if (live) {
      throw new ConflictException({
        message: 'This doctor is on another call right now',
        code: 'doctor_busy',
      });
    }

    const durationMinutes = doctor?.video_consultation_minutes ?? 30;
    const cost = clampConsultationPrice(doctor?.video_consultation_price ?? 1);

    // Hold the credits before ringing — throws if the patient cannot afford it.
    await this.points.reservePoints(patientUserId, cost, 'Starting a call');

    let patientName: string;
    let doctorName: string;
    let roomUrl: string;
    try {
      [patientName, doctorName, { roomUrl }] = await Promise.all([
        this.users.getDisplayName(patientUserId),
        this.users.getDisplayName(dto.doctor_user_id),
        this.daily.createRoom({ durationMinutes }),
      ]);
    } catch (err) {
      await this.points.refundReserved(patientUserId, cost);
      throw err;
    }

    const session = this.sessionRepo.create({
      patient_user_id: patientUserId,
      doctor_user_id: dto.doctor_user_id,
      room_url: roomUrl,
      status: 'ringing',
      patient_name: patientName,
      doctor_name: doctorName,
      duration_minutes: durationMinutes,
      reserved_points: cost,
    });
    try {
      await this.sessionRepo.save(session);
    } catch (err) {
      // Partial unique index lost the race — another patient is already ringing.
      await this.points.refundReserved(patientUserId, cost);
      throw new ConflictException({
        message: 'This doctor is on another call right now',
        code: 'doctor_busy',
      });
    }

    this.presenceGateway.emitToUser(dto.doctor_user_id, 'video-call:incoming', {
      session_id: session.id,
      caller_id: patientUserId,
      caller_name: patientName,
    });

    void this.push
      .sendIncomingVideoCall({
        recipientId: dto.doctor_user_id,
        sessionId: session.id,
        callerId: patientUserId,
        callerName: patientName,
      })
      .catch((err) => {
        this.logger.error('Failed to send incoming video call push', err);
      });

    this.logger.log(
      `Video call ${session.id} ringing — patient ${patientUserId} → doctor ${dto.doctor_user_id}`,
    );

    return this.toView(session);
  }

  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<VideoCallSessionView> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Call session not found');
    this.assertParticipant(session, userId);
    return this.toView(session);
  }

  async accept(sessionId: string, doctorUserId: string): Promise<VideoCallSessionView> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Call session not found');
    if (session.doctor_user_id !== doctorUserId) {
      throw new ForbiddenException('Only the doctor can accept this call');
    }
    if (session.status === 'ended' || session.status === 'declined') {
      throw new BadRequestException('Call is no longer available');
    }
    if (session.status !== 'accepted') {
      session.status = 'accepted';
      await this.sessionRepo.save(session);
    }
    this.notifyCaller(session, 'accepted');
    return this.toView(session);
  }

  async decline(sessionId: string, doctorUserId: string): Promise<VideoCallSessionView> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Call session not found');
    if (session.doctor_user_id !== doctorUserId) {
      throw new ForbiddenException('Only the doctor can decline this call');
    }
    session.status = 'declined';
    await this.sessionRepo.save(session);
    await this.refundReservation(session);
    this.notifyCaller(session, 'declined');
    return this.toView(session);
  }

  async end(sessionId: string, userId: string): Promise<VideoCallSessionView> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Call session not found');
    this.assertParticipant(session, userId);
    if (session.status !== 'ended') {
      // Answered → the doctor earned it. Hung up while ringing → give it back.
      const wasAnswered = session.status === 'accepted';
      session.status = 'ended';
      await this.sessionRepo.save(session);
      if (wasAnswered) await this.settleReservation(session);
      else await this.refundReservation(session);

      const peerId =
        userId === session.patient_user_id
          ? session.doctor_user_id
          : session.patient_user_id;
      this.presenceGateway.emitToUser(peerId, 'video-call:status', {
        session_id: session.id,
        status: 'ended' as VideoCallStatus,
      });
    }
    return this.toView(session);
  }

  /** Tell the patient who is staring at the dialing screen what happened. */
  private notifyCaller(
    session: VideoCallSession,
    status: VideoCallStatus,
  ): void {
    this.presenceGateway.emitToUser(
      session.patient_user_id,
      'video-call:status',
      {
        session_id: session.id,
        status,
        room_url: session.room_url,
        doctor_name: session.doctor_name,
        duration_minutes: session.duration_minutes ?? 30,
      },
    );
  }
}
