export type PatientRecentVitals = {
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate_bpm?: number | null;
  weight_kg?: number | null;
  updated_at?: string | null;
};

export function normalizePatientRecentVitals(
  raw: unknown,
): PatientRecentVitals {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const num = (key: string) => {
    const value = source[key];
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const updated =
    typeof source.updated_at === 'string' && source.updated_at.trim()
      ? source.updated_at
      : null;
  return {
    blood_pressure_systolic: num('blood_pressure_systolic'),
    blood_pressure_diastolic: num('blood_pressure_diastolic'),
    heart_rate_bpm: num('heart_rate_bpm'),
    weight_kg: num('weight_kg'),
    updated_at: updated,
  };
}
