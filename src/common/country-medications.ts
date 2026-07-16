import { EGYPT_MEDICATIONS } from './egypt-medications';
import {
  DEFAULT_PATIENT_COUNTRY,
  normalizePatientCountry,
  patientCountryLabel,
  type PatientCountryCode,
} from './patient-countries';

/**
 * International INN / widely stocked names for markets without a local brand catalog.
 * AI drafts are filtered to this list for those countries.
 */
const INTERNATIONAL_GENERICS = [
  'Paracetamol',
  'Ibuprofen',
  'Aspirin',
  'Amoxicillin',
  'Amoxicillin-Clavulanate',
  'Azithromycin',
  'Ciprofloxacin',
  'Metronidazole',
  'Clarithromycin',
  'Cefuroxime',
  'Omeprazole',
  'Pantoprazole',
  'Esomeprazole',
  'Ranitidine',
  'Domperidone',
  'Metoclopramide',
  'Loperamide',
  'ORS',
  'Salbutamol',
  'Budesonide-Formoterol',
  'Montelukast',
  'Cetirizine',
  'Loratadine',
  'Fexofenadine',
  'Amlodipine',
  'Atenolol',
  'Bisoprolol',
  'Enalapril',
  'Losartan',
  'Furosemide',
  'Spironolactone',
  'Atorvastatin',
  'Rosuvastatin',
  'Metformin',
  'Gliclazide',
  'Insulin Glargine',
  'Insulin Aspart',
  'Levothyroxine',
  'Prednisolone',
  'Dexamethasone',
  'Hydrocortisone cream',
  'Mupirocin',
  'Clotrimazole',
  'Fluconazole',
  'Acyclovir',
  'Diclofenac',
  'Naproxen',
  'Tramadol',
  'Codeine',
  'Morphine',
  'Warfarin',
  'Clopidogrel',
  'Enoxaparin',
  'Vitamin D3',
  'Folic acid',
  'Iron sulfate',
  'Calcium carbonate',
  'Sertraline',
  'Escitalopram',
  'Fluoxetine',
  'Alprazolam',
  'Diazepam',
  'Carbamazepine',
  'Valproate',
  'Levetiracetam',
  'Levodopa-Carbidopa',
] as const;

/** GCC / Levant often stock the same trade names as Egypt. */
const MENA_BRAND_COUNTRIES = new Set<PatientCountryCode>([
  'EG',
  'SA',
  'AE',
  'JO',
  'KW',
  'QA',
  'BH',
  'OM',
  'LB',
  'IQ',
  'LY',
  'SD',
  'MA',
  'TN',
  'DZ',
]);

export function medicationsForCountry(
  country?: string | null,
): readonly string[] {
  const code = normalizePatientCountry(country);
  if (MENA_BRAND_COUNTRIES.has(code)) {
    return EGYPT_MEDICATIONS;
  }
  return INTERNATIONAL_GENERICS;
}

function buildNormalizedMap(list: readonly string[]): Map<string, string> {
  return new Map(
    list.map((name) => [name.toLowerCase().replace(/\s+/g, ' ').trim(), name]),
  );
}

export function matchCountryMedication(
  country: string | null | undefined,
  name: string,
): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const map = buildNormalizedMap(medicationsForCountry(country));
  if (map.has(key)) return map.get(key)!;
  for (const [norm, canonical] of map) {
    if (norm.length < 4) continue;
    if (key.includes(norm) || norm.includes(key)) return canonical;
  }
  return null;
}

export function countryMedicationCatalogForPrompt(
  country?: string | null,
): string {
  return medicationsForCountry(country).join(', ');
}

export function countryDisplayName(
  country?: string | null,
  lang: 'en' | 'ar' = 'en',
): string {
  const code = normalizePatientCountry(country);
  return patientCountryLabel(code, lang);
}

export { DEFAULT_PATIENT_COUNTRY, normalizePatientCountry };
