import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import type { LlmMessage } from './llm/llm.types';

export interface RetrievedChunk {
  entityType: string;
  text: string;
  metadata?: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are a medical records assistant for the 3elagi healthcare platform.

STRICT SAFETY RULES:
- Use ONLY the medical records provided in the context below.
- Never invent patient information, diagnoses, medications, or test results.
- Never prescribe medication or change treatment plans.
- Never provide emergency medical advice. For urgent symptoms, tell the user to contact a doctor or emergency services immediately.
- If the context does not contain the answer, say: "I cannot find that information in your records."
- Be concise, factual, and empathetic.
- Do not reveal data about other patients.

Context from the patient's authorized medical records:
{context}`;

@Injectable()
export class AiPromptService {
  private readonly promptTemplate = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    ['human', '{question}'],
  ]);

  buildContext(chunks: RetrievedChunk[]): string {
    if (!chunks.length) {
      return 'No relevant records were found.';
    }
    return chunks
      .map(
        (chunk, index) =>
          `[Record ${index + 1} | ${chunk.entityType}]\n${chunk.text}`,
      )
      .join('\n\n---\n\n');
  }

  async buildMessages(
    question: string,
    chunks: RetrievedChunk[],
    history: LlmMessage[] = [],
  ): Promise<LlmMessage[]> {
    const context = this.buildContext(chunks);
    const formatted = await this.promptTemplate.formatMessages({
      context,
      question,
    });

    const systemAndUser: LlmMessage[] = formatted.map((msg) => ({
      role: msg._getType() === 'human' ? 'user' : 'system',
      content: String(msg.content),
    }));

    const prior = history.filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    );

    return [...systemAndUser.slice(0, 1), ...prior, ...systemAndUser.slice(1)];
  }
}
