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

const DEMO_MARKETING_BASE =
  'https://hjluqxfmvpvtjvwzqxgi.supabase.co/storage/v1/object/public/files/static/marketing';

/** Realistic demo imaging uploaded to Supabase (see scripts/upload-test-attachments.mjs). */
const DEMO_TEST_ATTACHMENTS_BASE =
  'https://hjluqxfmvpvtjvwzqxgi.supabase.co/storage/v1/object/public/files/static/test-attachments';

const TEST_CARDIOLOGY_CHEST_XRAY = `${DEMO_TEST_ATTACHMENTS_BASE}/cardiology-chest-xray.png`;
const TEST_DENTISTRY_PANORAMIC = `${DEMO_TEST_ATTACHMENTS_BASE}/dentistry-panoramic-xray.png`;
const TEST_DERMATOLOGY_MOLE_REPORT = `${DEMO_TEST_ATTACHMENTS_BASE}/dermatology-molesafe-report.png`;
const TEST_ORTHOPEDICS_FOREARM_ORIF = `${DEMO_TEST_ATTACHMENTS_BASE}/orthopedics-forearm-orif.png`;

/** Comprehensive metabolic panel on-screen lab report (Wikimedia, CC BY-SA). */
const DEMO_LAB_CMP =
  'https://upload.wikimedia.org/wikipedia/commons/f/f8/CMP_report.JPG';
/** Printed lab report layout (Wikimedia, CC BY-SA). */
const DEMO_LAB_REPORT =
  'https://upload.wikimedia.org/wikipedia/commons/4/40/Gnuhealth_lab_test_report.png';
/** Normal PA chest radiograph (Wikimedia, CC0). */
const DEMO_XRAY_CHEST =
  'https://upload.wikimedia.org/wikipedia/commons/a/a1/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg';
/** Chest X-ray PA view (Wikimedia). */
const DEMO_XRAY_CHEST_ALT =
  'https://upload.wikimedia.org/wikipedia/commons/5/53/X-ray_lung_consolidation.jpg';
/** 3elagi product screenshot — clinical X-ray review. */
const DEMO_XRAY_REVIEW = `${DEMO_MARKETING_BASE}/xray-detail.png`;
/** 3elagi product screenshot — records list with imaging. */
const DEMO_XRAY_RECORDS = `${DEMO_MARKETING_BASE}/xray-record.png`;

/** Demo records per speciality name_en (matches doctor_specialities.name_en). */
export const SPECIALTY_TEST_RECORDS: Record<string, SpecialtyRecordSeed[]> = {
  'General Medicine': [
    {
      type: 'lab' as DocumentType,
      title: 'Complete blood count',
      notes: 'Routine annual check — all values within normal range.',
      body_part: 'general',
      file_url: DEMO_LAB_CMP,
      file_name: 'cbc-results.jpg',
    },
    {
      type: 'xray' as DocumentType,
      title: 'Chest X-ray',
      notes: 'Clear lung fields, no acute findings.',
      body_part: 'chest',
      file_url: DEMO_XRAY_CHEST,
      file_name: 'chest-xray.jpg',
    },
  ],
  Cardiology: [
    {
      type: 'xray' as DocumentType,
      title: 'Chest X-ray',
      notes: 'Cardiomegaly noted — enlarged cardiac silhouette; correlate with echo and BNP.',
      body_part: 'heart',
      file_url: TEST_CARDIOLOGY_CHEST_XRAY,
      file_name: 'cardiology-chest-xray.png',
    },
    {
      type: 'lab' as DocumentType,
      title: 'Lipid panel',
      notes: 'Total cholesterol slightly elevated — lifestyle advice given.',
      body_part: 'heart',
      file_url: DEMO_LAB_REPORT,
      file_name: 'lipid-panel.png',
    },
  ],
  Dermatology: [
    {
      type: 'lab' as DocumentType,
      title: 'Mole analysis report',
      notes:
        '6×7 mm lesion on right lower leg — asymmetry and pigment network; excision recommended (melanoma vs atypical naevus).',
      body_part: 'right_leg',
      file_url: TEST_DERMATOLOGY_MOLE_REPORT,
      file_name: 'dermatology-molesafe-report.png',
    },
  ],
  Pediatrics: [
    {
      type: 'lab' as DocumentType,
      title: 'Pediatric growth chart',
      notes: 'Height and weight tracking at 50th percentile; labs normal.',
      body_part: 'general',
      file_url: DEMO_LAB_CMP,
      file_name: 'growth-chart-labs.jpg',
    },
  ],
  Orthopedics: [
    {
      type: 'xray' as DocumentType,
      title: 'Forearm X-ray — post ORIF',
      notes: 'Radius mid-shaft fracture treated with plate and screws; alignment satisfactory at 6-week follow-up.',
      body_part: 'left_arm',
      file_url: TEST_ORTHOPEDICS_FOREARM_ORIF,
      file_name: 'orthopedics-forearm-orif.png',
    },
  ],
  Neurology: [
    {
      type: 'xray' as DocumentType,
      title: 'Brain MRI summary',
      notes: 'No mass lesion; age-appropriate changes only.',
      body_part: 'head',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'brain-mri-review.png',
    },
  ],
  Ophthalmology: [
    {
      type: 'xray' as DocumentType,
      title: 'Retinal imaging report',
      notes: 'Healthy optic disc, no diabetic retinopathy.',
      body_part: 'eyes',
      file_url: DEMO_XRAY_RECORDS,
      file_name: 'retinal-imaging.png',
    },
  ],
  Dentistry: [
    {
      type: 'xray' as DocumentType,
      title: 'Panoramic dental X-ray',
      notes: 'Full dentition visible; lower-right molar shows prior root canal treatment.',
      body_part: 'head',
      file_url: TEST_DENTISTRY_PANORAMIC,
      file_name: 'dentistry-panoramic-xray.png',
    },
  ],
  Surgery: [
    {
      type: 'xray' as DocumentType,
      title: 'Abdominal ultrasound',
      notes: 'Post-op follow-up — healing well; post-op chest film clear.',
      body_part: 'abdomen',
      file_url: DEMO_XRAY_CHEST,
      file_name: 'post-op-chest-xray.jpg',
    },
  ],
  Emergency: [
    {
      type: 'lab' as DocumentType,
      title: 'Emergency triage labs',
      notes: 'Stable vitals; electrolytes normal.',
      body_part: 'general',
      file_url: DEMO_LAB_CMP,
      file_name: 'triage-labs.jpg',
    },
  ],
  Gynaecology: [
    {
      type: 'xray' as DocumentType,
      title: 'Pelvic ultrasound',
      notes: 'Normal uterine contour, regular cycle.',
      body_part: 'reproductive',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'pelvic-us-report.png',
    },
  ],
  Nutritionist: [
    {
      type: 'lab' as DocumentType,
      title: 'Metabolic panel',
      notes: 'Vitamin D low — supplementation recommended.',
      body_part: 'general',
      file_url: DEMO_LAB_REPORT,
      file_name: 'metabolic-panel.png',
    },
  ],
  ENT: [
    {
      type: 'xray' as DocumentType,
      title: 'Ear examination photo',
      notes: 'Mild otitis externa — topical treatment started.',
      body_part: 'ears',
      file_url: DEMO_XRAY_CHEST_ALT,
      file_name: 'ear-xray.jpg',
    },
    {
      type: 'lab' as DocumentType,
      title: 'Audiometry results',
      notes: 'Bilateral mild high-frequency hearing loss.',
      body_part: 'ears',
      file_url: DEMO_LAB_REPORT,
      file_name: 'audiometry-report.png',
    },
    {
      type: 'xray' as DocumentType,
      title: 'Sinus CT summary',
      notes: 'Chronic sinusitis — follow-up in 4 weeks.',
      body_part: 'throat',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'sinus-imaging.png',
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

export const DEFAULT_TEST_PATIENT_DISPLAY_NAME = '3elagi patient -- default patient';

export const MAX_TEST_PATIENT_DOCTOR_QUESTIONS = 20;

export const TEST_PATIENT_WELCOME_MESSAGE =
  'Hi doctor! I am your AI demo patient. Ask me up to 20 questions about my symptoms and history, request lab or X-ray results like a real consultation, and explore my medical records anytime.';

export const DEFAULT_TEST_PATIENT_PASSWORD = 'TestPatient123!';
