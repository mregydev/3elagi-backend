import { GoogleGenerativeAI, type GenerativeModel, TaskType } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type {
  EmbeddingsProvider,
  LlmMessage,
  LlmProvider,
} from './llm.types';
import { throwFriendlyGeminiError } from './gemini-errors';

function toLangChainMessages(messages: LlmMessage[]) {
  return messages.map((m) => {
    if (m.role === 'system') return new SystemMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    return new HumanMessage(m.content);
  });
}

const EMBEDDING_DIMENSIONS = 768;
/** Gemini 2.5 Flash — current Flash model (1.5 Flash was retired by Google). */
const DEFAULT_CHAT_MODEL = 'gemini-2.5-flash';
/** text-embedding-004 is unavailable on many API keys; gemini-embedding-001 works with 768-dim output. */
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

@Injectable()
export class GeminiLlmProvider implements LlmProvider {
  readonly modelName: string;
  private readonly logger = new Logger(GeminiLlmProvider.name);
  private readonly chatModel: ChatGoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set; AI chat will fail until configured');
    }
    this.modelName =
      this.config.get<string>('GEMINI_CHAT_MODEL') ?? DEFAULT_CHAT_MODEL;
    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: apiKey ?? '',
      model: this.modelName,
      temperature: 0.2,
      maxRetries: 0,
    });
    this.logger.log(`Gemini chat model: ${this.modelName}`);
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    try {
      const response = await this.chatModel.invoke(
        toLangChainMessages(messages),
      );
      return typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    } catch (err) {
      throwFriendlyGeminiError(err, this.modelName);
    }
  }

  async *streamChat(messages: LlmMessage[]): AsyncIterable<string> {
    let stream;
    try {
      stream = await this.chatModel.stream(toLangChainMessages(messages));
    } catch (err) {
      throwFriendlyGeminiError(err, this.modelName);
    }
    for await (const chunk of stream) {
      const text =
        typeof chunk.content === 'string'
          ? chunk.content
          : Array.isArray(chunk.content)
            ? chunk.content
                .map((part) =>
                  typeof part === 'string'
                    ? part
                    : 'text' in part
                      ? String(part.text)
                      : '',
                )
                .join('')
            : '';
      if (text) yield text;
    }
  }
}

@Injectable()
export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  readonly modelName: string;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private readonly logger = new Logger(GeminiEmbeddingsProvider.name);
  private readonly model: GenerativeModel;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set; embeddings will fail until configured');
    }
    this.modelName =
      this.config.get<string>('GEMINI_EMBEDDING_MODEL') ??
      DEFAULT_EMBEDDING_MODEL;
    const genAI = new GoogleGenerativeAI(apiKey ?? '');
    this.model = genAI.getGenerativeModel({ model: this.modelName });
    this.logger.log(`Gemini embedding model: ${this.modelName} (${EMBEDDING_DIMENSIONS} dims)`);
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embedOne(text, TaskType.RETRIEVAL_QUERY);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(
      texts.map((text) => this.embedOne(text, TaskType.RETRIEVAL_DOCUMENT)),
    );
  }

  private async embedOne(text: string, taskType: TaskType): Promise<number[]> {
    const response = await this.model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    } as Parameters<GenerativeModel['embedContent']>[0]);
    const values = response.embedding.values ?? [];
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dim embedding, got ${values.length}`,
      );
    }
    return values;
  }
}
