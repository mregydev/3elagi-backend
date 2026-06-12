export type AiIntent =
  | 'patient_profile_question'
  | 'doctor_profile_question'
  | 'doctor_practice_question'
  | 'medical_record_question'
  | 'doctor_recommendation_question'
  | 'general_medical_question'
  | 'mixed_question';

export interface AiContextUser {
  id: string;
  role: string;
  /** Authenticated patient scope (always set for patients; optional for doctors). */
  patientContextId: string | null;
}

export interface AiContextBuildResult {
  intent: AiIntent;
  contextText: string;
  chunks: import('../ai-prompt.service').RetrievedChunk[];
  contextVersion: string;
  promptVersion: string;
  urgent: boolean;
  urgentMessage?: string;
}
