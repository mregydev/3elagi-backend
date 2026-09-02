import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingsProvider } from './llm/llm.types';
import { GeminiEmbeddingsProvider } from './llm/gemini.provider';
import { TimeoutError, withTimeout } from './utils/with-timeout';

export const EMBEDDINGS_PROVIDER = 'EMBEDDINGS_PROVIDER';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly timeoutMs: number;

  constructor(
    @Inject(EMBEDDINGS_PROVIDER)
    private readonly provider: EmbeddingsProvider,
    config: ConfigService,
  ) {
    this.timeoutMs = Number(config.get('GEMINI_EMBED_TIMEOUT_MS') ?? 60_000);
  }

  private async withEmbedTimeout<T>(
    operation: () => Promise<T>,
    label: string,
  ): Promise<T> {
    try {
      return await withTimeout(operation(), this.timeoutMs, label);
    } catch (err) {
      if (!(err instanceof TimeoutError)) throw err;
      this.logger.warn(`${label} timed out; retrying once`);
      return withTimeout(operation(), this.timeoutMs, label);
    }
  }

  get dimensions(): number {
    return this.provider.dimensions;
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      return await this.withEmbedTimeout(
        () => this.provider.embedQuery(text),
        'embedQuery',
      );
    } catch (err) {
      this.logger.warn(
        `embedQuery failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      return await this.withEmbedTimeout(
        () => this.provider.embedDocuments(texts),
        'embedDocuments',
      );
    } catch (err) {
      this.logger.warn(
        `embedDocuments failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}

export const embeddingsProviderFactory = {
  provide: EMBEDDINGS_PROVIDER,
  useClass: GeminiEmbeddingsProvider,
};
