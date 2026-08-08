import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserNotification } from '../entities/user-notification.entity';
import { PresenceGateway } from '../presence/presence.gateway';
import type { InAppNotificationDraft } from './notification-content';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
    private readonly presenceGateway: PresenceGateway,
  ) {}

  async create(draft: InAppNotificationDraft): Promise<UserNotification> {
    const row = this.repo.create({
      user_id: draft.userId,
      type: draft.type,
      title: draft.title,
      body: draft.body,
      data: draft.data,
      read_at: null,
    });
    const saved = await this.repo.save(row);
    const dto = this.toDto(saved);
    this.presenceGateway.emitToUser(draft.userId, 'notification:new', dto);
    return saved;
  }

  async listForUser(userId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);
    const rows = await this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take,
      skip,
    });
    return rows.map((r) => this.toDto(r));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: { user_id: userId, read_at: IsNull() },
    });
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('Notification not found');
    if (!row.read_at) {
      row.read_at = new Date();
      await this.repo.save(row);
    }
    return this.toDto(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ read_at: () => 'NOW()' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
    return { updated: result.affected ?? 0 };
  }

  private toDto(row: UserNotification) {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ?? {},
      read_at: row.read_at ? row.read_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
    };
  }
}
