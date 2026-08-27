import { Injectable } from '@nestjs/common';
import type { AIContextSource } from '../ai-context-source.interface';
import type { AiContextUser, AiIntent } from '../ai-context.types';
import { UserRole } from '../../../entities/user.entity';

@Injectable()
export class GeneralKnowledgeContextSource implements AIContextSource {
  readonly name = 'general_knowledge';
  readonly guestSafe = true;

  canHandle(_question: string, intent: AiIntent): boolean {
    return (
      intent === 'general_medical_question' ||
      intent === 'health_recommendation_question' ||
      intent === 'doctor_coaching_question' ||
      intent === 'mixed_question'
    );
  }

  async fetchContext(user: AiContextUser): Promise<{ isDoctor: boolean }> {
    return { isDoctor: user.role === UserRole.DOCTOR };
  }

  buildContextText(data: { isDoctor: boolean }): string {
    const medications = data.isDoctor
      ? 'You may suggest medications and typical dosages as clinical reference, but the doctor confirms and prescribes. When a practice-country medication catalog is in context, prefer brand names from that market.'
      : 'Medication Q&A is doctor-only. For patients: do NOT answer questions about medications, drugs, doses, side effects, or drug classes — refuse and direct them to a licensed doctor (booking or chat consultation).';
    return `[General Medical Knowledge]
You may use your general medical education to answer health education questions.
Always append: "This is general medical information and not a diagnosis."
Never diagnose with certainty. ${medications}`;
  }

  async getVersionKey(user: AiContextUser): Promise<string> {
    return `general:v5:${user.role === UserRole.DOCTOR ? 'doctor' : 'patient'}`;
  }
}
