/** Common doctor profile tags — seeded into doctor_tag_catalog (language, availability, etc.). */
export const COMMON_DOCTOR_TAG_SEEDS = [
  'Arabic',
  'English',
  'French',
  'German',
  'Spanish',
  'Telemedicine',
  'Evening appointments',
  'Weekend appointments',
  'Second opinion',
] as const;

/** @deprecated Legacy alias — subspecialties now live in subspecialty-seeds.ts */
export { SUBSPECIALTY_SEEDS as SPECIALITY_DOCTOR_TAG_SEEDS } from './subspecialty-seeds';

export const MAX_DOCTOR_TAG_LENGTH = 40;

export function normalizeDoctorTagLabel(raw: string): string {
  return raw.trim().slice(0, MAX_DOCTOR_TAG_LENGTH);
}

export function normalizeDoctorTagKey(raw: string): string {
  return normalizeDoctorTagLabel(raw).toLowerCase();
}
