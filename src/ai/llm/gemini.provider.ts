import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type {
  EmbeddingsProvider,
  LlmMessage,
  LlmProvider,
} from './llm.types';

function toLangChainMessages(messages: LlmMessage[]) {
  return messages.map((m) => {
    if (m.role === 'system') return new SystemMessage(m.content);
    if (m.role === 'assistant') return new AIMessage(m.content);
    return new HumanMessage(m.content);
  });
}

const EMBEDDING_DIMENSIONS = 768;
const DEFAULT_CHAT_MODEL = 'gemini-1.5-flash';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-004';

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
    });
    this.logger.log(`Gemini chat model: ${this.modelName}`);
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    const response = await this.chatModel.invoke(toLangChainMessages(messages));
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  async *streamChat(messages: LlmMessage[]): AsyncIterable<string> {
    const stream = await this.chatModel.stream(toLangChainMessages(messages));
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
  readonly modelName = DEFAULT_EMBEDDING_MODEL;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private readonly logger = new Logger(GeminiEmbeddingsProvider.name);
  private readonly embeddings: GoogleGenerativeAIEmbeddings;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set; embeddings will fail until configured');
    }
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey ?? '',
      model:
        this.config.get<string>('GEMINI_EMBEDDING_MODEL') ??
        DEFAULT_EMBEDDING_MODEL,
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
