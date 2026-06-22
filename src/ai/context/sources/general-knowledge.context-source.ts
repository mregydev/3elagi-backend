import { Injectable } from '@nestjs/common';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';

@Injectable()
export class GeneralKnowledgeContextSource implements AIContextSource {
  readonly name = 'general_knowledge';

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'general_medical_question' ||
      intent === 'health_recommendation_question' ||
      intent === 'doctor_coaching_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(): Promise<{ enabled: true }> {
    return { enabled: true };
  }

  buildContextText(): string {
    return `[General Medical Knowledge]
You may use your general medical education to answer health education questions.
Always append: "This is general medical information and not a diagnosis."
Never diagnose with certainty. Never prescribe medication or dosages.`;
  }

  async getVersionKey(): Promise<string> {
    return 'general:v1';
  }
}
