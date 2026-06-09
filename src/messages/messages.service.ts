import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType } from '../entities/message.entity';
import { User, UserRole } from '../entities/user.entity';
import { PresenceGateway } from '../presence/presence.gateway';
import { UsersService } from '../users/users.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private usersService: UsersService,
    private presenceGateway: PresenceGateway,
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
    };
  }

  private async assertCanChat(senderId: string, recipientId: string) {
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
      const title = dto.attachment_meta?.title?.trim();
      if (!title || !dto.attachment_meta?.record_id) {
        throw new BadRequestException('medical link metadata is required');
      }
      return dto.content?.trim() || title;
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
    await this.assertCanChat(userId, peerId);

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
    await this.assertCanChat(userId, peerId);
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

    if (type === 'medical_link') {
      const meta = dto.attachment_meta;
      if (
        !meta?.record_id ||
        !meta?.title ||
        !['lab', 'xray', 'diagnosis'].includes(meta.record_type)
      ) {
        throw new BadRequestException('invalid medical link metadata');
      }
    }

    await this.assertCanChat(userId, dto.recipient_id);

    const created = this.messageRepo.create({
      type,
      content,
      creator: userId,
      recipient: dto.recipient_id,
      attachment_url: dto.attachment_url?.trim() || null,
      attachment_meta: dto.attachment_meta ?? null,
    });
    const saved = await this.messageRepo.save(created);
    const mapped = this.mapMessage(saved);

    this.presenceGateway.emitToUser(dto.recipient_id, 'message:new', {
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
