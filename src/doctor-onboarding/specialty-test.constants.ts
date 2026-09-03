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
      title: 'Echocardiogram snapshot',
      notes: 'Normal ejection fraction, mild trace regurgitation.',
      body_part: 'heart',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'echo-review.png',
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
      type: 'xray' as DocumentType,
      title: 'Dermoscopy — forearm lesion',
      notes: 'Benign-appearing macule, monitor in 6 months.',
      body_part: 'left_arm',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'dermoscopy-imaging.png',
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
      title: 'Left knee X-ray',
      notes: 'Mild osteoarthritis, no fracture.',
      body_part: 'left_leg',
      file_url: DEMO_XRAY_CHEST_ALT,
      file_name: 'knee-xray.jpg',
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
      notes: 'Wisdom teeth erupted; no caries on molars.',
      body_part: 'head',
      file_url: DEMO_XRAY_CHEST,
      file_name: 'dental-pano.jpg',
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

export const TEST_PATIENT_WELCOME_MESSAGE =
  'Hi doctor! I am your test account. Open my medical records to explore sample lab results and X-ray attachments for your specialty.';

export const DEFAULT_TEST_PATIENT_PASSWORD = 'TestPatient123!';
