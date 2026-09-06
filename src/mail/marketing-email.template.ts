import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import {
  compileMarketingSections,
  getDefaultMarketingSections,
  REGISTER_URL,
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
    subject: (name) => `Dr. ${name}, grow your practice with 3elagi — Gulf & Middle East`,
    preheader:
      'Cross-border remote consultations, EMR tracking, Ask 3elagi AI, and intuitive clinical tools for the Gulf & Middle East.',
    greeting: (name) => `Dear Dr. ${name},`,
    intro:
      'Are you a practicing doctor looking to grow your patient base?',
    valueProp:
      'By registering with <strong>3elagi</strong>, you join a specialized remote consultation platform that connects practicing physicians with patients across the <strong>Gulf and Middle East</strong> — expanding your reach beyond the walls of your clinic.',
    featuresTitle: 'What 3elagi offers your practice',
    features: [
      '<strong>Cross-border remote consultations</strong> (video & chat) with patients in the Gulf & Middle East.',
      '<strong>Electronic Medical Record (EMR) tracking</strong> & structured clinical history.',
      '<strong>Integrated AI clinical decision support</strong> — <strong>Ask 3elagi AI</strong>.',
      '<strong>Intuitive consultation tools</strong> & interactive visual record navigation.',
    ],
    testingTitle: 'Founding doctor invitation',
    testingBody:
      'We are building our initial physician network before public launch. Join a select group of clinicians to <strong>test, give feedback, and shape the platform</strong> with us.',
    earlyAdopterTitle: 'Why register now?',
    earlyAdopterBody:
      'Early founding doctors receive <strong>prioritised visibility and privileges after launch</strong> — more exposure to patients across the region and a stronger position in our network.',
    screenshotsTitle: 'A glimpse of the platform',
    screenshotCaptions: {
      chat: 'Cross-border video & chat consultations',
      xrayRecord: 'EMR tracking & structured clinical history',
      xrayDetail: 'Clinical imaging with structured review',
      skeleton: 'Interactive visual record navigation',
      ai: 'Ask 3elagi AI — clinical decision support',
    },
    cta: 'Register your interest — we will follow up to set up your profile and welcome you to the founding doctor community.',
    ctaButton: 'Join us — register your interest',
    closing:
      'We would be honoured to welcome you as a <strong>founding doctor</strong> in the 3elagi community.',
    signatureTeam: '3elagi — Founding Doctors Program',
    signatureTagline: 'Specialized remote care for the Gulf & Middle East',
    plainText: (name) =>
      [
        `Dear Dr. ${name},`,
        '',
        'Are you a practicing doctor looking to grow your patient base?',
        '',
        'By registering with 3elagi, you join a specialized remote consultation platform connecting physicians with patients across the Gulf and Middle East.',
        '',
        'Core features:',
        '• Cross-border remote consultations (video & chat)',
        '• EMR tracking & structured clinical history',
        '• Integrated AI clinical decision support — Ask 3elagi AI',
        '• Intuitive consultation tools & interactive visual record navigation',
        '',
        'Register your interest:',
        REGISTER_URL,
        '',
        'We would be honoured to welcome you as a founding doctor in the 3elagi community.',
        '',
        '— 3elagi Founding Doctors Program',
      ].join('\n'),
  },
  ar: {
    dir: 'rtl',
    subject: (name) => `د. ${name} — وسّع ممارستك مع 3elagi في الخليج والشرق الأوسط`,
    preheader:
      'استشارات عن بُعد، تتبع EMR، Ask 3elagi AI، وأدوات سريرية للخليج والشرق الأوسط.',
    greeting: (name) => `الدكتور/ة ${name}، تحية طيبة،`,
    intro: 'هل أنت طبيب/ة ممارس/ة وتسعى لتوسيع قاعدة مرضاك؟',
    valueProp:
      'بالتسجيل في <strong>3elagi</strong>، تنضم إلى منصة استشارات عن بُعد متخصصة تربط الأطباء الممارسين بمرضى في <strong>الخليج والشرق الأوسط</strong>.',
    featuresTitle: 'ما الذي تقدمه 3elagi لعيادتك',
    features: [
      '<strong>استشارات عن بُعد عابرة للحدود</strong> (فيديو ومحادثة) مع مرضى في الخليج والشرق الأوسط.',
      '<strong>تتبع السجل الطبي الإلكتروني (EMR)</strong> وتاريخ سريري منظم.',
      '<strong>دعم قرار سريري بالذكاء الاصطناعي</strong> — <strong>Ask 3elagi AI</strong>.',
      '<strong>أدوات استشارة بديهية</strong> وتصفح تفاعلي للسجل الطبي.',
    ],
    testingTitle: 'دعوة الأطباء المؤسسين',
    testingBody:
      'نبني شبكتنا الأولى من الأطباء قبل الإطلاق العام. انضم إلى مجموعة مختارة <strong>للاختبار وإبداء الرأي وصناعة المنصة</strong> معنا.',
    earlyAdopterTitle: 'لماذا التسجيل الآن؟',
    earlyAdopterBody:
      'الأطباء المؤسسون الأوائل يحصلون على <strong>أولوية في الظهور ومزايا بعد الإطلاق</strong> في المنطقة.',
    screenshotsTitle: 'لمحة عن المنصة',
    screenshotCaptions: {
      chat: 'استشارات فيديو ومحادثة عابرة للحدود',
      xrayRecord: 'تتبع EMR وتاريخ سريري منظم',
      xrayDetail: 'مراجعة تصوير سريري منظم',
      skeleton: 'تصفح تفاعلي للسجل الطبي',
      ai: 'Ask 3elagi AI — دعم قرار سريري',
    },
    cta: 'سجّل اهتمامك — سنتواصل معك للترحيب بك في مجتمع الأطباء المؤسسين.',
    ctaButton: 'انضم إلينا — سجّل اهتمامك',
    closing: 'يسعدنا أن نرحّب بك ك<strong>طبيب/ة مؤسس/ة</strong> في مجتمع 3elagi.',
    signatureTeam: '3elagi — برنامج الأطباء المؤسسين',
    signatureTagline: 'رعاية عن بُعد متخصصة للخليج والشرق الأوسط',
    plainText: (name) =>
      [
        `الدكتور/ة ${name}، تحية طيبة،`,
        '',
        'هل أنت طبيب/ة ممارس/ة وتسعى لتوسيع قاعدة مرضاك؟',
        '',
        'بالتسجيل في 3elagi، تنضم إلى منصة استشارات عن بُعد للخليج والشرق الأوسط.',
        '',
        `التسجيل: ${REGISTER_URL}`,
        '',
        '— برنامج الأطباء المؤسسين 3elagi',
      ].join('\n'),
  },
  es: {
    dir: 'ltr',
    subject: (name) => `Dr. ${name}, amplíe su consulta con 3elagi — Golfo y Oriente Medio`,
    preheader:
      'Consultas remotas transfronterizas, EMR, Ask 3elagi AI y herramientas clínicas intuitivas.',
    greeting: (name) => `Estimado/a Dr. ${name},`,
    intro: '¿Es usted un médico en ejercicio que busca ampliar su base de pacientes?',
    valueProp:
      'Al registrarse en <strong>3elagi</strong>, se une a una plataforma especializada de consultas remotas que conecta médicos en ejercicio con pacientes en el <strong>Golfo y Oriente Medio</strong>.',
    featuresTitle: 'Lo que 3elagi ofrece a su consulta',
    features: [
      '<strong>Consultas remotas transfronterizas</strong> (video y chat) con pacientes en el Golfo y Oriente Medio.',
      '<strong>Seguimiento de historial clínico electrónico (EMR)</strong> e historial clínico estructurado.',
      '<strong>Soporte clínico con IA integrada</strong> — <strong>Ask 3elagi AI</strong>.',
      '<strong>Herramientas de consulta intuitivas</strong> y navegación visual interactiva del historial.',
    ],
    testingTitle: 'Invitación a médicos fundadores',
    testingBody:
      'Estamos formando nuestra red inicial de médicos antes del lanzamiento público. Únase a un grupo selecto para <strong>probar, opinar y dar forma a la plataforma</strong>.',
    earlyAdopterTitle: '¿Por qué registrarse ahora?',
    earlyAdopterBody:
      'Los médicos fundadores reciben <strong>mayor visibilidad y privilegios tras el lanzamiento</strong> en toda la región.',
    screenshotsTitle: 'Un vistazo a la plataforma',
    screenshotCaptions: {
      chat: 'Consultas remotas por video y chat',
      xrayRecord: 'EMR e historial clínico estructurado',
      xrayDetail: 'Imagen clínica con revisión estructurada',
      skeleton: 'Navegación visual interactiva',
      ai: 'Ask 3elagi AI — soporte clínico',
    },
    cta: 'Registre su interés — le contactaremos para darle la bienvenida a la comunidad fundadora.',
    ctaButton: 'Únase — registre su interés',
    closing:
      'Sería un honor darle la bienvenida como <strong>médico fundador</strong> en la comunidad 3elagi.',
    signatureTeam: '3elagi — Programa de Médicos Fundadores',
    signatureTagline: 'Atención remota especializada para el Golfo y Oriente Medio',
    plainText: (name) =>
      [
        `Estimado/a Dr. ${name},`,
        '',
        '¿Es usted un médico en ejercicio que busca ampliar su base de pacientes?',
        '',
        `Registro: ${REGISTER_URL}`,
        '',
        '— Programa de Médicos Fundadores 3elagi',
      ].join('\n'),
  },
  de: {
    dir: 'ltr',
    subject: (name) => `Dr. ${name}, erweitern Sie Ihre Praxis mit 3elagi — Golf & Naher Osten`,
    preheader:
      'Grenzüberschreitende Remote-Konsultationen, EMR, Ask 3elagi AI und intuitive Kliniktools.',
    greeting: (name) => `Sehr geehrte/r Dr. ${name},`,
    intro:
      'Sind Sie praktizierender Arzt und möchten Ihre Patientenbasis vergrößern?',
    valueProp:
      'Mit der Registrierung bei <strong>3elagi</strong> treten Sie einer spezialisierten Remote-Konsultationsplattform bei, die praktizierende Ärzte mit Patienten im <strong>Golfraum und Nahen Osten</strong> verbindet.',
    featuresTitle: 'Was 3elagi Ihrer Praxis bietet',
    features: [
      '<strong>Grenzüberschreitende Remote-Konsultationen</strong> (Video & Chat) mit Patienten im Golfraum & Nahen Osten.',
      '<strong>Elektronische Patientenakte (EMR)</strong> & strukturierte klinische Historie.',
      '<strong>Integrierte KI-Klinikunterstützung</strong> — <strong>Ask 3elagi AI</strong>.',
      '<strong>Intuitive Konsultationstools</strong> & interaktive visuelle Aktennavigation.',
    ],
    testingTitle: 'Einladung für Gründungsärzte',
    testingBody:
      'Wir bauen unser erstes Ärztenetzwerk vor dem öffentlichen Start auf. Werden Sie Teil einer ausgewählten Gruppe zum <strong>Testen, Feedbackgeben und Mitgestalten</strong>.',
    earlyAdopterTitle: 'Warum jetzt registrieren?',
    earlyAdopterBody:
      'Frühe Gründungsärzte erhalten <strong>Priorität und Vorteile nach dem Launch</strong> in der gesamten Region.',
    screenshotsTitle: 'Ein Blick auf die Plattform',
    screenshotCaptions: {
      chat: 'Grenzüberschreitende Video- & Chat-Konsultationen',
      xrayRecord: 'EMR & strukturierte klinische Historie',
      xrayDetail: 'Klinische Bildgebung mit strukturierter Review',
      skeleton: 'Interaktive visuelle Aktennavigation',
      ai: 'Ask 3elagi AI — Klinikunterstützung',
    },
    cta: 'Melden Sie Ihr Interesse an — wir begrüßen Sie in der Gründungsärzte-Gemeinschaft.',
    ctaButton: 'Mitmachen — Interesse anmelden',
    closing:
      'Wir würden uns freuen, Sie als <strong>Gründungsarzt/Gründungsärztin</strong> in der 3elagi-Community begrüßen zu dürfen.',
    signatureTeam: '3elagi — Gründungsärzte-Programm',
    signatureTagline: 'Spezialisierte Remote-Versorgung für Golfraum & Nahen Osten',
    plainText: (name) =>
      [
        `Sehr geehrte/r Dr. ${name},`,
        '',
        'Sind Sie praktizierender Arzt und möchten Ihre Patientenbasis vergrößern?',
        '',
        `Registrierung: ${REGISTER_URL}`,
        '',
        '— 3elagi Gründungsärzte-Programm',
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

              <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px;text-align:${align};">
                <div style="font-size:18px;font-weight:900;color:${BRAND};margin-bottom:4px;">3elagi</div>
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">${copy.signatureTeam}</p>
                <p style="margin:0 0 8px;font-size:13px;color:#64748b;">${copy.signatureTagline}</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">${copy.closing}</p>
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
