import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { normalizeQuestion } from './knowledge-text.builder';
import { AI_PROMPT_VERSION } from './ai-context-builder.service';

interface CachePayload<T> {
  value: T;
  storedAt: number;
}

@Injectable()
export class AiCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AiCacheService.name);
  private readonly memory = new Map<string, CachePayload<unknown>>();
  private readonly ttlSeconds: number;
  private readonly redis: Redis | null;
  private knowledgeBaseVersion = 1;

  constructor(private readonly config: ConfigService) {
    this.ttlSeconds = Number(this.config.get('AI_CACHE_TTL_SECONDS') ?? 3600);
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
      this.logger.log('AI cache: Redis');
    } else {
      this.redis = null;
      this.logger.log('AI cache: in-memory fallback (set REDIS_URL for production)');
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

  /** Legacy key format (retrieval/response). */
  buildKey(
    userId: string,
    role: string,
    question: string,
    suffix: 'response' | 'retrieval',
  ): string {
    const normalized = normalizeQuestion(question);
    return `ai:${suffix}:${userId}:${role}:${this.knowledgeBaseVersion}:${normalized}`;
  }

  /** Spec cache key — scoped per user role and patient context. */
  buildAnswerKey(
    patientId: string,
    question: string,
    contextVersion: string,
    promptVersion: string = AI_PROMPT_VERSION,
    userRole?: string,
  ): string {
    const hash = createHash('sha256')
      .update(normalizeQuestion(question))
      .digest('hex')
      .slice(0, 24);
    const rolePart = userRole ?? 'unknown';
    return `ai:answer:${patientId}:${rolePart}:${hash}:${contextVersion}:${promptVersion}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw) as T;
      } catch (err) {
        this.logger.warn(`Redis get failed: ${(err as Error).message}`);
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
      try {
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(value));
        return;
      } catch (err) {
        this.logger.warn(`Redis set failed: ${(err as Error).message}`);
      }
    }
    this.memory.set(key, { value, storedAt: Date.now() });
  }

  async invalidatePatient(patientUserId: string): Promise<void> {
    await this.deleteByPattern(`*${patientUserId}*`);
  }

  async invalidateAll(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys('ai:*');
        if (keys.length) await this.redis.del(...keys);
      } catch (err) {
        this.logger.warn(`Redis invalidateAll failed: ${(err as Error).message}`);
      }
    }
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith('ai:')) this.memory.delete(key);
    }
  }

  private async deleteByPattern(fragment: string): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`ai:*${fragment}*`);
        if (keys.length) await this.redis.del(...keys);
      } catch (err) {
        this.logger.warn(`Redis pattern delete failed: ${(err as Error).message}`);
      }
    }
    for (const key of [...this.memory.keys()]) {
      if (key.includes(fragment)) this.memory.delete(key);
    }
  }
}
