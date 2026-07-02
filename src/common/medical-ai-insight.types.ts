/** AI-generated insight stored on medical records (documents, diagnoses, prescriptions). */
export interface MedicalAiInsight {
  description: string;
  possible_diseases: string;
}

export function normalizeMedicalAiInsight(raw: unknown): MedicalAiInsight | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const description = String(
    source.description ?? source.summary ?? '',
  ).trim();
  const possible_diseases = String(
    source.possible_diseases ?? source.possibleDiseases ?? source.diseases ?? '',
  ).trim();
  if (!description && !possible_diseases) return null;
  return { description, possible_diseases };
}
