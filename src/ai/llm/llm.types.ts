export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
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
