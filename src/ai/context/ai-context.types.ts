export type AiIntent =
  | 'patient_profile_question'
  | 'doctor_profile_question'
  | 'doctor_practice_question'
  | 'medical_record_question'
  | 'doctor_recommendation_question'
  | 'health_recommendation_question'
  | 'doctor_coaching_question'
  | 'general_medical_question'
  | 'mixed_question';

import type { AiLinkEntry } from '../ai-response.service';

export interface AiContextUser {
  id: string;
  role: string;
  /** Authenticated patient scope (always set for patients; optional for doctors). */
  patientContextId: string | null;
  preferredLocale: 'ar' | 'en' | 'de' | 'es';
  /**
   * Logged-out free-tier visitor. `id` is a `guest:<session>` string, not a
   * user UUID, so every personal-data lookup must be skipped for them.
   */
  isGuest?: boolean;
}

export interface AiContextBuildResult {
  intent: AiIntent;
  contextText: string;
  chunks: import('../ai-prompt.service').RetrievedChunk[];
  links: AiLinkEntry[];
  contextVersion: string;
  promptVersion: string;
  urgent: boolean;
  urgentMessage?: string;
}
