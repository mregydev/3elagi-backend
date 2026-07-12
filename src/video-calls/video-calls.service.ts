import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import {
  VideoCallSession,
  type VideoCallStatus,
} from '../entities/video-call-session.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
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
}

@Injectable()
export class VideoCallsService {
  private readonly logger = new Logger(VideoCallsService.name);

  constructor(
    @InjectRepository(VideoCallSession)
    private readonly sessionRepo: Repository<VideoCallSession>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly daily: DailyService,
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
    };
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

    const [patientName, doctorName, { roomUrl }] = await Promise.all([
      this.users.getDisplayName(patientUserId),
      this.users.getDisplayName(dto.doctor_user_id),
      this.daily.createRoom(),
    ]);

    const session = this.sessionRepo.create({
      patient_user_id: patientUserId,
      doctor_user_id: dto.doctor_user_id,
      room_url: roomUrl,
      status: 'ringing',
      patient_name: patientName,
      doctor_name: doctorName,
    });
    await this.sessionRepo.save(session);

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
    return this.toView(session);
  }

  async end(sessionId: string, userId: string): Promise<VideoCallSessionView> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Call session not found');
    this.assertParticipant(session, userId);
    if (session.status !== 'ended') {
      session.status = 'ended';
      await this.sessionRepo.save(session);
    }
    return this.toView(session);
  }
}
