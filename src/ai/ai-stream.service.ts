import { Inject, Injectable } from '@nestjs/common';
import type { LlmMessage } from './llm/llm.types';
import type { LlmProvider } from './llm/llm.types';
import { LLM_PROVIDER } from './llm/llm.tokens';
import { withTimeout } from './utils/with-timeout';

const LLM_TIMEOUT_MS = 30_000;

@Injectable()
export class AiStreamService {
  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  async *streamTokens(messages: LlmMessage[]): AsyncGenerator<string> {
    const started = Date.now();
    for await (const token of this.llm.streamChat(messages)) {
      if (Date.now() - started > LLM_TIMEOUT_MS) {
        throw new Error('AI response timed out');
      }
      yield token;
    }
  }

  async complete(messages: LlmMessage[]): Promise<string> {
    return withTimeout(
      this.llm.chat(messages),
      LLM_TIMEOUT_MS,
      'llm.chat',
    );
  }
}
