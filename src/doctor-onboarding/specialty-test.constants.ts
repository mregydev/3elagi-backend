import type { MedicalBodyPart } from '../common/medical-body-part';
import type { DocumentType } from '../entities/medical-document.entity';

export type SpecialtyRecordSeed = {
  type: DocumentType;
  title: string;
  notes: string;
  body_part: MedicalBodyPart;
  file_url: string;
  file_name: string;
};

const SAMPLE_XRAY =
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop';
const SAMPLE_LAB =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop';
const SAMPLE_SCAN =
  'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop';

/** Demo records per speciality name_en (matches doctor_specialities.name_en). */
export const SPECIALTY_TEST_RECORDS: Record<string, SpecialtyRecordSeed[]> = {
  'General Medicine': [
    {
      type: 'lab' as DocumentType,
      title: 'Complete blood count',
      notes: 'Routine annual check — all values within normal range.',
      body_part: 'general',
      file_url: SAMPLE_LAB,
      file_name: 'cbc-results.jpg',
    },
    {
      type: 'xray' as DocumentType,
      title: 'Chest X-ray',
      notes: 'Clear lung fields, no acute findings.',
      body_part: 'chest',
      file_url: SAMPLE_XRAY,
      file_name: 'chest-xray.jpg',
    },
  ],
  Cardiology: [
    {
      type: 'xray' as DocumentType,
      title: 'Echocardiogram snapshot',
      notes: 'Normal ejection fraction, mild trace regurgitation.',
      body_part: 'heart',
      file_url: SAMPLE_SCAN,
      file_name: 'echo.jpg',
    },
    {
      type: 'lab' as DocumentType,
      title: 'Lipid panel',
      notes: 'Total cholesterol slightly elevated — lifestyle advice given.',
      body_part: 'heart',
      file_url: SAMPLE_LAB,
      file_name: 'lipid-panel.jpg',
    },
  ],
  Dermatology: [
    {
      type: 'xray' as DocumentType,
      title: 'Dermoscopy — forearm lesion',
      notes: 'Benign-appearing macule, monitor in 6 months.',
      body_part: 'left_arm',
      file_url: SAMPLE_SCAN,
      file_name: 'dermoscopy.jpg',
    },
  ],
  Pediatrics: [
    {
      type: 'lab' as DocumentType,
      title: 'Pediatric growth chart',
      notes: 'Height and weight tracking at 50th percentile.',
      body_part: 'general',
      file_url: SAMPLE_LAB,
      file_name: 'growth-chart.jpg',
    },
  ],
  Orthopedics: [
    {
      type: 'xray' as DocumentType,
      title: 'Left knee X-ray',
      notes: 'Mild osteoarthritis, no fracture.',
      body_part: 'left_leg',
      file_url: SAMPLE_XRAY,
      file_name: 'knee-xray.jpg',
    },
  ],
  Neurology: [
    {
      type: 'xray' as DocumentType,
      title: 'Brain MRI summary',
      notes: 'No mass lesion; age-appropriate changes only.',
      body_part: 'head',
      file_url: SAMPLE_SCAN,
      file_name: 'brain-mri.jpg',
    },
  ],
  Ophthalmology: [
    {
      type: 'xray' as DocumentType,
      title: 'Retinal fundus photo',
      notes: 'Healthy optic disc, no diabetic retinopathy.',
      body_part: 'eyes',
      file_url: SAMPLE_SCAN,
      file_name: 'fundus.jpg',
    },
  ],
  Dentistry: [
    {
      type: 'xray' as DocumentType,
      title: 'Panoramic dental X-ray',
      notes: 'Wisdom teeth erupted; no caries on molars.',
      body_part: 'head',
      file_url: SAMPLE_XRAY,
      file_name: 'dental-pano.jpg',
    },
  ],
  Surgery: [
    {
      type: 'xray' as DocumentType,
      title: 'Abdominal ultrasound',
      notes: 'Post-op follow-up — healing well.',
      body_part: 'abdomen',
      file_url: SAMPLE_SCAN,
      file_name: 'abdominal-us.jpg',
    },
  ],
  Emergency: [
    {
      type: 'lab' as DocumentType,
      title: 'Emergency triage labs',
      notes: 'Stable vitals; electrolytes normal.',
      body_part: 'general',
      file_url: SAMPLE_LAB,
      file_name: 'triage-labs.jpg',
    },
  ],
  Gynaecology: [
    {
      type: 'xray' as DocumentType,
      title: 'Pelvic ultrasound',
      notes: 'Normal uterine contour, regular cycle.',
      body_part: 'reproductive',
      file_url: SAMPLE_SCAN,
      file_name: 'pelvic-us.jpg',
    },
  ],
  Nutritionist: [
    {
      type: 'lab' as DocumentType,
      title: 'Metabolic panel',
      notes: 'Vitamin D low — supplementation recommended.',
      body_part: 'general',
      file_url: SAMPLE_LAB,
      file_name: 'metabolic-panel.jpg',
    },
  ],
  ENT: [
    {
      type: 'xray' as DocumentType,
      title: 'Ear examination photo',
      notes: 'Mild otitis externa — topical treatment started.',
      body_part: 'ears',
      file_url: SAMPLE_SCAN,
      file_name: 'ear-exam.jpg',
    },
    {
      type: 'lab' as DocumentType,
      title: 'Audiometry results',
      notes: 'Bilateral mild high-frequency hearing loss.',
      body_part: 'ears',
      file_url: SAMPLE_LAB,
      file_name: 'audiometry.jpg',
    },
    {
      type: 'xray' as DocumentType,
      title: 'Sinus CT summary',
      notes: 'Chronic sinusitis — follow-up in 4 weeks.',
      body_part: 'throat',
      file_url: SAMPLE_XRAY,
      file_name: 'sinus-ct.jpg',
    },
  ],
};

export function specialtyEmailSlug(nameEn: string): string {
  return nameEn
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function testPatientEmail(nameEn: string): string {
  return `test.${specialtyEmailSlug(nameEn)}@3elagi.patient`;
}

export const TEST_PATIENT_WELCOME_MESSAGE =
  'Hi doctor! I am your test account. Open my medical records to explore sample files and attachments for your specialty.';

export const DEFAULT_TEST_PATIENT_PASSWORD = 'TestPatient123!';
