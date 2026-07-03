export const KNOWLEDGE_ENTITY_TYPES = [
  'patient_profile',
  'doctor_profile',
  'doctor_directory',
  'speciality_catalog',
  'admin_knowledge',
  'diagnosis',
  'lab_result',
  'imaging',
  'prescription',
  'allergy',
  'doctor_note',
  'consultation_summary',
  'medical_record',
] as const;

export const PLATFORM_KNOWLEDGE_SCOPE = 'platform';

export type KnowledgeEntityType = (typeof KNOWLEDGE_ENTITY_TYPES)[number];
