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
  AppointmentActionMeta,
  AppointmentActionType,
  Message,
  MessageType,
} from '../entities/message.entity';
import { Appointment } from '../entities/appointment.entity';
import { User, UserRole } from '../entities/user.entity';
import {
  DoctorPatientAccessService,
} from '../doctor-patient-access/doctor-patient-access.service';
import { PresenceGateway } from '../presence/presence.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { UsersService } from '../users/users.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageEmotionsService } from '../message-emotions/message-emotions.service';
import { AppointmentsChatService } from '../appointments/appointments-chat.service';
import { ConsultationsService } from '../consultations/consultations.service';
import { TestPatientAiService } from '../doctor-onboarding/test-patient-ai.service';
import { resolvePricingCountry, type RequestLike } from '../common/request-country';
import { stripOrphanedAppointmentMessages } from '../appointments/appointment-chat-messages';

const ACCESS_ACTIONS: AccessActionType[] = [
  'grant_records',
  'revoke_records',
  'patient_block',
  'doctor_block',
  'patient_unblock',
  'doctor_unblock',
];

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

/** Record kinds that may be linked into a chat message. */
const MEDICAL_LINK_RECORD_TYPES: string[] = [
  'lab',
  'xray',
  'diagnosis',
  'intake',
  'prescription',
];

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    private usersService: UsersService,
    private presenceGateway: PresenceGateway,
    private pushNotifications: PushNotificationsService,
    private doctorPatientAccessService: DoctorPatientAccessService,
    private messageEmotionsService: MessageEmotionsService,
    private appointmentsChatService: AppointmentsChatService,
    private consultationsService: ConsultationsService,
    private testPatientAi: TestPatientAiService,
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

  private async assertChatParticipants(senderId: string, recipientId: string) {
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
    const isDoctorPatient =
      roles.has(UserRole.DOCTOR) &&
      roles.has(UserRole.PATIENT) &&
      roles.size === 2;
    const isDoctorDoctor =
      sender.role === UserRole.DOCTOR && recipient.role === UserRole.DOCTOR;
    // Support: an admin may reach any member, and any member may reply.
    const involvesAdmin = roles.has(UserRole.ADMIN);

    if (!isDoctorPatient && !isDoctorDoctor && !involvesAdmin) {
      throw new ForbiddenException(
        'Chat is only allowed between doctors and patients, or between two doctors',
      );
    }

    return { sender, recipient };
  }

  /** @deprecated alias */
  private async assertDoctorPatientPair(senderId: string, recipientId: string) {
    return this.assertChatParticipants(senderId, recipientId);
  }

  private isDoctorDoctorPair(sender: User, recipient: User): boolean {
    return sender.role === UserRole.DOCTOR && recipient.role === UserRole.DOCTOR;
  }

  /** Admin support threads skip the consultation gate and the access rules. */
  private involvesAdmin(sender: User, recipient: User): boolean {
    return sender.role === UserRole.ADMIN || recipient.role === UserRole.ADMIN;
  }

  private async assertCanChat(senderId: string, recipientId: string) {
    const { sender, recipient } = await this.assertChatParticipants(
      senderId,
      recipientId,
    );
    if (this.isDoctorDoctorPair(sender, recipient)) {
      return;
    }
    if (this.involvesAdmin(sender, recipient)) {
      return;
    }
    await this.doctorPatientAccessService.assertCanChat(senderId, recipientId);
  }

  private messagePreview(content: string, type: MessageType): string {
    const text = content?.trim();
    if (text) return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    if (type === 'image') return 'Photo';
    if (type === 'video') return 'Video';
    if (type === 'voice') return 'Voice message';
    if (type === 'document_request') return 'Document request';
    return 'New message';
  }

  private async notifyRecipientPush(
    recipientId: string,
    senderId: string,
    message: { id: string; type: MessageType; content: string },
  ): Promise<void> {
    if (recipientId === senderId) return;
    if (message.type === 'access_action') return;
    if (message.type === 'appointment_action') return;

    const senderName = await this.usersService.getDisplayName(senderId);

    await this.pushNotifications.sendChatMessage({
      recipientId,
      chatId: senderId,
      messageId: message.id,
      senderId,
      senderName,
      body: this.messagePreview(message.content, message.type),
    });
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
    if (type === 'appointment_action') {
      const meta = dto.attachment_meta as AppointmentActionMeta | undefined;
      if (!meta?.action || !APPOINTMENT_ACTIONS.includes(meta.action)) {
        throw new BadRequestException('invalid appointment action');
      }
      return AppointmentsChatService.appointmentActionLabel(
        meta.action,
        meta.date,
        meta.time,
      );
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

    const validRows = await stripOrphanedAppointmentMessages(
      rows,
      this.appointmentRepo,
      this.messageRepo,
    );

    const grouped = await this.messageEmotionsService.getForMessages(
      validRows.map((row) => row.id),
      'chat',
    );

    return validRows.map((row) => ({
      ...this.mapMessage(row),
      emotions: grouped[row.id] ?? [],
    }));
  }

  async markRead(userId: string, peerId: string) {
    await this.assertDoctorPatientPair(userId, peerId);
    const result = await this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ read_at: () => 'NOW()' })
      .where('recipient = :userId', { userId })
      .andWhere('creator = :peerId', { peerId })
      .andWhere('read_at IS NULL')
      .execute();

    // Tell the sender their ticks turned blue. Without this the receipt only
    // showed up the next time they reloaded the thread.
    if ((result.affected ?? 0) > 0) {
      this.presenceGateway.emitToUser(peerId, 'messages:read', {
        peer_id: userId,
        read_at: new Date().toISOString(),
      });
    }
    return { ok: true };
  }

  /** Recipient marks one inbound message as read. */
  async markMessageRead(userId: string, messageId: string) {
    const row = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!row) throw new NotFoundException('Message not found');
    if (row.recipient !== userId) {
      throw new ForbiddenException('Only the recipient can mark a message as read');
    }
    if (!row.read_at) {
      row.read_at = new Date();
      await this.messageRepo.save(row);
      this.notifyReadStateChanged(row);
    }
    return this.mapMessage(row);
  }

  /** Recipient marks one inbound message as unread. */
  async markMessageUnread(userId: string, messageId: string) {
    const row = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!row) throw new NotFoundException('Message not found');
    if (row.recipient !== userId) {
      throw new ForbiddenException('Only the recipient can mark a message as unread');
    }
    if (row.read_at) {
      row.read_at = null;
      await this.messageRepo.save(row);
      this.notifyReadStateChanged(row);
    }
    return this.mapMessage(row);
  }

  /** Push a single message's new read state to both sides of the thread. */
  private notifyReadStateChanged(row: Message): void {
    const mapped = this.mapMessage(row);
    this.presenceGateway.emitToUser(row.creator, 'message:updated', {
      message: mapped,
      peer_id: row.recipient,
    });
    this.presenceGateway.emitToUser(row.recipient, 'message:updated', {
      message: mapped,
      peer_id: row.creator,
    });
  }

  async create(userId: string, dto: CreateMessageDto, req?: RequestLike) {
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
        !MEDICAL_LINK_RECORD_TYPES.includes(meta.record_type ?? '')
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
      const pair = await this.assertChatParticipants(userId, dto.recipient_id);
      const roles = new Set([pair.sender.role, pair.recipient.role]);
      const isDoctorPatient =
        roles.has(UserRole.DOCTOR) &&
        roles.has(UserRole.PATIENT) &&
        roles.size === 2;
      if (!isDoctorPatient) {
        throw new BadRequestException(
          'Access actions are only available in doctor-patient chats',
        );
      }

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

    if (type === 'appointment_action') {
      const pair = await this.assertChatParticipants(userId, dto.recipient_id);
      const roles = new Set([pair.sender.role, pair.recipient.role]);
      const isDoctorPatient =
        roles.has(UserRole.DOCTOR) &&
        roles.has(UserRole.PATIENT) &&
        roles.size === 2;
      if (!isDoctorPatient) {
        throw new BadRequestException(
          'Appointment actions are only available in doctor-patient chats',
        );
      }

      const meta = dto.attachment_meta as AppointmentActionMeta | undefined;
      if (!meta?.action || !APPOINTMENT_ACTIONS.includes(meta.action)) {
        throw new BadRequestException('invalid appointment action');
      }
      if (meta.action === 'request') {
        throw new BadRequestException(
          'Use POST /appointments/chat-book to request an appointment',
        );
      }

      await this.assertCanChat(userId, dto.recipient_id);

      const requestCountry = req ? await resolvePricingCountry(req) : null;
      const saved = await this.appointmentsChatService.handleAction(
        userId,
        dto.recipient_id,
        meta,
        requestCountry,
      );
      return this.mapMessage(saved);
    }

    await this.assertCanChat(userId, dto.recipient_id);

    // Doctor↔patient messaging is only open while a consultation is active.
    const { sender, recipient } = await this.assertChatParticipants(
      userId,
      dto.recipient_id,
    );
    if (
      !this.isDoctorDoctorPair(sender, recipient) &&
      !this.involvesAdmin(sender, recipient)
    ) {
      const open = await this.consultationsService.hasOpenBetween(
        userId,
        dto.recipient_id,
      );
      if (!open) {
        throw new ForbiddenException(
          'Start a consultation before sending messages',
        );
      }
    }

    if (
      type === 'text' &&
      sender.role === UserRole.DOCTOR &&
      recipient.role === UserRole.PATIENT
    ) {
      await this.testPatientAi.assertDoctorCanAskTestPatient(
        userId,
        dto.recipient_id,
      );
    }

    const created = this.messageRepo.create({
      type,
      content,
      creator: userId,
      recipient: dto.recipient_id,
      attachment_url: dto.attachment_url?.trim() || null,
      attachment_meta: attachmentMeta,
    });
    const saved = await this.messageRepo.save(created);
    const mapped = this.mapMessage(saved);

    const [senderName, recipientName] = await Promise.all([
      this.usersService.getDisplayName(userId),
      this.usersService.getDisplayName(dto.recipient_id),
    ]);

    const recipientPayload = {
      message: mapped,
      peer_id: userId,
      peer_name: senderName,
    };
    const senderPayload = {
      message: mapped,
      peer_id: dto.recipient_id,
      peer_name: recipientName,
    };

    this.presenceGateway.emitToUser(dto.recipient_id, 'message:new', recipientPayload);
    this.presenceGateway.emitToUser(userId, 'message:new', senderPayload);
    void this.notifyRecipientPush(dto.recipient_id, userId, {
      id: mapped.id,
      type: mapped.type as MessageType,
      content: mapped.content,
    });

    if (
      type === 'text' &&
      sender.role === UserRole.DOCTOR &&
      recipient.role === UserRole.PATIENT &&
      (await this.testPatientAi.isSpecialtyTestPatient(dto.recipient_id))
    ) {
      this.testPatientAi.voidReplyToDoctor(
        userId,
        dto.recipient_id,
        content,
      );
    }

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
        !MEDICAL_LINK_RECORD_TYPES.includes(meta.record_type)
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
        const peer =
          contactById.get(peerId) ??
          (await this.usersService.getContactCard(peerId));
        if (!peer) return null;

        const recentMessages = await this.messageRepo
          .createQueryBuilder('m')
          .where(
            '(m.creator = :userId AND m.recipient = :peerId) OR (m.creator = :peerId AND m.recipient = :userId)',
            { userId, peerId },
          )
          .orderBy('m.datetime', 'DESC')
          .take(30)
          .getMany();

        const validRecent = await stripOrphanedAppointmentMessages(
          recentMessages,
          this.appointmentRepo,
          this.messageRepo,
        );
        const lastMessage = validRecent[0] ?? null;

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
