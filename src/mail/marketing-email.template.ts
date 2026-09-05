import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import {
  compileMarketingSections,
  getDefaultMarketingSections,
  type MarketingEmailSection,
} from './marketing-email-sections';
import {
  MARKETING_THEME_COLORS,
  resolveMarketingEmailTheme,
  rethemeMarketingBodyHtml,
  type MarketingEmailTheme,
} from './marketing-email-themes';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  MARKETING_SCREENSHOT_URLS,
  MARKETING_LOGO_MARK_WHITE_URL,
  resolveMarketingImageUrls,
  type MarketingScreenshotKey,
} from './marketing-screenshots.constants';

const REGISTER_URL = 'https://www.3elagi.net/register-with-us';

function themeColors(theme?: MarketingEmailTheme) {
  return MARKETING_THEME_COLORS[resolveMarketingEmailTheme(theme)];
}

const MARKETING_LOGO_MARK_CID = '3elagi-logo-mark@3elagi';
const MARKETING_LOGO_WORDMARK_CID = '3elagi-logo@3elagi';

/** Table layout: PNG mark + styled wordmark (Gmail mobile blocks SVG). */
function marketingHeaderLogoHtml(forPreview = false): string {
  const markSrc = forPreview
    ? MARKETING_LOGO_MARK_WHITE_URL
    : `cid:${MARKETING_LOGO_MARK_CID}`;

  return `
              <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${markSrc}" alt="" width="48" height="48" style="display:block;border:0;width:48px;height:48px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'Segoe UI',Tahoma,Arial,Helvetica,sans-serif;font-size:38px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;line-height:1;">3elagi</span>
                  </td>
                </tr>
              </table>`;
}

function readMarketingAsset(filename: string): Buffer | null {
  const path = join(__dirname, 'assets', 'marketing', filename);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function marketingEmailLogoAttachments(): Array<{
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
}> {
  const attachments: Array<{
    filename: string;
    content: Buffer;
    cid: string;
    contentType: string;
  }> = [];

  const mark = readMarketingAsset('logo-mark-white.png');
  if (mark) {
    attachments.push({
      filename: 'logo-mark-white.png',
      content: mark,
      cid: MARKETING_LOGO_MARK_CID,
      contentType: 'image/png',
    });
  }

  const wordmark = readMarketingAsset('logo-white.png');
  if (wordmark) {
    attachments.push({
      filename: 'logo-white.png',
      content: wordmark,
      cid: MARKETING_LOGO_WORDMARK_CID,
      contentType: 'image/png',
    });
  }

  return attachments;
}

export const MARKETING_SCREENSHOT_FILES = [
  { file: 'chat-consultation.png', key: 'chat' as MarketingScreenshotKey },
  { file: 'xray-record.png', key: 'xrayRecord' as MarketingScreenshotKey },
  { file: 'xray-detail.png', key: 'xrayDetail' as MarketingScreenshotKey },
  { file: 'skeleton-view.png', key: 'skeleton' as MarketingScreenshotKey },
  { file: 'ai-assistant.png', key: 'ai' as MarketingScreenshotKey },
] as const;

interface MarketingCopy {
  dir: 'ltr' | 'rtl';
  subject: (name: string) => string;
  preheader: string;
  greeting: (name: string) => string;
  intro: string;
  valueProp: string;
  featuresTitle: string;
  features: string[];
  testingTitle: string;
  testingBody: string;
  earlyAdopterTitle: string;
  earlyAdopterBody: string;
  screenshotsTitle: string;
  screenshotCaptions: Record<(typeof MARKETING_SCREENSHOT_FILES)[number]['key'], string>;
  cta: string;
  ctaButton: string;
  closing: string;
  signatureTeam: string;
  signatureTagline: string;
  plainText: (name: string) => string;
}

const COPY: Record<MarketingEmailLanguage, MarketingCopy> = {
  en: {
    dir: 'ltr',
    subject: (name) => `Dr. ${name}, join 3elagi — remote care for the Gulf & Middle East`,
    preheader:
      'Reach new patients remotely, share records in chat, AI-assisted prescriptions, and video consultations.',
    greeting: (name) => `Dear Dr. ${name},`,
    intro:
      'We are building <strong>3elagi</strong> — a modern online consultation platform that helps doctors connect with patients across the <strong>Gulf and Middle East</strong>, follow up with existing patients remotely, and never lose a far-away patient who needs your expertise.',
    valueProp:
      'Whether you want <strong>more patients</strong>, smoother follow-ups, or a professional digital clinic, 3elagi is designed to grow with you — starting now, before our public launch.',
    featuresTitle: 'What you can do on 3elagi',
    features: [
      '<strong>Secure chat consultations</strong> with rich medical record sharing — X-rays, labs, diagnoses, and prescriptions in the conversation.',
      '<strong>View records as a list or on an interactive body skeleton</strong> — tap a region and see everything linked to that part of the body.',
      '<strong>Ask 3elagi AI about a patient’s status</strong> based on their records, and get help drafting prescriptions with medications suited to the <strong>patient’s country</strong>.',
      '<strong>Video consultations</strong> with the ability to share and review medical records live during the call.',
    ],
    testingTitle: 'We are in testing phase',
    testingBody:
      'We are currently building our initial doctor database and inviting a select group of clinicians to <strong>test, give feedback, and shape the product</strong> before formal launch. Your input will directly influence what we ship.',
    earlyAdopterTitle: 'Why join from the start?',
    earlyAdopterBody:
      'Doctors who join during testing will receive <strong>prioritised visibility and privileges after launch</strong> — more exposure to patients, early access to new features, and a stronger position in our founding doctor network. Remote care means you keep patients who would otherwise be out of reach.',
    screenshotsTitle: 'A glimpse of the platform',
    screenshotCaptions: {
      chat: 'Chat consultations with shared records',
      xrayRecord: 'Medical records with AI insight',
      xrayDetail: 'X-ray review with clinical highlights',
      skeleton: 'Interactive skeleton view of patient records',
      ai: 'AI assistant for records & prescriptions',
    },
    cta: 'Interested? Register your interest and we will create a <strong>test account</strong> for you, then send web and mobile links so you can explore the platform.',
    ctaButton: 'Join us — register your interest',
    closing: 'We would be honoured to have you as part of our founding doctor community.',
    signatureTeam: '3elagi Marketing Team',
    signatureTagline: 'Remote care. Smarter records. More patients.',
    plainText: (name) =>
      [
        `Dear Dr. ${name},`,
        '',
        'We are building 3elagi — an online consultation platform for doctors in the Gulf and Middle East.',
        '',
        'Features:',
        '• Share medical records in chat; view as list or body skeleton',
        '• Ask AI about patient status and get prescription help by patient country',
        '• Video consultations with live record sharing',
        '',
        'We are in testing and building our initial doctor database. Join early for future privileges after launch.',
        '',
        `Register: ${REGISTER_URL}`,
        '',
        'We will create a test account and send you web + mobile links.',
        '',
        '— 3elagi Marketing Team',
      ].join('\n'),
  },
  ar: {
    dir: 'rtl',
    subject: (name) => `د. ${name}، انضم إلى 3elagi — استشارات عن بُعد للخليج والشرق الأوسط`,
    preheader:
      'تواصل مع مرضى جدد عن بُعد، شارك السجلات في المحادثة، مساعدة ذكية للوصفات، واستشارات فيديو.',
    greeting: (name) => `الدكتور/ة ${name}، تحية طيبة،`,
    intro:
      'نبني <strong>3elagi</strong> — منصة استشارات طبية حديثة تساعد الأطباء على التواصل مع المرضى في <strong>الخليج والشرق الأوسط</strong>، ومتابعة مرضاهم الحاليين عن بُعد، دون فقدان مريض بعيد يحتاج خبرتك.',
    valueProp:
      'سواء أردت <strong>مزيداً من المرضى</strong>، أو متابعة أسهل، أو عيادة رقمية احترافية — 3elagi مصممة لتنمو معك من الآن، قبل الإطلاق الرسمي.',
    featuresTitle: 'ماذا يمكنك أن تفعل على 3elagi؟',
    features: [
      '<strong>استشارات آمنة عبر المحادثة</strong> مع مشاركة السجلات الطبية — أشعة، تحاليل، تشخيصات، ووصفات داخل المحادثة.',
      '<strong>عرض السجلات كقائمة أو على هيكل جسم تفاعلي</strong> — اضغط على منطقة الجسم واطلع على كل ما يرتبط بها.',
      '<strong>اسأل ذكاء 3elagi AI عن حالة المريض</strong> بناءً على سجلاته، واحصل على مساعدة في صياغة وصفات بأدوية مناسبة <strong>بلد المريض</strong>.',
      '<strong>استشارات فيديو</strong> مع إمكانية مشاركة ومراجعة السجلات الطبية أثناء المكالمة مباشرة.',
    ],
    testingTitle: 'نحن في مرحلة الاختبار',
    testingBody:
      'نبني حالياً قاعدة الأطباء الأولى وندعو مجموعة مختارة من الأطباء <strong>للاختبار وإبداء الرأي وصناعة المنتج</strong> قبل الإطلاق الرسمي. ملاحظاتك ستؤثر مباشرة في ما نطلقه.',
    earlyAdopterTitle: 'لماذا تنضم من البداية؟',
    earlyAdopterBody:
      'الأطباء الذين ينضمون في مرحلة الاختبار سيحصلون على <strong>أولوية في الظهور ومزايا بعد الإطلاق</strong> — تعرض أكبر للمرضى، وصول مبكر للميزات الجديدة، ومكانة أقوى في شبكة الأطباء المؤسسين. الرعاية عن بُعد تعني الاحتفاظ بمرضى كانوا سيضيعون بسبب المسافة.',
    screenshotsTitle: 'لمحة عن المنصة',
    screenshotCaptions: {
      chat: 'استشارات مع مشاركة السجلات',
      xrayRecord: 'سجلات طبية مع رؤى الذكاء الاصطناعي',
      xrayDetail: 'مراجعة أشعة مع تمييز سريري',
      skeleton: 'عرض الهيكل التفاعلي للسجل',
      ai: 'مساعد ذكي للسجلات والوصفات',
    },
    cta: 'مهتم/ة؟ سجّل اهتمامك وسننشئ لك <strong>حساباً تجريبياً</strong>، ثم نرسل روابط الويب والجوال للتجربة.',
    ctaButton: 'انضم إلينا — سجّل اهتمامك',
    closing: 'يسعدنا أن تكون جزءاً من مجتمع الأطباء المؤسسين لدينا.',
    signatureTeam: 'فريق التسويق — 3elagi',
    signatureTagline: 'رعاية عن بُعد. سجلات أذكى. مرضى أكثر.',
    plainText: (name) =>
      [
        `الدكتور/ة ${name}، تحية طيبة،`,
        '',
        'نبني 3elagi — منصة استشارات طبية للأطباء في الخليج والشرق الأوسط.',
        '',
        'الميزات:',
        '• مشاركة السجلات في المحادثة؛ عرض كقائمة أو هيكل جسم',
        '• اسأل الذكاء الاصطناعي عن حالة المريض ومساعدة الوصفات حسب بلد المريض',
        '• استشارات فيديو مع مشاركة السجلات',
        '',
        'نحن في مرحلة الاختبار. انضم مبكراً لمزايا بعد الإطلاق.',
        '',
        `التسجيل: ${REGISTER_URL}`,
        '',
        'سننشئ حساباً تجريبياً ونرسل روابط الويب والجوال.',
        '',
        '— فريق التسويق 3elagi',
      ].join('\n'),
  },
  es: {
    dir: 'ltr',
    subject: (name) => `Dr. ${name}, únase a 3elagi — consultas remotas para el Golfo y Oriente Medio`,
    preheader:
      'Llegue a nuevos pacientes, comparta historiales en el chat, IA para recetas y videoconsultas.',
    greeting: (name) => `Estimado/a Dr. ${name},`,
    intro:
      'Estamos desarrollando <strong>3elagi</strong> — una plataforma moderna de consultas en línea que ayuda a los médicos a conectar con pacientes en el <strong>Golfo y Oriente Medio</strong>, hacer seguimiento remoto y no perder pacientes lejanos que necesitan su experiencia.',
    valueProp:
      'Ya sea que busque <strong>más pacientes</strong>, seguimientos más fluidos o una clínica digital profesional, 3elagi está pensada para crecer con usted — desde ahora, antes del lanzamiento oficial.',
    featuresTitle: 'Qué puede hacer en 3elagi',
    features: [
      '<strong>Consultas seguras por chat</strong> con historiales médicos compartidos — radiografías, análisis, diagnósticos y recetas en la conversación.',
      '<strong>Vea historiales en lista o en un esqueleto corporal interactivo</strong> — toque una región y vea todo lo vinculado.',
      '<strong>Pregunte a la IA de 3elagi sobre el estado del paciente</strong> según sus registros, y obtenga ayuda para redactar recetas con medicamentos adecuados al <strong>país del paciente</strong>.',
      '<strong>Videoconsultas</strong> con posibilidad de compartir y revisar historiales médicos en vivo durante la llamada.',
    ],
    testingTitle: 'Estamos en fase de pruebas',
    testingBody:
      'Actualmente estamos creando nuestra base inicial de médicos e invitando a un grupo selecto a <strong>probar, opinar y dar forma al producto</strong> antes del lanzamiento formal. Su feedback influirá directamente en lo que lancemos.',
    earlyAdopterTitle: '¿Por qué unirse desde el inicio?',
    earlyAdopterBody:
      'Los médicos que se unan en pruebas recibirán <strong>mayor visibilidad y privilegios tras el lanzamiento</strong>: más exposición a pacientes, acceso anticipado a funciones y una posición preferente en nuestra red fundadora. La consulta remota le permite conservar pacientes que de otro modo quedarían fuera de alcance.',
    screenshotsTitle: 'Un vistazo a la plataforma',
    screenshotCaptions: {
      chat: 'Consultas con historiales compartidos',
      xrayRecord: 'Registros médicos con IA',
      xrayDetail: 'Revisión de radiografías',
      skeleton: 'Vista esquelética interactiva',
      ai: 'Asistente IA para registros y recetas',
    },
    cta: '¿Le interesa? Registre su interés y crearemos una <strong>cuenta de prueba</strong>; luego le enviaremos enlaces web y móvil.',
    ctaButton: 'Únase — registre su interés',
    closing: 'Sería un honor contar con usted en nuestra comunidad fundadora de médicos.',
    signatureTeam: 'Equipo de Marketing 3elagi',
    signatureTagline: 'Atención remota. Historiales inteligentes. Más pacientes.',
    plainText: (name) =>
      [
        `Estimado/a Dr. ${name},`,
        '',
        'Desarrollamos 3elagi — plataforma de consultas para médicos en el Golfo y Oriente Medio.',
        '',
        'Funciones:',
        '• Compartir historiales en chat; vista lista o esqueleto corporal',
        '• IA para estado del paciente y ayuda con recetas según país',
        '• Videoconsultas con historiales en vivo',
        '',
        'Fase de pruebas. Únase pronto para privilegios tras el lanzamiento.',
        '',
        `Registro: ${REGISTER_URL}`,
        '',
        'Crearemos una cuenta de prueba y enviaremos enlaces web y móvil.',
        '',
        '— Equipo de Marketing 3elagi',
      ].join('\n'),
  },
  de: {
    dir: 'ltr',
    subject: (name) => `Dr. ${name}, werden Sie Teil von 3elagi — Telemedizin für den Golf & Nahen Osten`,
    preheader:
      'Neue Patienten remote erreichen, Befunde im Chat teilen, KI-Rezepte und Videosprechstunden.',
    greeting: (name) => `Sehr geehrte/r Dr. ${name},`,
    intro:
      'Wir entwickeln <strong>3elagi</strong> — eine moderne Online-Konsultationsplattform, mit der Ärzte Patienten im <strong>Golfraum und Nahen Osten</strong> erreichen, Bestandspatienten remote betreuen und entfernte Patienten nicht verlieren.',
    valueProp:
      'Ob Sie <strong>mehr Patienten</strong>, reibungslosere Nachsorge oder eine professionelle digitale Praxis wünschen — 3elagi wächst mit Ihnen, schon jetzt vor dem offiziellen Launch.',
    featuresTitle: 'Das bietet 3elagi',
    features: [
      '<strong>Sichere Chat-Konsultationen</strong> mit medizinischen Unterlagen — Röntgen, Labor, Diagnosen und Rezepte im Gespräch.',
      '<strong>Befunde als Liste oder interaktives Körperskelett</strong> — Region antippen und alle verknüpften Einträge sehen.',
      '<strong>3elagi KI nach Patientenstatus fragen</strong> anhand der Akte, plus Hilfe bei Rezepten mit Medikamenten passend zum <strong>Land des Patienten</strong>.',
      '<strong>Videosprechstunden</strong> mit Live-Freigabe und -Review medizinischer Unterlagen während des Calls.',
    ],
    testingTitle: 'Wir befinden uns in der Testphase',
    testingBody:
      'Wir bauen gerade unsere erste Ärzte-Datenbank auf und laden ausgewählte Mediziner ein, <strong>zu testen, Feedback zu geben und das Produkt mitzugestalten</strong> — vor dem formellen Start. Ihr Input fließt direkt in unser Release ein.',
    earlyAdopterTitle: 'Warum von Anfang an dabei sein?',
    earlyAdopterBody:
      'Ärzte in der Testphase erhalten <strong>Priorität und Vorteile nach dem Launch</strong> — mehr Sichtbarkeit, frühen Zugang zu Features und eine stärkere Position im Gründungs-netzwerk. Remote-Konsultation hält Patienten, die sonst außer Reichweite wären.',
    screenshotsTitle: 'Ein Blick auf die Plattform',
    screenshotCaptions: {
      chat: 'Chat mit geteilten Befunden',
      xrayRecord: 'Akten mit KI-Einblick',
      xrayDetail: 'Röntgen-Review mit Markierungen',
      skeleton: 'Interaktive Skelett-Ansicht',
      ai: 'KI-Assistent für Akten & Rezepte',
    },
    cta: 'Interessiert? Registrieren Sie sich — wir richten ein <strong>Testkonto</strong> ein und senden Web- und Mobile-Links.',
    ctaButton: 'Mitmachen — Interesse anmelden',
    closing: 'Wir würden uns freuen, Sie in unserer Gründer-Ärztegemeinschaft begrüßen zu dürfen.',
    signatureTeam: '3elagi Marketing Team',
    signatureTagline: 'Remote care. Smarte Akten. Mehr Patienten.',
    plainText: (name) =>
      [
        `Sehr geehrte/r Dr. ${name},`,
        '',
        'Wir entwickeln 3elagi — Telemedizin für den Golfraum und Nahen Osten.',
        '',
        'Funktionen:',
        '• Befunde im Chat; Liste oder Körperskelett',
        '• KI-Status & Rezept-Hilfe nach Patientenland',
        '• Videosprechstunden mit Live-Befunden',
        '',
        'Testphase — früh beitreten für Launch-Vorteile.',
        '',
        `Registrierung: ${REGISTER_URL}`,
        '',
        'Wir erstellen ein Testkonto und senden Web- + Mobile-Links.',
        '',
        '— 3elagi Marketing Team',
      ].join('\n'),
  },
};

function featureList(items: string[], dir: 'ltr' | 'rtl'): string {
  const align = dir === 'rtl' ? 'right' : 'left';
  return `<ul style="margin:0;padding-${dir === 'rtl' ? 'right' : 'left'}:20px;text-align:${align};color:#334155;line-height:1.65;">${items
    .map((item) => `<li style="margin-bottom:10px;">${item}</li>`)
    .join('')}</ul>`;
}

function screenshotGrid(
  copy: MarketingCopy,
  dir: 'ltr' | 'rtl',
  theme: MarketingEmailTheme,
): string {
  const { brand: BRAND } = themeColors(theme);
  const shots = MARKETING_SCREENSHOT_FILES.map((shot) => {
    const caption = copy.screenshotCaptions[shot.key];
    return `
      <td style="padding:8px;width:50%;vertical-align:top;">
        <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc;">
          <img src="${MARKETING_SCREENSHOT_URLS[shot.key]}" alt="${caption}" width="100%" style="display:block;width:100%;height:auto;border:0;" />
          <p style="margin:0;padding:10px 12px;font-size:12px;color:#64748b;text-align:center;">${caption}</p>
        </div>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    rows.push(`<tr>${shots[i]}${shots[i + 1] ?? '<td></td>'}</tr>`);
  }

  return `
    <h2 style="margin:28px 0 14px;font-size:18px;color:${BRAND};text-align:${dir === 'rtl' ? 'right' : 'left'};">${copy.screenshotsTitle}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="${dir}">${rows.join('')}</table>`;
}

export function getDefaultMarketingBodyHtml(
  language: MarketingEmailLanguage,
  theme: MarketingEmailTheme = 'blue',
): string {
  return compileMarketingSections(
    getDefaultMarketingSections(language),
    language,
    theme,
  );
}

export { getDefaultMarketingSections, compileMarketingSections };
export type { MarketingEmailSection };

export function getMarketingTemplatePreview(
  language: MarketingEmailLanguage,
  theme: MarketingEmailTheme = 'blue',
) {
  const resolvedTheme = resolveMarketingEmailTheme(theme);
  const copy = COPY[language];
  const sections = getDefaultMarketingSections(language);
  return {
    language,
    themeColor: resolvedTheme,
    dir: copy.dir,
    subjectTemplate: copy.subject('{{name}}'),
    preheader: copy.preheader,
    sections,
    bodyHtml: resolveMarketingImageUrls(
      compileMarketingSections(sections, language, resolvedTheme, copy.dir),
    ),
  };
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function applyNamePlaceholders(content: string, name: string): string {
  return content.replace(/\{\{name\}\}/g, name);
}

export function buildMarketingEmailHtml(
  language: MarketingEmailLanguage,
  recipientName: string,
  customBodyHtml?: string,
  theme?: MarketingEmailTheme,
  sections?: MarketingEmailSection[],
  forPreview = false,
): { subject: string; html: string; text: string } {
  const resolvedTheme = resolveMarketingEmailTheme(theme);
  const colors = themeColors(resolvedTheme);
  const {
    brand: BRAND,
    gradientEnd: BRAND_GRADIENT_END,
  } = colors;
  const copy = COPY[language];
  const dir = copy.dir;
  const align = dir === 'rtl' ? 'right' : 'left';
  const name = recipientName.trim() || 'Doctor';
  const compiledFromSections =
    sections?.length &&
    compileMarketingSections(sections, language, resolvedTheme, dir);
  const rawBody = compiledFromSections
    ? compiledFromSections
    : customBodyHtml?.trim() ||
      getDefaultMarketingBodyHtml(language, resolvedTheme);
  const bodyInner = applyNamePlaceholders(
    resolveMarketingImageUrls(
      customBodyHtml?.trim() && !compiledFromSections
        ? rethemeMarketingBodyHtml(rawBody, resolvedTheme)
        : rawBody,
    ),
    name,
  );

  const html = `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${copy.subject(name)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fa;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_GRADIENT_END} 100%);padding:28px 32px;text-align:center;">
              ${marketingHeaderLogoHtml(forPreview)}
              <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:10px;">${copy.signatureTagline}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;" dir="${dir}">
              ${bodyInner}

              <div style="border-top:1px solid #e2e8f0;padding-top:20px;text-align:${align};">
                <div style="font-size:18px;font-weight:900;color:${BRAND};margin-bottom:4px;">3elagi</div>
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">${copy.signatureTeam}</p>
                <p style="margin:0;font-size:13px;color:#64748b;">${copy.signatureTagline}</p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} 3elagi</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = customBodyHtml?.trim()
    ? htmlToPlainText(bodyInner)
    : copy.plainText(name);

  return {
    subject: copy.subject(name),
    html,
    text,
  };
}
