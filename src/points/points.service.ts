import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { DEFAULT_MESSAGE_POINTS } from './points.constants';
import { clampDoctorMessagePrice } from './message-price.constants';

export interface UserPointsSummary {
  message_points: number;
  points_reserved: number;
  points_spent_total: number;
  points_purchased_total: number;
}

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Doctor) private doctorRepo: Repository<Doctor>,
    private dataSource: DataSource,
  ) {}

  async resolveMessageCostForRecipient(recipientUserId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: recipientUserId } });
    if (!user || user.role !== UserRole.DOCTOR) return 1;
    const doctor = await this.doctorRepo.findOne({ where: { user_id: recipientUserId } });
    return clampDoctorMessagePrice(doctor?.message_price ?? 1);
  }

  mapSummary(user: User): UserPointsSummary {
    return {
      message_points:
        user.message_points != null ? user.message_points : DEFAULT_MESSAGE_POINTS,
      points_reserved: user.points_reserved ?? 0,
      points_spent_total: user.points_spent_total ?? 0,
      points_purchased_total: user.points_purchased_total ?? 0,
    };
  }

  async getSummary(userId: string): Promise<UserPointsSummary> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.mapSummary(user);
  }

  async deductForMessage(
    userId: string,
    cost = 1,
    costSubject: 'message' | 'operation' = 'message',
  ): Promise<UserPointsSummary> {
    const messageCost = Math.max(1, Math.min(5, Math.floor(Number(cost) || 1)));
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if ((user.message_points ?? 0) < messageCost) {
        const detail =
          costSubject === 'operation'
            ? `This operation requires ${messageCost} point${messageCost === 1 ? '' : 's'}`
            : `This message costs ${messageCost} point${messageCost === 1 ? '' : 's'}`;
        throw new ForbiddenException(`Insufficient message points. ${detail}`);
      }

      user.message_points -= messageCost;
      user.points_spent_total = (user.points_spent_total ?? 0) + messageCost;
      const saved = await manager.getRepository(User).save(user);
      return this.mapSummary(saved);
    });
  }

  /** Hold points for an open consultation: move from balance into reserved. */
  async reservePoints(userId: string, amount: number): Promise<UserPointsSummary> {
    const cost = Math.max(1, Math.floor(Number(amount) || 1));
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if ((user.message_points ?? 0) < cost) {
        throw new ForbiddenException(
          `Insufficient points. Starting a consultation requires ${cost} point${cost === 1 ? '' : 's'}`,
        );
      }

      user.message_points -= cost;
      user.points_reserved = (user.points_reserved ?? 0) + cost;
      const saved = await manager.getRepository(User).save(user);
      return this.mapSummary(saved);
    });
  }

  /** Settle a consultation as completed: reserved points are spent for good. */
  async consumeReserved(userId: string, amount: number): Promise<UserPointsSummary> {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      const release = Math.min(cost, user.points_reserved ?? 0);
      user.points_reserved = (user.points_reserved ?? 0) - release;
      user.points_spent_total = (user.points_spent_total ?? 0) + release;
      const saved = await manager.getRepository(User).save(user);
      return this.mapSummary(saved);
    });
  }

  /** Cancel a consultation: reserved points go back to the balance. */
  async refundReserved(userId: string, amount: number): Promise<UserPointsSummary> {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      const release = Math.min(cost, user.points_reserved ?? 0);
      user.points_reserved = (user.points_reserved ?? 0) - release;
      user.message_points = (user.message_points ?? 0) + release;
      const saved = await manager.getRepository(User).save(user);
      return this.mapSummary(saved);
    });
  }

  async addPoints(userId: string, amount: number): Promise<UserPointsSummary> {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    if (amount > 10000) {
      throw new BadRequestException('Amount cannot exceed 10000');
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');

      user.message_points = (user.message_points ?? 0) + amount;
      user.points_purchased_total = (user.points_purchased_total ?? 0) + amount;
      const saved = await manager.getRepository(User).save(user);
      return this.mapSummary(saved);
    });
  }
}
