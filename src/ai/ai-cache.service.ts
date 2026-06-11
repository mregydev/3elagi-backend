import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { normalizeQuestion } from './knowledge-text.builder';

interface CachePayload<T> {
  value: T;
  storedAt: number;
}

@Injectable()
export class AiCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AiCacheService.name);
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, CachePayload<unknown>>();
  private readonly ttlSeconds: number;
  private knowledgeBaseVersion = 1;

  constructor(private readonly config: ConfigService) {
    this.ttlSeconds = Number(this.config.get('AI_CACHE_TTL_SECONDS') ?? 3600);
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
      this.redis.on('error', (err) =>
        this.logger.warn(`Redis error: ${err.message}`),
      );
    } else {
      this.redis = null;
      this.logger.log('REDIS_URL not set; using in-memory AI cache');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  getKnowledgeBaseVersion(): number {
    return this.knowledgeBaseVersion;
  }

  async bumpKnowledgeBaseVersion(patientUserId?: string): Promise<void> {
    this.knowledgeBaseVersion += 1;
    if (patientUserId) {
      await this.invalidatePatient(patientUserId);
    } else {
      await this.invalidateAll();
    }
  }

  buildKey(
    userId: string,
    role: string,
    question: string,
    suffix: 'response' | 'retrieval',
  ): string {
    const normalized = normalizeQuestion(question);
    return `ai:${suffix}:${userId}:${role}:${this.knowledgeBaseVersion}:${normalized}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this.ttlSeconds * 1000) {
      this.memory.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.redis) {
      await this.redis.set(key, JSON.stringify(value), 'EX', this.ttlSeconds);
      return;
    }
    this.memory.set(key, { value, storedAt: Date.now() });
  }

  async invalidatePatient(patientUserId: string): Promise<void> {
    const pattern = `ai:*:${patientUserId}:*`;
    await this.deleteByPattern(pattern);
    const pattern2 = `ai:*:*:*`;
    void pattern2;
    const prefix = `ai:`;
    if (this.redis) {
      const keys = await this.redis.keys(`ai:*`);
      const toDelete = keys.filter((k) => k.includes(patientUserId));
      if (toDelete.length) await this.redis.del(...toDelete);
    } else {
      for (const key of [...this.memory.keys()]) {
        if (key.startsWith(prefix) && key.includes(patientUserId)) {
          this.memory.delete(key);
        }
      }
    }
  }

  async invalidateAll(): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys('ai:*');
      if (keys.length) await this.redis.del(...keys);
    } else {
      for (const key of [...this.memory.keys()]) {
        if (key.startsWith('ai:')) this.memory.delete(key);
      }
    }
  }

  private async deleteByPattern(_pattern: string): Promise<void> {
    // Pattern deletion handled in invalidatePatient via keys scan.
  }
}
