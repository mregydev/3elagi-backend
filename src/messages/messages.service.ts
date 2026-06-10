import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessActionType,
  Message,
  MessageType,
} from '../entities/message.entity';
import { User, UserRole } from '../entities/user.entity';
import {
  DoctorPatientAccessService,
} from '../doctor-patient-access/doctor-patient-access.service';
import { PointsService } from '../points/points.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { UsersService } from '../users/users.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const ACCESS_ACTIONS: AccessActionType[] = [
  'grant_records',
  'revoke_records',
  'patient_block',
  'doctor_block',
  'patient_unblock',
  'doctor_unblock',
];

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private usersService: UsersService,
    private presenceGateway: PresenceGateway,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private pointsService: PointsService,
  ) {}

  private mapMessage(row: Message, pointsBalance?: number, messageCost?: number) {
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
      ...(pointsBalance !== undefined ? { points_balance: pointsBalance } : {}),
      ...(messageCost !== undefined ? { message_cost: messageCost } : {}),
    };
  }

  private async assertDoctorPatientPair(senderId: string, recipientId: string) {
    if (senderId === recipientId) {
      throw new BadRequestException('Cannot message yourself');
    }

    const [sender, recipient] = await Promise.all([
      this.userRepo.findOne({ where: { id: senderId } }),
      this.userRepo.findOne({ where: { id: recipientId } }),
    ]);

    if (!sender || !recipient) {
      throw new NotFoundException('User not found');
    }

    const roles = new Set([sender.role, recipient.role]);
    const allowed =
      roles.has(UserRole.DOCTOR) &&
      roles.has(UserRole.PATIENT) &&
      roles.size === 2;

    if (!allowed) {
      throw new ForbiddenException('Chat is only allowed between doctors and patients');
    }

    return { sender, recipient };
  }

  private async assertCanChat(senderId: string, recipientId: string) {
    await this.assertDoctorPatientPair(senderId, recipientId);
    await this.doctorPatientAccessService.assertCanChat(senderId, recipientId);
  }

  private resolveContent(dto: CreateMessageDto, type: MessageType): string {
    if (type === 'text') {
      const content = dto.content?.trim();
      if (!content) throw new BadRequestException('content is required');
      return content;
    }
    if (type === 'image') return dto.content?.trim() || 'Photo';
    if (type === 'video') return dto.content?.trim() || 'Video';
    if (type === 'voice') return dto.content?.trim() || 'Voice message';
    if (type === 'medical_link') {
      const meta = dto.attachment_meta as { title?: string; record_id?: string } | undefined;
      const title = meta?.title?.trim();
      if (!title || !meta?.record_id) {
        throw new BadRequestException('medical link metadata is required');
      }
      return dto.content?.trim() || title;
    }
    if (type === 'access_action') {
      const action = (dto.attachment_meta as { action?: AccessActionType } | undefined)?.action;
      if (!action || !ACCESS_ACTIONS.includes(action)) {
        throw new BadRequestException('invalid access action');
      }
      return DoctorPatientAccessService.accessActionLabel(action);
    }
    return dto.content?.trim() || '';
  }

  private async unreadCount(userId: string, peerId: string): Promise<number> {
    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.recipient = :userId', { userId })
      .andWhere('m.creator = :peerId', { peerId })
      .andWhere('m.read_at IS NULL')
      .getCount();
  }

  async listWithPeer(userId: string, peerId: string) {
    await this.assertDoctorPatientPair(userId, peerId);

    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where(
        '(m.creator = :userId AND m.recipient = :peerId) OR (m.creator = :peerId AND m.recipient = :userId)',
        { userId, peerId },
      )
      .orderBy('m.datetime', 'ASC')
      .getMany();

    return rows.map((row) => this.mapMessage(row));
  }

  async markRead(userId: string, peerId: string) {
    await this.assertDoctorPatientPair(userId, peerId);
    await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ read_at: () => 'NOW()' })
      .where('recipient = :userId', { userId })
      .andWhere('creator = :peerId', { peerId })
      .andWhere('read_at IS NULL')
      .execute();
    return { ok: true };
  }

  async create(userId: string, dto: CreateMessageDto) {
    const type: MessageType = dto.type ?? 'text';
    const content = this.resolveContent(dto, type);

    if (['image', 'video', 'voice'].includes(type) && !dto.attachment_url?.trim()) {
      throw new BadRequestException('attachment_url is required');
    }

    let attachmentMeta = dto.attachment_meta ?? null;

    if (type === 'medical_link') {
      const meta = dto.attachment_meta as {
        record_id?: string;
        title?: string;
        record_type?: string;
        note?: string;
      };
      if (
        !meta?.record_id ||
        !meta?.title ||
        !['lab', 'xray', 'diagnosis'].includes(meta.record_type ?? '')
      ) {
        throw new BadRequestException('invalid medical link metadata');
      }

      const title = meta.title.trim();
      const note = dto.content?.trim();
      attachmentMeta = {
        ...meta,
        ...(note && note !== title ? { note } : {}),
      } as typeof attachmentMeta;
    }

    if (type === 'access_action') {
      const action = (dto.attachment_meta as { action?: AccessActionType } | undefined)?.action;
      if (!action || !ACCESS_ACTIONS.includes(action)) {
        throw new BadRequestException('invalid access action');
      }

      const isUnblock = action === 'patient_unblock' || action === 'doctor_unblock';
      if (isUnblock) {
        await this.assertDoctorPatientPair(userId, dto.recipient_id);
      } else {
        await this.assertCanChat(userId, dto.recipient_id);
      }

      const status = await this.doctorPatientAccessService.applyAccessAction(
        userId,
        dto.recipient_id,
        action,
      );

      const created = this.messageRepo.create({
        type,
        content: DoctorPatientAccessService.accessActionLabel(action),
        creator: userId,
        recipient: dto.recipient_id,
        attachment_url: null,
        attachment_meta: { action },
      });
      const saved = await this.messageRepo.save(created);
      const mapped = this.mapMessage(saved);

      this.presenceGateway.emitToUser(dto.recipient_id, 'message:new', {
        message: mapped,
        peer_id: userId,
      });
      this.presenceGateway.emitToUser(dto.recipient_id, 'access:updated', {
        status,
        peer_id: userId,
      });
      this.presenceGateway.emitToUser(userId, 'access:updated', {
        status,
        peer_id: dto.recipient_id,
      });

      return mapped;
    }

    await this.assertCanChat(userId, dto.recipient_id);

    const messageCost = await this.pointsService.resolveMessageCostForRecipient(
      dto.recipient_id,
    );
    const pointsSummary = await this.pointsService.deductForMessage(userId, messageCost);

    const created = this.messageRepo.create({
      type,
      content,
      creator: userId,
      recipient: dto.recipient_id,
      attachment_url: dto.attachment_url?.trim() || null,
      attachment_meta: attachmentMeta,
    });
    const saved = await this.messageRepo.save(created);
    const mapped = this.mapMessage(
      saved,
      pointsSummary.message_points,
      messageCost,
    );

    this.presenceGateway.emitToUser(dto.recipient_id, 'message:new', {
      message: mapped,
      peer_id: userId,
    });

    return mapped;
  }

  async delete(userId: string, messageId: string) {
    const row = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!row) {
      throw new NotFoundException('Message not found');
    }
    if (row.creator !== userId) {
      throw new ForbiddenException('Only the sender can delete this message');
    }

    const peerId = row.recipient;
    await this.assertCanChat(userId, peerId);
    await this.messageRepo.delete({ id: messageId });

    this.presenceGateway.emitToUser(peerId, 'message:deleted', {
      message_id: messageId,
      peer_id: userId,
    });

    return { ok: true, message_id: messageId, peer_id: userId };
  }

  async update(userId: string, messageId: string, dto: UpdateMessageDto) {
    const row = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!row) {
      throw new NotFoundException('Message not found');
    }
    if (row.creator !== userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }
    if (row.type !== 'text' && row.type !== 'medical_link') {
      throw new BadRequestException('This message cannot be edited');
    }

    const sentAt = new Date(row.datetime).getTime();
    if (Date.now() - sentAt > MESSAGE_EDIT_WINDOW_MS) {
      throw new BadRequestException('Message can no longer be edited');
    }

    const peerId = row.recipient;
    await this.assertCanChat(userId, peerId);

    if (row.type === 'text') {
      const content = dto.content?.trim();
      if (!content) {
        throw new BadRequestException('content is required');
      }
      row.content = content;
    } else {
      const meta = dto.attachment_meta;
      if (
        !meta?.record_id ||
        !meta?.title ||
        !['lab', 'xray', 'diagnosis'].includes(meta.record_type)
      ) {
        throw new BadRequestException('invalid medical link metadata');
      }

      const title = meta.title.trim();
      const note = dto.content?.trim();
      row.attachment_meta = {
        record_type: meta.record_type,
        record_id: meta.record_id,
        title,
        ...(note && note !== title ? { note } : {}),
      };
      row.content = note || title;
    }

    row.edited_at = new Date();
    const saved = await this.messageRepo.save(row);
    const mapped = this.mapMessage(saved);

    this.presenceGateway.emitToUser(peerId, 'message:updated', {
      message: mapped,
      peer_id: userId,
    });

    return mapped;
  }

  async listConversations(userId: string) {
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .select(
        `CASE WHEN m.creator = :userId THEN m.recipient ELSE m.creator END`,
        'peer_id',
      )
      .addSelect('MAX(m.datetime)', 'last_at')
      .where('m.creator = :userId OR m.recipient = :userId', { userId })
      .groupBy('peer_id')
      .orderBy('last_at', 'DESC')
      .setParameters({ userId })
      .getRawMany<{
        peer_id: string;
        last_at: string;
      }>();

    if (rows.length === 0) return [];

    const peerIds = rows.map((row) => row.peer_id);
    const contacts = await this.usersService.listContacts(userId);
    const contactById = new Map(contacts.map((c) => [c.id, c]));

    const conversations = await Promise.all(
      peerIds.map(async (peerId) => {
        const peer = contactById.get(peerId);
        if (!peer) return null;

        const lastMessage = await this.messageRepo
          .createQueryBuilder('m')
          .where(
            '(m.creator = :userId AND m.recipient = :peerId) OR (m.creator = :peerId AND m.recipient = :userId)',
            { userId, peerId },
          )
          .orderBy('m.datetime', 'DESC')
          .getOne();

        if (!lastMessage) return null;

        const unread_count = await this.unreadCount(userId, peerId);

        return {
          peer_id: peerId,
          peer,
          last_message: this.mapMessage(lastMessage),
          unread_count,
        };
      }),
    );

    return conversations.filter(Boolean);
  }
}
