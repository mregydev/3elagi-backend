import type { MedicalBodyPart } from '../common/medical-body-part';
import type { MedicalAiInsight } from '../common/medical-ai-insight.types';
import type { DocumentType } from '../entities/medical-document.entity';

export type SpecialtyRecordSeed = {
  type: DocumentType;
  title: string;
  notes: string;
  body_part: MedicalBodyPart;
  file_url: string;
  file_name: string;
  ai_insight?: MedicalAiInsight;
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
const TEST_ENT_SINUS_WATERS_VIEW = `${DEMO_TEST_ATTACHMENTS_BASE}/ent-sinus-waters-view.png`;
const TEST_ENT_IAC_MRI = `${DEMO_TEST_ATTACHMENTS_BASE}/ent-iac-mri.png`;

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
    {
      type: 'xray' as DocumentType,
      title: 'Skin mapping overview',
      notes: 'Full-body dermoscopy map — two lesions flagged for follow-up.',
      body_part: 'general',
      file_url: DEMO_XRAY_REVIEW,
      file_name: 'dermatology-skin-map.png',
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
    {
      type: 'xray' as DocumentType,
      title: 'Chest X-ray',
      notes: 'Clear lung fields — no pneumonia.',
      body_part: 'chest',
      file_url: DEMO_XRAY_CHEST,
      file_name: 'pediatric-chest-xray.jpg',
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
    {
      type: 'lab' as DocumentType,
      title: 'Bone chemistry panel',
      notes: 'Calcium and vitamin D within range pre-op.',
      body_part: 'general',
      file_url: DEMO_LAB_REPORT,
      file_name: 'bone-chemistry.png',
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
    {
      type: 'lab' as DocumentType,
      title: 'Metabolic screening',
      notes: 'Electrolytes and glucose normal; B12 adequate.',
      body_part: 'head',
      file_url: DEMO_LAB_CMP,
      file_name: 'neurology-metabolic.jpg',
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
    {
      type: 'lab' as DocumentType,
      title: 'HbA1c screening',
      notes: '5.4% — no diabetic retinopathy risk from glycemic control.',
      body_part: 'eyes',
      file_url: DEMO_LAB_REPORT,
      file_name: 'hba1c-report.png',
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
    {
      type: 'lab' as DocumentType,
      title: 'Pre-procedure blood work',
      notes: 'CBC normal — cleared for extraction.',
      body_part: 'general',
      file_url: DEMO_LAB_CMP,
      file_name: 'dental-preop-labs.jpg',
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
    {
      type: 'lab' as DocumentType,
      title: 'Pre-operative panel',
      notes: 'Coagulation and CBC within normal limits.',
      body_part: 'general',
      file_url: DEMO_LAB_REPORT,
      file_name: 'preop-labs.png',
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
    {
      type: 'xray' as DocumentType,
      title: 'Trauma chest X-ray',
      notes: 'No pneumothorax; ribs intact.',
      body_part: 'chest',
      file_url: DEMO_XRAY_CHEST_ALT,
      file_name: 'trauma-chest-xray.jpg',
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
    {
      type: 'lab' as DocumentType,
      title: 'Pregnancy hormone panel',
      notes: 'Beta-hCG and progesterone consistent with early pregnancy.',
      body_part: 'reproductive',
      file_url: DEMO_LAB_REPORT,
      file_name: 'pregnancy-hormones.png',
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
    {
      type: 'xray' as DocumentType,
      title: 'Body composition scan',
      notes: 'DEXA summary — BMI 27, visceral fat mildly elevated.',
      body_part: 'general',
      file_url: DEMO_XRAY_RECORDS,
      file_name: 'body-composition.png',
    },
  ],
  ENT: [
    {
      type: 'xray' as DocumentType,
      title: 'Paranasal sinuses — Water\'s view',
      notes:
        'Right maxillary sinus opacification with mild frontal and ethmoid involvement; septum relatively midline.',
      body_part: 'throat',
      file_url: TEST_ENT_SINUS_WATERS_VIEW,
      file_name: 'ent-sinus-waters-view.png',
      ai_insight: {
        description:
          'Occipitomental (Water\'s) radiograph shows prominent opacification of the right maxillary sinus with mild clouding of the frontal and ethmoid sinuses. The nasal septum is relatively midline.',
        possible_diseases:
          'Acute or chronic maxillary sinusitis; possible pansinusitis. Correlate with unilateral facial pressure, congestion, or purulent discharge. Consider CT sinuses if symptoms are chronic.',
      },
    },
    {
      type: 'xray' as DocumentType,
      title: 'Internal auditory canal MRI',
      notes:
        'Axial T2 MRI — symmetrical IACs, no CPA mass; incidental mild maxillary mucosal thickening.',
      body_part: 'ears',
      file_url: TEST_ENT_IAC_MRI,
      file_name: 'ent-iac-mri.png',
      ai_insight: {
        description:
          'Axial T2-weighted MRI at the internal auditory canals. Bilateral canals appear symmetrical without nerve thickening or mass. Cochlear and vestibular structures look morphologically normal. Mild mucosal thickening is noted in the visible posterior maxillary sinuses.',
        possible_diseases:
          'No vestibular schwannoma or cerebellopontine angle mass identified. Incidental maxillary mucosal thickening may reflect chronic rhinosinusitis.',
      },
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

export const DEFAULT_TEST_PATIENT_DISPLAY_NAME = 'Demo Patient';

export const MAX_TEST_PATIENT_DOCTOR_QUESTIONS = 20;

export const TEST_PATIENT_WELCOME_MESSAGE =
  'Hi doctor! I am your AI demo patient. Ask me up to 20 questions about my symptoms and history, request lab or X-ray results like a real consultation, and explore my medical records anytime.';

export const DEFAULT_TEST_PATIENT_PASSWORD = 'TestPatient123!';

const GENERAL_MEDICINE_SEEDS = SPECIALTY_TEST_RECORDS['General Medicine'];

/** Ensures every speciality seed list includes at least one lab and one x-ray. */
export function seedsForSpeciality(nameEn: string): SpecialtyRecordSeed[] {
  const base = SPECIALTY_TEST_RECORDS[nameEn] ?? GENERAL_MEDICINE_SEEDS;
  if (nameEn === 'ENT') return base;

  const hasLab = base.some((seed) => seed.type === 'lab');
  const hasXray = base.some((seed) => seed.type === 'xray');
  const extras: SpecialtyRecordSeed[] = [];
  const fallbackLab = GENERAL_MEDICINE_SEEDS.find((seed) => seed.type === 'lab');
  const fallbackXray = GENERAL_MEDICINE_SEEDS.find((seed) => seed.type === 'xray');

  if (!hasLab && fallbackLab) {
    extras.push({
      ...fallbackLab,
      title: `${nameEn} demo lab`,
    });
  }
  if (!hasXray && fallbackXray) {
    extras.push({
      ...fallbackXray,
      title: `${nameEn} demo X-ray`,
    });
  }
  return [...base, ...extras];
}
