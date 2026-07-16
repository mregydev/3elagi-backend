/** Fixed body-part taxonomy for medical records (matches mobile). */
export const MEDICAL_BODY_PARTS = [
  'general',
  // Top — head, neck & upper extremities
  'head',
  'neck',
  'eyes',
  'ears',
  'throat',
  'thyroid',
  'shoulder',
  'left_arm',
  'right_arm',
  'left_hand',
  'right_hand',
  // Medium — thorax, abdomen & mid-spine
  'chest',
  'thoracic_spine',
  'lumbar_spine',
  'back',
  'heart',
  'lungs',
  'abdomen',
  'stomach',
  'liver',
  'gallbladder',
  'pancreas',
  'spleen',
  'intestines',
  'kidney',
  // Bottom — pelvis & lower extremities
  'pelvis',
  'hip',
  'bladder',
  'reproductive',
  'left_leg',
  'right_leg',
  'left_foot',
  'right_foot',
] as const;

export type MedicalBodyPart = (typeof MEDICAL_BODY_PARTS)[number];

/** Localized / free-text aliases → canonical keys (AI often returns translated labels). */
const BODY_PART_ALIASES: Record<string, MedicalBodyPart> = {
  // English extras
  brain: 'head',
  'head & brain': 'head',
  'head and brain': 'head',
  cervical: 'neck',
  'cervical spine': 'neck',
  eye: 'eyes',
  ear: 'ears',
  nose: 'throat',
  mouth: 'throat',
  'nose throat mouth': 'throat',
  arm: 'left_arm',
  hand: 'left_hand',
  leg: 'left_leg',
  foot: 'left_foot',
  rib: 'chest',
  ribs: 'chest',
  'rib cage': 'chest',
  kidney: 'kidney',
  kidneys: 'kidney',
  bowel: 'intestines',
  gut: 'intestines',
  uterus: 'reproductive',
  ovary: 'reproductive',
  prostate: 'reproductive',

  // Arabic (common + app labels)
  عام: 'general',
  الرأس: 'head',
  الدماغ: 'head',
  'الرأس والدماغ': 'head',
  الرقبة: 'neck',
  'الفقرات العنقية': 'neck',
  'الرقبة والفقرات العنقية': 'neck',
  العين: 'eyes',
  العينان: 'eyes',
  العيون: 'eyes',
  الأذن: 'ears',
  الأذنان: 'ears',
  الأنف: 'throat',
  الحلق: 'throat',
  الفم: 'throat',
  'الأنف والحلق والفم': 'throat',
  'الغدة الدرقية': 'thyroid',
  الكتف: 'shoulder',
  'حزام الكتف': 'shoulder',
  الذراع: 'left_arm',
  'الذراع الأيسر': 'left_arm',
  'الذراع الأيمن': 'right_arm',
  اليد: 'left_hand',
  'اليد اليسرى': 'left_hand',
  'اليد اليمنى': 'right_hand',
  الصدر: 'chest',
  'القفص الصدري': 'chest',
  'العمود الصدري': 'thoracic_spine',
  'العمود القطني': 'lumbar_spine',
  الظهر: 'back',
  القلب: 'heart',
  'القلب والأوعية': 'heart',
  الرئة: 'lungs',
  الرئتان: 'lungs',
  'الرئتان والمسالك الهوائية': 'lungs',
  البطن: 'abdomen',
  المعدة: 'stomach',
  الكبد: 'liver',
  المرارة: 'gallbladder',
  البنكرياس: 'pancreas',
  الطحال: 'spleen',
  الأمعاء: 'intestines',
  الكلى: 'kidney',
  الكلية: 'kidney',
  الحوض: 'pelvis',
  الورك: 'hip',
  'مفصل الورك': 'hip',
  المثانة: 'bladder',
  'الأعضاء التناسلية': 'reproductive',
  الساق: 'left_leg',
  'الساق اليسرى': 'left_leg',
  'الساق اليمنى': 'right_leg',
  القدم: 'left_foot',
  'القدم اليسرى': 'left_foot',
  'القدم اليمنى': 'right_foot',

  // German (common)
  kopf: 'head',
  gehirn: 'head',
  hals: 'neck',
  augen: 'eyes',
  ohren: 'ears',
  brust: 'chest',
  rücken: 'back',
  herz: 'heart',
  lunge: 'lungs',
  bauch: 'abdomen',
  magen: 'stomach',
  leber: 'liver',
  nieren: 'kidney',

  // Spanish (common)
  cabeza: 'head',
  cerebro: 'head',
  cuello: 'neck',
  ojos: 'eyes',
  oídos: 'ears',
  pecho: 'chest',
  espalda: 'back',
  corazón: 'heart',
  pulmones: 'lungs',
  estómago: 'stomach',
  higado: 'liver',
  hígado: 'liver',
  riñones: 'kidney',
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeBodyPart(
  value: unknown,
): MedicalBodyPart | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const snake = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if ((MEDICAL_BODY_PARTS as readonly string[]).includes(snake)) {
    return snake as MedicalBodyPart;
  }

  const lower = raw.toLowerCase();
  const compact = lower.replace(/\s+/g, ' ').trim();
  const noDiacritics = stripDiacritics(compact);

  const direct =
    BODY_PART_ALIASES[compact] ??
    BODY_PART_ALIASES[noDiacritics] ??
    BODY_PART_ALIASES[raw] ??
    BODY_PART_ALIASES[snake.replace(/_/g, ' ')];
  if (direct) return direct;

  // Prefer longest alias so "اليد اليمنى" does not match "اليد" → left_hand.
  let best: { part: MedicalBodyPart; len: number } | undefined;
  for (const [alias, part] of Object.entries(BODY_PART_ALIASES)) {
    if (alias.length < 3) continue;
    if (compact.includes(alias) || raw.includes(alias)) {
      if (!best || alias.length > best.len) best = { part, len: alias.length };
    }
  }

  return best?.part ?? null;
}
