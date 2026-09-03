import { Doctor } from '../entities/doctor.entity';

/** Speciality ids with the primary (`speciality_id`) first. */
export function sortPrimaryFirst(doctor: Doctor): string[] {
  const linked = (doctor.specialities ?? []).map((s) => s.id);
  const primary = doctor.speciality_id;
  const rest = linked.filter((id) => id !== primary);
  return primary ? [primary, ...rest] : rest;
}
