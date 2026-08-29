import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DeviceToken,
  type DeviceTokenPlatform,
} from '../entities/device-token.entity';
import { isValidExpoPushToken } from './expo-push.tokens';

@Injectable()
export class DeviceTokensService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,
  ) {}

  async register(
    userId: string,
    token: string,
    platform: DeviceTokenPlatform = 'android',
  ): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) return;
    if (!isValidExpoPushToken(trimmed)) {
      throw new BadRequestException('Invalid Expo push token');
    }

    // Upsert avoids duplicate-key races when the client registers twice in parallel.
    await this.tokenRepo.upsert(
      {
        user_id: userId,
        token: trimmed,
        platform,
      },
      {
        conflictPaths: ['user_id', 'token'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
  }

  async remove(userId: string, token: string): Promise<void> {
    const trimmed = token.trim();
    if (!trimmed) return;
    await this.tokenRepo.delete({ user_id: userId, token: trimmed });
  }

  async listTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.tokenRepo.find({
      where: { user_id: userId },
      select: ['token'],
    });
    return rows.map((row) => row.token);
  }

  async removeInvalidTokens(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await this.tokenRepo.delete({ token: In(tokens) });
  }
}
