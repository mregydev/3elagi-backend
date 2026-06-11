import type { AiContextUser, AiIntent } from './ai-context.types';

/** Extensible context source — add new entities without changing AI core logic. */
export interface AIContextSource {
  readonly name: string;

  /** Whether this source should contribute for the given intent/question. */
  canHandle(question: string, intent: AiIntent): boolean;

  /** Fetch raw data scoped to the authenticated user. */
  fetchContext(user: AiContextUser, question: string): Promise<unknown>;

  /** Format fetched data as prompt-safe text. */
  buildContextText(data: unknown): string;

  /** Version key fragment for cache invalidation when this source's data changes. */
  getVersionKey(user: AiContextUser): Promise<string>;
}
