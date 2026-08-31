/** Presaved doctor profile tags — seeded into doctor_tag_catalog. */
export const COMMON_DOCTOR_TAG_SEEDS = [
  'Arabic',
  'English',
  'French',
  'German',
  'Spanish',
  'Telemedicine',
  'Home visits',
  'Evening appointments',
  'Weekend appointments',
  'Second opinion',
] as const;

export const SPECIALITY_DOCTOR_TAG_SEEDS: Record<string, readonly string[]> = {
  'General Medicine': [
    'Primary care',
    'Chronic disease',
    'Preventive care',
    'Diabetes',
    'Hypertension',
    'Family medicine',
    'Adult medicine',
  ],
  Cardiology: [
    'Heart disease',
    'Hypertension',
    'ECG',
    'Heart failure',
    'Arrhythmia',
    'Chest pain',
    'Cholesterol',
  ],
  Dermatology: [
    'Acne',
    'Eczema',
    'Psoriasis',
    'Skin allergy',
    'Hair loss',
    'Cosmetic dermatology',
    'Pediatric dermatology',
  ],
  Pediatrics: [
    'Newborn care',
    'Child vaccination',
    'Growth monitoring',
    'Pediatric fever',
    'Child nutrition',
    'Developmental screening',
  ],
  Orthopedics: [
    'Joint pain',
    'Sports injuries',
    'Fractures',
    'Back pain',
    'Knee pain',
    'Physical therapy',
    'Arthritis',
  ],
  Neurology: [
    'Headache',
    'Migraine',
    'Epilepsy',
    'Stroke follow-up',
    'Neuropathy',
    'Memory disorders',
    "Parkinson's disease",
  ],
  Ophthalmology: [
    'Cataract',
    'Glaucoma',
    'Dry eye',
    'Vision correction',
    'Diabetic eye disease',
    'Pediatric eye care',
  ],
  Dentistry: [
    'Root canal',
    'Teeth whitening',
    'Orthodontics',
    'Pediatric dentistry',
    'Dental implants',
    'Gum disease',
    'Cosmetic dentistry',
  ],
  Surgery: [
    'General surgery',
    'Laparoscopic surgery',
    'Hernia repair',
    'Gallbladder surgery',
    'Post-operative care',
    'Minor procedures',
  ],
  Emergency: [
    'Urgent care',
    'Trauma',
    'Acute illness',
    'First aid',
    '24/7 availability',
    'Critical care',
  ],
  Gynaecology: [
    'Pregnancy care',
    'Fertility',
    'Menstrual disorders',
    'PCOS',
    'Prenatal care',
    "Women's health",
    'Obstetrics',
  ],
  Nutritionist: [
    'Weight management',
    'Diabetes diet',
    'Sports nutrition',
    'Meal planning',
    'Child nutrition',
    'Bariatric nutrition',
    'Food allergy',
  ],
};

export const MAX_DOCTOR_TAG_LENGTH = 40;

export function normalizeDoctorTagLabel(raw: string): string {
  return raw.trim().slice(0, MAX_DOCTOR_TAG_LENGTH);
}

export function normalizeDoctorTagKey(raw: string): string {
  return normalizeDoctorTagLabel(raw).toLowerCase();
}
