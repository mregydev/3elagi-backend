import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginStat } from '../entities/user-login-stat.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class UserAnalyticsService {
  constructor(
    @InjectRepository(UserLoginStat)
    private statRepo: Repository<UserLoginStat>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  /** Increment login/visit counter — idempotent per call. */
  async recordVisit(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) return;

    const now = new Date();
    const existing = await this.statRepo.findOne({ where: { user_id: userId } });
    if (!existing) {
      await this.statRepo.save(
        this.statRepo.create({
          user_id: user.id,
          email: user.email,
          login_count: 1,
          last_login_at: now,
        }),
      );
      return;
    }

    existing.login_count += 1;
    existing.last_login_at = now;
    existing.email = user.email;
    await this.statRepo.save(existing);
  }

  listLoginStats() {
    return this.statRepo.find({
      order: { login_count: 'DESC', last_login_at: 'DESC' },
    });
  }
}
