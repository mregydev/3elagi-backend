import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { DEFAULT_MESSAGE_POINTS } from './points.constants';

export interface UserPointsSummary {
  message_points: number;
  points_spent_total: number;
  points_purchased_total: number;
}

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  mapSummary(user: User): UserPointsSummary {
    return {
      message_points:
        user.message_points != null ? user.message_points : DEFAULT_MESSAGE_POINTS,
      points_spent_total: user.points_spent_total ?? 0,
      points_purchased_total: user.points_purchased_total ?? 0,
    };
  }

  async getSummary(userId: string): Promise<UserPointsSummary> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.mapSummary(user);
  }

  async deductForMessage(userId: string): Promise<UserPointsSummary> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOne();

      if (!user) throw new NotFoundException('User not found');
      if ((user.message_points ?? 0) < 1) {
        throw new ForbiddenException('Insufficient message points');
      }

      user.message_points -= 1;
      user.points_spent_total = (user.points_spent_total ?? 0) + 1;
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
