/** Fixed body-part taxonomy for medical records (matches mobile). */
export const MEDICAL_BODY_PARTS = [
  'general',
  'head',
  'neck',
  'chest',
  'abdomen',
  'back',
  'pelvis',
  'left_arm',
  'right_arm',
  'left_hand',
  'right_hand',
  'left_leg',
  'right_leg',
  'left_foot',
  'right_foot',
] as const;

export type MedicalBodyPart = (typeof MEDICAL_BODY_PARTS)[number];

export function normalizeBodyPart(
  value: unknown,
): MedicalBodyPart | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return (MEDICAL_BODY_PARTS as readonly string[]).includes(cleaned)
    ? (cleaned as MedicalBodyPart)
    : null;
}
