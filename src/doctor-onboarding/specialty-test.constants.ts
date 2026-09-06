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

const TEST_CARDIOLOGY_ECHOCARDIOGRAM = `${DEMO_TEST_ATTACHMENTS_BASE}/cardiology-echocardiogram-panel.png`;
const TEST_DENTISTRY_PANORAMIC = `${DEMO_TEST_ATTACHMENTS_BASE}/dentistry-panoramic-xray.png`;
const TEST_DERMATOLOGY_DERMOSCOPY = `${DEMO_TEST_ATTACHMENTS_BASE}/dermatology-dermoscopy-panel.png`;
const TEST_ORTHOPEDICS_LOWER_LEG_FRACTURE = `${DEMO_TEST_ATTACHMENTS_BASE}/orthopedics-lower-leg-fracture.png`;
const TEST_ORTHOPEDICS_FOREARM_BOTH_BONE = `${DEMO_TEST_ATTACHMENTS_BASE}/orthopedics-forearm-both-bone-fracture.png`;
const TEST_ENT_SINUS_WATERS_VIEW = `${DEMO_TEST_ATTACHMENTS_BASE}/ent-sinus-waters-view.png`;
const TEST_ENT_IAC_MRI = `${DEMO_TEST_ATTACHMENTS_BASE}/ent-iac-mri.png`;
const TEST_OPHTHALMOLOGY_OCT_MACULA = `${DEMO_TEST_ATTACHMENTS_BASE}/ophthalmology-oct-macula-series.png`;
const TEST_OPHTHALMOLOGY_FUNDUS_FAF = `${DEMO_TEST_ATTACHMENTS_BASE}/ophthalmology-fundus-faf-bulls-eye.png`;
const TEST_GYNAECOLOGY_EARLY_PREGNANCY_TVU = `${DEMO_TEST_ATTACHMENTS_BASE}/gynaecology-early-pregnancy-tvu.png`;

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
      title: 'Transthoracic echocardiogram',
      notes:
        '2D and color Doppler echo — septal shunts, ductal flow, coarctation, and valvular stenosis/regurgitation documented across multiple views.',
      body_part: 'heart',
      file_url: TEST_CARDIOLOGY_ECHOCARDIOGRAM,
      file_name: 'cardiology-echocardiogram-panel.png',
      ai_insight: {
        description:
          'Composite transthoracic echocardiogram panel with paired 2D (a) and color Doppler (b) frames. Findings include ventricular septal defect (~0.26 cm), muscular VSD with interventricular shunt, atrial septal defect (~0.34 cm), patent ductus arteriosus, coarctation of the aorta, pulmonary valvular stenosis with turbulent outflow jet, and regurgitant jets through the aortic, mitral, tricuspid, and pulmonary valves.',
        possible_diseases:
          'Congenital heart disease spectrum: VSD, ASD, PDA, and coarctation of the aorta. Valvular disease: pulmonary stenosis with aortic, mitral, tricuspid, and pulmonary regurgitation. Correlate with murmur characteristics, oxygen saturation, and hemodynamic severity; consider cardiology referral and defect-specific follow-up.',
      },
    },
  ],
  Dermatology: [
    {
      type: 'xray' as DocumentType,
      title: 'Dermoscopy — pigmented lesion panel',
      notes:
        'Six dermatoscopic views (a–f) of pigmented skin lesions with variable asymmetry, border irregularity, and color variation.',
      body_part: 'general',
      file_url: TEST_DERMATOLOGY_DERMOSCOPY,
      file_name: 'dermatology-dermoscopy-panel.png',
      ai_insight: {
        description:
          'Composite dermoscopy panel of six pigmented lesions. Lesions a, b, and e show marked asymmetry and irregular, poorly defined borders with heterogeneous brown-to-black pigmentation. Lesion d appears erythematous with a reddish-brown center and indistinct margins. Lesion c is lighter tan with fuzzy borders; lesion f is a dark oval macule with relatively sharp but slightly uneven edges.',
        possible_diseases:
          'Several lesions meet concerning ABCDE features (asymmetry, border irregularity, color variation) — melanoma and dysplastic/atypical naevus are in the differential. Lesion d may represent inflamed naevus, Spitzoid lesion, or amelanotic melanoma. Recommend full-body skin exam, sequential dermoscopic photography, and biopsy of the highest-risk lesions.',
      },
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
      title: 'Lower leg X-ray — tibia & fibula fracture',
      notes:
        'Distal third comminuted, displaced fractures of the tibia and fibula with surrounding soft-tissue swelling.',
      body_part: 'left_leg',
      file_url: TEST_ORTHOPEDICS_LOWER_LEG_FRACTURE,
      file_name: 'orthopedics-lower-leg-fracture.png',
      ai_insight: {
        description:
          'Oblique radiograph of the lower leg shows comminuted fractures of both the tibia and fibula in the distal third. The tibial fragments are angulated and laterally displaced; the fibular fracture is displaced at a similar level. Marked soft-tissue swelling surrounds the fracture zone. The knee joint appears intact proximally.',
        possible_diseases:
          'High-energy distal tibia and fibula fracture (comminuted, displaced). Likely requires surgical stabilization (ORIF or intramedullary nailing). Monitor for compartment syndrome, neurovascular injury, and ankle involvement on dedicated ankle views.',
      },
    },
    {
      type: 'xray' as DocumentType,
      title: 'Forearm X-ray — radius & ulna fracture',
      notes:
        'Mid-shaft both-bone forearm fracture with overriding displacement and soft-tissue swelling.',
      body_part: 'left_arm',
      file_url: TEST_ORTHOPEDICS_FOREARM_BOTH_BONE,
      file_name: 'orthopedics-forearm-both-bone-fracture.png',
      ai_insight: {
        description:
          'Lateral forearm radiograph demonstrates complete mid-shaft fractures of the radius and ulna with significant overriding displacement and dorsal angulation of the distal fragments. Soft-tissue swelling is prominent at the fracture site. Carpal bones and metacarpals appear intact.',
        possible_diseases:
          'Displaced both-bone forearm fracture (radius and ulna). Typically managed with open reduction and internal fixation to restore length, alignment, and forearm rotation. Assess radial and ulnar nerve function and watch for compartment syndrome.',
      },
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
      title: 'Macular OCT — treatment series',
      notes:
        'Serial OCT (a–e): severe macular edema at baseline, near-complete fluid resolution at visit c, with recurrent intraretinal cysts at visits d and e.',
      body_part: 'eyes',
      file_url: TEST_OPHTHALMOLOGY_OCT_MACULA,
      file_name: 'ophthalmology-oct-macula-series.png',
      ai_insight: {
        description:
          'Longitudinal macular OCT with ETDRS thickness maps and B-scans across five visits. Visit a shows prominent intraretinal fluid and central macular thickening. Visit c demonstrates marked reduction in cystoid spaces and near-normal foveal contour. Visits d and e show re-accumulation of intraretinal fluid with expanding areas of macular thickening on the heat maps.',
        possible_diseases:
          'Diabetic macular edema (DME) or exudative maculopathy with treatment response followed by recurrence. Consider anti-VEGF re-treatment, OCT-guided interval adjustment, and correlation with visual acuity and HbA1c.',
      },
    },
    {
      type: 'xray' as DocumentType,
      title: 'Fundus photography & FAF — bilateral macula',
      notes:
        'Color fundus and fundus autofluorescence (OD/OS): bilateral central macular pigmentary change with a bull\'s-eye autofluorescence pattern.',
      body_part: 'eyes',
      file_url: TEST_OPHTHALMOLOGY_FUNDUS_FAF,
      file_name: 'ophthalmology-fundus-faf-bulls-eye.png',
      ai_insight: {
        description:
          'Bilateral color fundus images show central macular pigmentary mottling with yellowish subretinal flecks. Matching fundus autofluorescence demonstrates a bull\'s-eye configuration: central hypoautofluorescence surrounded by a ring of speckled hyperautofluorescence in both eyes.',
        possible_diseases:
          'Bull\'s-eye maculopathy — differential includes Stargardt disease/fleck dystrophy, cone-rod dystrophy, or hydroxychloroquine/chloroquine retinal toxicity. Correlate with medication history, visual fields, and macular OCT.',
      },
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
      type: 'xray' as DocumentType,
      title: 'Bedside echocardiogram — ED workup',
      notes:
        'Point-of-care transthoracic echo with color Doppler obtained in the emergency department for acute cardiac evaluation.',
      body_part: 'heart',
      file_url: TEST_CARDIOLOGY_ECHOCARDIOGRAM,
      file_name: 'cardiology-echocardiogram-panel.png',
      ai_insight: {
        description:
          'Emergency bedside transthoracic echocardiogram panel with 2D and color Doppler views. Structural shunts are visible including ventricular septal defect, muscular VSD, atrial septal defect, and patent ductus arteriosus. Coarctation of the aorta and pulmonary valvular stenosis show turbulent high-velocity flow. Regurgitant jets are present at the aortic, mitral, tricuspid, and pulmonary valves.',
        possible_diseases:
          'Acute decompensation may reflect congenital shunt lesions (VSD, ASD, PDA) or critical valvular disease in the ED setting. Consider hypoxia, heart failure, or hemodynamic instability; urgent cardiology consult, oxygen support, and defect-specific management as clinically indicated.',
      },
    },
  ],
  Gynaecology: [
    {
      type: 'xray' as DocumentType,
      title: 'Transvaginal ultrasound — early pregnancy',
      notes:
        'First-trimester TVU: intrauterine gestational sac(s) with mean sac diameter measurements and estimated gestational age 4–7 weeks.',
      body_part: 'reproductive',
      file_url: TEST_GYNAECOLOGY_EARLY_PREGNANCY_TVU,
      file_name: 'gynaecology-early-pregnancy-tvu.png',
      ai_insight: {
        description:
          'Composite transvaginal ultrasound panel showing early intrauterine gestational sacs with caliper measurements. Examples include single and twin sac configurations, mean sac diameters ranging roughly 0.9–3.1 cm, and calculated gestational ages approximately 4w0d to 7w4d. Some panels show two sacs of discordant size, which may represent a twin pregnancy with growth discrepancy or a vanishing twin.',
        possible_diseases:
          'Early intrauterine pregnancy — correlate with beta-hCG trend and clinical symptoms. Differential for abnormal findings includes ectopic pregnancy (if no intrauterine sac), missed abortion, or anembryonic gestation if no yolk sac or fetal pole on follow-up scan. Discordant twin sacs warrant serial ultrasound and dating confirmation.',
      },
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
  if (nameEn === 'ENT' || nameEn === 'Ophthalmology' || nameEn === 'Orthopedics' || nameEn === 'Cardiology' || nameEn === 'Emergency' || nameEn === 'Gynaecology' || nameEn === 'Dermatology') return base;

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
