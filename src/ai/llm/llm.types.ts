export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessageAttachment {
  /** Base64 payload (no `data:` prefix). */
  data: string;
  /** e.g. image/jpeg, image/png, application/pdf */
  mimeType: string;
}

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  /** Optional multimodal attachment (image or PDF) for the current turn. */
  attachment?: LlmMessageAttachment;
}

export interface LlmProvider {
  readonly modelName: string;
  chat(messages: LlmMessage[]): Promise<string>;
  streamChat(messages: LlmMessage[]): AsyncIterable<string>;
}

export interface EmbeddingsProvider {
  readonly modelName: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}
