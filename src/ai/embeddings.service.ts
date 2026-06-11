import { Inject, Injectable } from '@nestjs/common';
import type { EmbeddingsProvider } from './llm/llm.types';
import { GeminiEmbeddingsProvider } from './llm/gemini.provider';

export const EMBEDDINGS_PROVIDER = 'EMBEDDINGS_PROVIDER';

@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(EMBEDDINGS_PROVIDER)
    private readonly provider: EmbeddingsProvider,
  ) {}

  get dimensions(): number {
    return this.provider.dimensions;
  }

  embedQuery(text: string): Promise<number[]> {
    return this.provider.embedQuery(text);
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.provider.embedDocuments(texts);
  }
}

export const embeddingsProviderFactory = {
  provide: EMBEDDINGS_PROVIDER,
  useClass: GeminiEmbeddingsProvider,
};
