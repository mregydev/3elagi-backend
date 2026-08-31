import { normalizeDoctorTagKey } from './doctor-tag-seeds';

export type DoctorTagLocale = 'en' | 'ar' | 'de' | 'es';

export type DoctorTagI18nRow = {
  ar: string;
  de: string;
  es: string;
};

/** Localized labels keyed by normalized English tag label. */
export const DOCTOR_TAG_I18N: Record<string, DoctorTagI18nRow> = {
  arabic: { ar: 'العربية', de: 'Arabisch', es: 'Árabe' },
  english: { ar: 'الإنجليزية', de: 'Englisch', es: 'Inglés' },
  french: { ar: 'الفرنسية', de: 'Französisch', es: 'Francés' },
  german: { ar: 'الألمانية', de: 'Deutsch', es: 'Alemán' },
  spanish: { ar: 'الإسبانية', de: 'Spanisch', es: 'Español' },
  telemedicine: { ar: 'طب عن بُعد', de: 'Telemedizin', es: 'Telemedicina' },
  'home visits': { ar: 'زيارات منزلية', de: 'Hausbesuche', es: 'Visitas a domicilio' },
  'evening appointments': {
    ar: 'مواعيد مسائية',
    de: 'Abendtermine',
    es: 'Citas nocturnas',
  },
  'weekend appointments': {
    ar: 'مواعيد نهاية الأسبوع',
    de: 'Wochenendtermine',
    es: 'Citas de fin de semana',
  },
  'second opinion': { ar: 'رأي ثانٍ', de: 'Zweitmeinung', es: 'Segunda opinión' },
  'primary care': { ar: 'رعاية أولية', de: 'Grundversorgung', es: 'Atención primaria' },
  'chronic disease': { ar: 'أمراض مزمنة', de: 'Chronische Erkrankungen', es: 'Enfermedades crónicas' },
  'preventive care': { ar: 'رعاية وقائية', de: 'Vorsorge', es: 'Atención preventiva' },
  diabetes: { ar: 'السكري', de: 'Diabetes', es: 'Diabetes' },
  hypertension: { ar: 'ارتفاع ضغط الدم', de: 'Bluthochdruck', es: 'Hipertensión' },
  'family medicine': { ar: 'طب الأسرة', de: 'Familienmedizin', es: 'Medicina familiar' },
  'adult medicine': { ar: 'طب البالغين', de: 'Innere Medizin', es: 'Medicina adulta' },
  'heart disease': { ar: 'أمراض القلب', de: 'Herzerkrankungen', es: 'Enfermedades cardíacas' },
  ecg: { ar: 'تخطيط القلب', de: 'EKG', es: 'ECG' },
  'heart failure': { ar: 'فشل القلب', de: 'Herzinsuffizienz', es: 'Insuficiencia cardíaca' },
  arrhythmia: { ar: 'اضطراب نظم القلب', de: 'Arrhythmie', es: 'Arritmia' },
  'chest pain': { ar: 'ألم الصدر', de: 'Brustschmerzen', es: 'Dolor torácico' },
  cholesterol: { ar: 'الكوليسترول', de: 'Cholesterin', es: 'Colesterol' },
  acne: { ar: 'حب الشباب', de: 'Akne', es: 'Acné' },
  eczema: { ar: 'الإكزيما', de: 'Ekzem', es: 'Eccema' },
  psoriasis: { ar: 'الصدفية', de: 'Psoriasis', es: 'Psoriasis' },
  'skin allergy': { ar: 'حساسية الجلد', de: 'Hautallergie', es: 'Alergia cutánea' },
  'hair loss': { ar: 'تساقط الشعر', de: 'Haarausfall', es: 'Caída del cabello' },
  'cosmetic dermatology': {
    ar: 'طب الجلد التجميلي',
    de: 'Kosmetische Dermatologie',
    es: 'Dermatología estética',
  },
  'pediatric dermatology': {
    ar: 'طب جلد الأطفال',
    de: 'Pädiatrische Dermatologie',
    es: 'Dermatología pediátrica',
  },
  'newborn care': { ar: 'رعاية حديثي الولادة', de: 'Neugeborenenversorgung', es: 'Cuidado del recién nacido' },
  'child vaccination': { ar: 'تطعيم الأطفال', de: 'Kinderimpfungen', es: 'Vacunación infantil' },
  'growth monitoring': { ar: 'متابعة النمو', de: 'Wachstumskontrolle', es: 'Control del crecimiento' },
  'pediatric fever': { ar: 'حمى الأطفال', de: 'Fieber bei Kindern', es: 'Fiebre pediátrica' },
  'child nutrition': { ar: 'تغذية الأطفال', de: 'Kinderernährung', es: 'Nutrición infantil' },
  'developmental screening': {
    ar: 'فحص النمو والتطور',
    de: 'Entwicklungsscreening',
    es: 'Detección del desarrollo',
  },
  'joint pain': { ar: 'آلام المفاصل', de: 'Gelenkschmerzen', es: 'Dolor articular' },
  'sports injuries': { ar: 'إصابات رياضية', de: 'Sportverletzungen', es: 'Lesiones deportivas' },
  fractures: { ar: 'كسور', de: 'Frakturen', es: 'Fracturas' },
  'back pain': { ar: 'آلام الظهر', de: 'Rückenschmerzen', es: 'Dolor de espalda' },
  'knee pain': { ar: 'آلام الركبة', de: 'Knieschmerzen', es: 'Dolor de rodilla' },
  'physical therapy': { ar: 'علاج طبيعي', de: 'Physiotherapie', es: 'Fisioterapia' },
  arthritis: { ar: 'التهاب المفاصل', de: 'Arthritis', es: 'Artritis' },
  headache: { ar: 'صداع', de: 'Kopfschmerzen', es: 'Dolor de cabeza' },
  migraine: { ar: 'الصداع النصفي', de: 'Migräne', es: 'Migraña' },
  epilepsy: { ar: 'الصرع', de: 'Epilepsie', es: 'Epilepsia' },
  'stroke follow-up': { ar: 'متابعة ما بعد الجلطة', de: 'Schlaganfall-Nachsorge', es: 'Seguimiento post-ictus' },
  neuropathy: { ar: 'اعتلال الأعصاب', de: 'Neuropathie', es: 'Neuropatía' },
  'memory disorders': { ar: 'اضطرابات الذاكرة', de: 'Gedächtnisstörungen', es: 'Trastornos de memoria' },
  "parkinson's disease": { ar: 'مرض باركنسون', de: 'Parkinson-Krankheit', es: 'Enfermedad de Parkinson' },
  cataract: { ar: 'إعتام عدسة العين', de: 'Katarakt', es: 'Cataratas' },
  glaucoma: { ar: 'الزرق', de: 'Glaukom', es: 'Glaucoma' },
  'dry eye': { ar: 'جفاف العين', de: 'Trockenes Auge', es: 'Ojo seco' },
  'vision correction': { ar: 'تصحيح النظر', de: 'Sehkorrektur', es: 'Corrección visual' },
  'diabetic eye disease': { ar: 'أمراض العين السكرية', de: 'Diabetische Augenerkrankung', es: 'Enfermedad ocular diabética' },
  'pediatric eye care': { ar: 'رعاية عيون الأطفال', de: 'Kinderaugenheilkunde', es: 'Oftalmología pediátrica' },
  'root canal': { ar: 'علاج العصب', de: 'Wurzelbehandlung', es: 'Endodoncia' },
  'teeth whitening': { ar: 'تبييض الأسنان', de: 'Zahnaufhellung', es: 'Blanqueamiento dental' },
  orthodontics: { ar: 'تقويم الأسنان', de: 'Kieferorthopädie', es: 'Ortodoncia' },
  'pediatric dentistry': { ar: 'طب أسنان الأطفال', de: 'Kinderzahnheilkunde', es: 'Odontopediatría' },
  'dental implants': { ar: 'زراعة الأسنان', de: 'Zahnimplantate', es: 'Implantes dentales' },
  'gum disease': { ar: 'أمراض اللثة', de: 'Zahnfleischerkrankungen', es: 'Enfermedad de las encías' },
  'cosmetic dentistry': { ar: 'طب الأسنان التجميلي', de: 'Ästhetische Zahnmedizin', es: 'Odontología estética' },
  'general surgery': { ar: 'جراحة عامة', de: 'Allgemeinchirurgie', es: 'Cirugía general' },
  'laparoscopic surgery': { ar: 'جراحة بالمنظار', de: 'Laparoskopische Chirurgie', es: 'Cirugía laparoscópica' },
  'hernia repair': { ar: 'إصلاح الفتق', de: 'Hernienoperation', es: 'Reparación de hernia' },
  'gallbladder surgery': { ar: 'جراحة المرارة', de: 'Gallenblasen-OP', es: 'Cirugía de vesícula' },
  'post-operative care': { ar: 'رعاية ما بعد العملية', de: 'Postoperative Versorgung', es: 'Cuidado postoperatorio' },
  'minor procedures': { ar: 'إجراءات بسيطة', de: 'Kleine Eingriffe', es: 'Procedimientos menores' },
  'urgent care': { ar: 'رعاية عاجلة', de: 'Akutversorgung', es: 'Atención urgente' },
  trauma: { ar: 'إصابات ورضوض', de: 'Trauma', es: 'Traumatismos' },
  'acute illness': { ar: 'مرض حاد', de: 'Akute Erkrankung', es: 'Enfermedad aguda' },
  'first aid': { ar: 'إسعافات أولية', de: 'Erste Hilfe', es: 'Primeros auxilios' },
  '24/7 availability': { ar: 'متاح على مدار الساعة', de: 'Rund um die Uhr verfügbar', es: 'Disponible 24/7' },
  'critical care': { ar: 'رعاية حرجة', de: 'Intensivpflege', es: 'Cuidados críticos' },
  'pregnancy care': { ar: 'رعاية الحمل', de: 'Schwangerschaftsbetreuung', es: 'Cuidado del embarazo' },
  fertility: { ar: 'الخصوبة', de: 'Fruchtbarkeit', es: 'Fertilidad' },
  'menstrual disorders': { ar: 'اضطرابات الدورة', de: 'Menstruationsstörungen', es: 'Trastornos menstruales' },
  pcos: { ar: 'متلازمة تكيس المبايض', de: 'PCOS', es: 'SOP' },
  'prenatal care': { ar: 'رعاية ما قبل الولادة', de: 'Schwangerenvorsorge', es: 'Cuidado prenatal' },
  "women's health": { ar: 'صحة المرأة', de: 'Frauengesundheit', es: 'Salud de la mujer' },
  obstetrics: { ar: 'توليد', de: 'Geburtshilfe', es: 'Obstetricia' },
  'weight management': { ar: 'إدارة الوزن', de: 'Gewichtsmanagement', es: 'Control de peso' },
  'diabetes diet': { ar: 'نظام غذائي للسكري', de: 'Diabetes-Diät', es: 'Dieta para diabetes' },
  'sports nutrition': { ar: 'تغذية رياضية', de: 'Sportlerernährung', es: 'Nutrición deportiva' },
  'meal planning': { ar: 'تخطيط الوجبات', de: 'Mahlzeitenplanung', es: 'Planificación de comidas' },
  'bariatric nutrition': { ar: 'تغذية ما بعد التكميم', de: 'Bariatische Ernährung', es: 'Nutrición bariátrica' },
  'food allergy': { ar: 'حساسية الطعام', de: 'Nahrungsmittelallergie', es: 'Alergia alimentaria' },
};

export function doctorTagI18nFor(labelEn: string): DoctorTagI18nRow | undefined {
  return DOCTOR_TAG_I18N[normalizeDoctorTagKey(labelEn)];
}

export function localizeDoctorTagLabel(
  labelEn: string,
  locale: DoctorTagLocale = 'en',
): string {
  if (locale === 'en') return labelEn;
  const row = doctorTagI18nFor(labelEn);
  if (!row) return labelEn;
  return row[locale] ?? labelEn;
}

export function normalizeDoctorTagLocale(raw?: string): DoctorTagLocale {
  if (raw === 'ar' || raw === 'de' || raw === 'es' || raw === 'en') return raw;
  return 'en';
}
