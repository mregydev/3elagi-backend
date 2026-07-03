import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { WHEREBY_CONFIG } from './whereby.config';
import { CreateWherebyMeetingDto } from './dto/create-whereby-meeting.dto';

interface WherebyMeetingResponse {
  roomUrl?: string;
  meetingId?: string;
  message?: string;
}

@Injectable()
export class WherebyService {
  private readonly logger = new Logger(WherebyService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async createMeeting(
    requesterId: string,
    requesterRole: string,
    dto: CreateWherebyMeetingDto,
  ): Promise<{ roomUrl: string }> {
    if (requesterRole.toLowerCase() !== UserRole.PATIENT) {
      throw new BadRequestException('Only patients can start a video call');
    }

    if (dto.doctor_user_id) {
      const doctorUser = await this.userRepo.findOne({
        where: { id: dto.doctor_user_id },
      });
      if (!doctorUser || doctorUser.role !== UserRole.DOCTOR) {
        throw new NotFoundException('Doctor not found');
      }
    }

    const apiKey = WHEREBY_CONFIG.apiKey;
    if (!apiKey) {
      this.logger.error('WHEREBY_API_KEY is not configured');
      throw new InternalServerErrorException('Video calls are not configured');
    }

    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 2);

    let response: Response;
    try {
      response = await fetch(WHEREBY_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endDate: endDate.toISOString(),
          roomMode: 'normal',
          roomNamePrefix: '3elagi',
        }),
      });
    } catch (err) {
      this.logger.error('Whereby API request failed', err);
      throw new InternalServerErrorException('Could not create video call');
    }

    const data = (await response.json().catch(() => ({}))) as WherebyMeetingResponse;

    if (!response.ok || !data.roomUrl) {
      this.logger.error(
        `Whereby API HTTP ${response.status}: ${data.message ?? JSON.stringify(data)}`,
      );
      throw new InternalServerErrorException('Could not create video call');
    }

    this.logger.log(
      `Whereby meeting ${data.meetingId ?? 'unknown'} created for patient ${requesterId}`,
    );

    return { roomUrl: data.roomUrl };
  }
}
