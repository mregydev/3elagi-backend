import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import {
  MARKETING_SCREENSHOT_URLS,
  resolveMarketingImageUrls,
  type MarketingScreenshotKey,
} from './marketing-screenshots.constants';
import {
  MARKETING_THEME_COLORS,
  resolveMarketingEmailTheme,
  type MarketingEmailTheme,
} from './marketing-email-themes';

const REGISTER_URL = 'https://www.3elagi.net/register-with-us';
const ANDROID_APP_URL =
  process.env.ANDROID_APP_URL?.trim() ||
  'https://play.google.com/apps/internaltest/4700519020943782529';

export { ANDROID_APP_URL, REGISTER_URL };

const MARKETING_SCREENSHOT_KEYS: MarketingScreenshotKey[] = [
  'chat',
  'xrayRecord',
  'xrayDetail',
  'skeleton',
  'ai',
];

export const MARKETING_SECTION_TYPES = [
  'heading',
  'paragraph',
  'feature_box',
  'callout',
  'screenshots',
  'cta',
  'custom',
] as const;

export type MarketingSectionType = (typeof MARKETING_SECTION_TYPES)[number];
export type MarketingCalloutVariant = 'accent' | 'soft' | 'highlight';

export interface MarketingEmailSection {
  id: string;
  type: MarketingSectionType;
  html?: string;
  title?: string;
  items?: string[];
  variant?: MarketingCalloutVariant;
  buttonLabel?: string;
  buttonUrl?: string;
}

export function createMarketingSectionId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function themeColors(theme: MarketingEmailTheme) {
  return MARKETING_THEME_COLORS[theme];
}

function featureList(items: string[], dir: 'ltr' | 'rtl'): string {
  const align = dir === 'rtl' ? 'right' : 'left';
  return `<ul style="margin:0;padding-${dir === 'rtl' ? 'right' : 'left'}:20px;text-align:${align};color:#334155;line-height:1.65;">${items
    .map((item) => `<li style="margin-bottom:10px;">${item}</li>`)
    .join('')}</ul>`;
}

function screenshotGrid(
  title: string,
  captions: Record<MarketingScreenshotKey, string>,
  dir: 'ltr' | 'rtl',
  brand: string,
): string {
  const shots = MARKETING_SCREENSHOT_KEYS.map((key) => {
    const caption = captions[key];
    return `
      <td style="padding:8px;width:50%;vertical-align:top;">
        <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc;">
          <img src="${MARKETING_SCREENSHOT_URLS[key]}" alt="${caption}" width="100%" style="display:block;width:100%;height:auto;border:0;" />
          <p style="margin:0;padding:10px 12px;font-size:12px;color:#64748b;text-align:center;">${caption}</p>
        </div>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < shots.length; i += 2) {
    rows.push(`<tr>${shots[i]}${shots[i + 1] ?? '<td></td>'}</tr>`);
  }

  return `
    <h2 style="margin:28px 0 14px;font-size:18px;color:${brand};text-align:${dir === 'rtl' ? 'right' : 'left'};">${title}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" dir="${dir}">${rows.join('')}</table>`;
}

const SCREENSHOT_CAPTIONS: Record<
  MarketingEmailLanguage,
  Record<MarketingScreenshotKey, string>
> = {
  en: {
    chat: 'Cross-border video & chat consultations',
    xrayRecord: 'EMR tracking & structured clinical history',
    xrayDetail: 'Clinical imaging with structured review',
    skeleton: 'Interactive visual record navigation',
    ai: 'Ask 3elagi AI — clinical decision support',
  },
  ar: {
    chat: 'استشارات مع مشاركة السجلات',
    xrayRecord: 'سجلات طبية مع رؤى الذكاء الاصطناعي',
    xrayDetail: 'مراجعة أشعة مع تمييز سريري',
    skeleton: 'عرض الهيكل التفاعلي للسجل',
    ai: 'مساعد ذكي للسجلات والوصفات',
  },
  es: {
    chat: 'Consultas con historiales compartidos',
    xrayRecord: 'Registros médicos con IA',
    xrayDetail: 'Revisión de radiografías',
    skeleton: 'Vista esquelética interactiva',
    ai: 'Asistente IA para registros y recetas',
  },
  de: {
    chat: 'Chat mit geteilten Befunden',
    xrayRecord: 'Akten mit KI-Einblick',
    xrayDetail: 'Röntgen-Review mit Markierungen',
    skeleton: 'Interaktive Skelett-Ansicht',
    ai: 'KI-Assistent für Akten & Rezepte',
  },
};

export function compileMarketingSections(
  sections: MarketingEmailSection[],
  language: MarketingEmailLanguage,
  theme: MarketingEmailTheme = 'blue',
  dir: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr',
): string {
  const {
    brand: BRAND,
    brandDark: BRAND_DARK,
    tint: BRAND_TINT,
    tintSoft: BRAND_TINT_SOFT,
    highlightBorder: HIGHLIGHT_BORDER,
  } = themeColors(resolveMarketingEmailTheme(theme));
  const align = dir === 'rtl' ? 'right' : 'left';
  const captions = SCREENSHOT_CAPTIONS[language];
  const chunks: string[] = [];

  for (const section of sections) {
    switch (section.type) {
      case 'heading':
        if (section.html?.trim()) {
          chunks.push(
            `<p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;text-align:${align};">${section.html}</p>`,
          );
        }
        break;
      case 'paragraph':
        if (section.html?.trim()) {
          chunks.push(
            `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;text-align:${align};">${section.html}</p>`,
          );
        }
        break;
      case 'feature_box': {
        const items = (section.items ?? []).filter(Boolean);
        if (!section.title?.trim() && !items.length) break;
        chunks.push(`
              <div style="background:${BRAND_TINT};border-${dir === 'rtl' ? 'right' : 'left'}:4px solid ${BRAND};border-radius:12px;padding:18px 20px;margin-bottom:22px;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
                ${section.title?.trim() ? `<h2 style="margin:0 0 12px;font-size:17px;color:${BRAND_DARK};text-align:${align};">${section.title}</h2>` : ''}
                ${items.length ? featureList(items, dir) : ''}
              </div>`);
        break;
      }
      case 'callout': {
        const variant = section.variant ?? 'soft';
        const bg = variant === 'soft' ? BRAND_TINT_SOFT : BRAND_TINT;
        const titleColor = variant === 'highlight' ? BRAND : BRAND_DARK;
        const border =
          variant === 'highlight' ? `border:1px solid ${HIGHLIGHT_BORDER};` : '';
        if (!section.title?.trim() && !section.html?.trim()) break;
        chunks.push(`
              <div style="background:${bg};border-radius:12px;padding:18px 20px;margin-bottom:18px;${border}">
                ${section.title?.trim() ? `<h3 style="margin:0 0 8px;font-size:16px;color:${titleColor};text-align:${align};">${section.title}</h3>` : ''}
                ${section.html?.trim() ? `<p style="margin:0;font-size:14px;line-height:1.65;color:#334155;text-align:${align};">${section.html}</p>` : ''}
              </div>`);
        break;
      }
      case 'screenshots':
        if (section.title?.trim()) {
          chunks.push(screenshotGrid(section.title, captions, dir, BRAND));
        }
        break;
      case 'cta': {
        const buttonUrl = section.buttonUrl?.trim() || REGISTER_URL;
        const buttonLabel = section.buttonLabel?.trim() || 'Register';
        chunks.push(`
              ${section.html?.trim() ? `<p style="margin:28px 0 18px;font-size:15px;line-height:1.7;color:#334155;text-align:${align};">${section.html}</p>` : ''}
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:12px;background:${BRAND};">
                    <a href="${buttonUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;">${buttonLabel}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;text-align:center;word-break:break-all;">
                <a href="${buttonUrl}" style="color:${BRAND_DARK};">${buttonUrl}</a>
              </p>`);
        break;
      }
      case 'custom':
        if (section.html?.trim()) chunks.push(section.html);
        break;
      default:
        break;
    }
  }

  return resolveMarketingImageUrls(chunks.join('\n').trim());
}

export function getDefaultMarketingSections(
  language: MarketingEmailLanguage,
): MarketingEmailSection[] {
  if (language === 'ar') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: 'هل أنت طبيب/ة ممارس/ة وتسعى لتوسيع قاعدة مرضاك؟',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'الدكتور/ة {{name}}، تحية طيبة،',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'بالتسجيل في <strong>3elagi</strong>، تنضم إلى منصة استشارات عن بُعد متخصصة تربط الأطباء الممارسين بمرضى في <strong>الخليج والشرق الأوسط</strong> — لتوسيع نطاق ممارستك خارج جدران العيادة.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'ما الذي تقدمه 3elagi لعيادتك',
        items: [
          '<strong>استشارات عن بُعد عابرة للحدود</strong> (فيديو ومحادثة) مع مرضى في الخليج والشرق الأوسط.',
          '<strong>تتبع السجل الطبي الإلكتروني (EMR)</strong> وتاريخ سريري منظم.',
          '<strong>دعم قرار سريري بالذكاء الاصطناعي</strong> — <strong>Ask 3elagi AI</strong>.',
          '<strong>أدوات استشارة بديهية</strong> وتصفح تفاعلي للسجل الطبي.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'دعوة الأطباء المؤسسين',
        html: 'نبني شبكتنا الأولى من الأطباء قبل الإطلاق العام. انضم إلى مجموعة مختارة <strong>للاختبار وإبداء الرأي وصناعة المنصة</strong> معنا.',
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'highlight',
        title: 'لماذا التسجيل الآن؟',
        html: 'الأطباء المؤسسون الأوائل يحصلون على <strong>أولوية في الظهور ومزايا بعد الإطلاق</strong> — تعرض أكبر للمرضى في المنطقة.',
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'لمحة عن المنصة' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'سجّل اهتمامك — سنتواصل معك لإعداد ملفك والترحيب بك في مجتمع الأطباء المؤسسين.',
        buttonLabel: 'انضم إلينا — سجّل اهتمامك',
        buttonUrl: REGISTER_URL,
      },
    ];
  }

  if (language === 'es') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: '¿Es usted un médico en ejercicio que busca ampliar su base de pacientes?',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Estimado/a Dr. {{name}},',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Al registrarse en <strong>3elagi</strong>, se une a una plataforma especializada de consultas remotas que conecta a médicos en ejercicio con pacientes en el <strong>Golfo y Oriente Medio</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Lo que 3elagi ofrece a su consulta',
        items: [
          '<strong>Consultas remotas transfronterizas</strong> (video y chat) con pacientes en el Golfo y Oriente Medio.',
          '<strong>Seguimiento de historial clínico electrónico (EMR)</strong> e historial clínico estructurado.',
          '<strong>Soporte clínico con IA integrada</strong> — <strong>Ask 3elagi AI</strong>.',
          '<strong>Herramientas de consulta intuitivas</strong> y navegación visual interactiva del historial.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'Invitación a médicos fundadores',
        html: 'Estamos formando nuestra red inicial de médicos antes del lanzamiento público. Únase a un grupo selecto para <strong>probar, opinar y dar forma a la plataforma</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'highlight',
        title: '¿Por qué registrarse ahora?',
        html: 'Los médicos fundadores reciben <strong>mayor visibilidad y privilegios tras el lanzamiento</strong> en toda la región.',
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'Un vistazo a la plataforma' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Registre su interés — le contactaremos para configurar su perfil y darle la bienvenida a la comunidad fundadora.',
        buttonLabel: 'Únase — registre su interés',
        buttonUrl: REGISTER_URL,
      },
    ];
  }

  if (language === 'de') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: 'Sind Sie praktizierender Arzt und möchten Ihre Patientenbasis vergrößern?',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Sehr geehrte/r Dr. {{name}},',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Mit der Registrierung bei <strong>3elagi</strong> treten Sie einer spezialisierten Remote-Konsultationsplattform bei, die praktizierende Ärzte mit Patienten im <strong>Golfraum und Nahen Osten</strong> verbindet.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Was 3elagi Ihrer Praxis bietet',
        items: [
          '<strong>Grenzüberschreitende Remote-Konsultationen</strong> (Video &amp; Chat) mit Patienten im Golfraum &amp; Nahen Osten.',
          '<strong>Elektronische Patientenakte (EMR)</strong> &amp; strukturierte klinische Historie.',
          '<strong>Integrierte KI-Klinikunterstützung</strong> — <strong>Ask 3elagi AI</strong>.',
          '<strong>Intuitive Konsultationstools</strong> &amp; interaktive visuelle Aktennavigation.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'Einladung für Gründungsärzte',
        html: 'Wir bauen unser erstes Ärztenetzwerk vor dem öffentlichen Start auf. Werden Sie Teil einer ausgewählten Gruppe zum <strong>Testen, Feedbackgeben und Mitgestalten</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'highlight',
        title: 'Warum jetzt registrieren?',
        html: 'Frühe Gründungsärzte erhalten <strong>Priorität und Vorteile nach dem Launch</strong> — mehr Sichtbarkeit in der Region.',
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'Ein Blick auf die Plattform' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Melden Sie Ihr Interesse an — wir kontaktieren Sie zur Profileinrichtung und begrüßen Sie in der Gründungsgemeinschaft.',
        buttonLabel: 'Mitmachen — Interesse anmelden',
        buttonUrl: REGISTER_URL,
      },
    ];
  }

  return [
    {
      id: createMarketingSectionId(),
      type: 'heading',
      html: 'Are you a practicing doctor looking to grow your patient base?',
    },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'Dear Dr. {{name}},',
    },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'By registering with <strong>3elagi</strong>, you join a specialized remote consultation platform that connects practicing physicians with patients across the <strong>Gulf and Middle East</strong> — expanding your reach beyond the walls of your clinic.',
    },
    {
      id: createMarketingSectionId(),
      type: 'feature_box',
      title: 'What 3elagi offers your practice',
      items: [
        '<strong>Cross-border remote consultations</strong> (video &amp; chat) with patients in the Gulf &amp; Middle East.',
        '<strong>Electronic Medical Record (EMR) tracking</strong> &amp; structured clinical history.',
        '<strong>Integrated AI clinical decision support</strong> — <strong>Ask 3elagi AI</strong>.',
        '<strong>Intuitive consultation tools</strong> &amp; interactive visual record navigation.',
      ],
    },
    {
      id: createMarketingSectionId(),
      type: 'callout',
      variant: 'soft',
      title: 'Founding doctor invitation',
      html: 'We are building our initial physician network before public launch. Join a select group of clinicians to <strong>test, give feedback, and shape the platform</strong> with us.',
    },
    {
      id: createMarketingSectionId(),
      type: 'callout',
      variant: 'highlight',
      title: 'Why register now?',
      html: 'Early founding doctors receive <strong>prioritised visibility and privileges after launch</strong> — more exposure to patients across the region and a stronger position in our network.',
    },
    { id: createMarketingSectionId(), type: 'screenshots', title: 'A glimpse of the platform' },
    {
      id: createMarketingSectionId(),
      type: 'cta',
      html: 'Register your interest — we will follow up to set up your profile and welcome you to the founding doctor community.',
      buttonLabel: 'Join us — register your interest',
      buttonUrl: REGISTER_URL,
    },
  ];
}
