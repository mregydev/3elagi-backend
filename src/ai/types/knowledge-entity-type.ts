export const KNOWLEDGE_ENTITY_TYPES = [
  'patient_profile',
  'doctor_profile',
  'diagnosis',
  'lab_result',
  'imaging',
  'prescription',
  'allergy',
  'doctor_note',
  'consultation_summary',
  'medical_record',
] as const;

export type KnowledgeEntityType = (typeof KNOWLEDGE_ENTITY_TYPES)[number];
