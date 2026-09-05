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
    chat: 'Chat consultations with shared records',
    xrayRecord: 'Medical records with AI insight',
    xrayDetail: 'X-ray review with clinical highlights',
    skeleton: 'Interactive skeleton view of patient records',
    ai: 'AI assistant for records & prescriptions',
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
              <div style="background:${BRAND_TINT};border-${dir === 'rtl' ? 'right' : 'left'}:4px solid ${BRAND};border-radius:12px;padding:18px 20px;margin-bottom:22px;">
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
      { id: createMarketingSectionId(), type: 'heading', html: 'الدكتور/ة {{name}}، تحية طيبة،' },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'نبني <strong>3elagi</strong> — منصة استشارات طبية حديثة للأطباء في <strong>الخليج والشرق الأوسط</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'ماذا يمكنك أن تفعل على 3elagi؟',
        items: [
          '<strong>استشارات آمنة عبر المحادثة</strong> مع مشاركة السجلات الطبية.',
          '<strong>عرض السجلات كقائمة أو على هيكل جسم تفاعلي</strong>.',
          '<strong>مساعد ذكي للسجلات والوصفات</strong>.',
          '<strong>استشارات فيديو</strong> مع مشاركة السجلات مباشرة.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'نحن في مرحلة الاختبار',
        html: 'ندعو مجموعة مختارة من الأطباء <strong>للاختبار وإبداء الرأي</strong> قبل الإطلاق.',
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'لمحة عن المنصة' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'سجّل اهتمامك وسننشئ لك <strong>حساباً تجريبياً</strong>.',
        buttonLabel: 'انضم إلينا — سجّل اهتمامك',
        buttonUrl: REGISTER_URL,
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'جرّب <strong>تطبيق Android</strong> على Google Play. تأكد أن بريدك مدعُو للوصول.',
        buttonLabel: 'تحميل تطبيق Android',
        buttonUrl: ANDROID_APP_URL,
      },
    ];
  }

  if (language === 'es') {
    return [
      { id: createMarketingSectionId(), type: 'heading', html: 'Estimado/a Dr. {{name}},' },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Desarrollamos <strong>3elagi</strong> — consultas en línea para el <strong>Golfo y Oriente Medio</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Qué puede hacer en 3elagi',
        items: [
          '<strong>Consultas seguras por chat</strong>.',
          '<strong>Historiales en lista o esqueleto corporal</strong>.',
          '<strong>IA para registros y recetas</strong>.',
          '<strong>Videoconsultas</strong>.',
        ],
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'Un vistazo a la plataforma' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: '¿Le interesa? Registre su interés.',
        buttonLabel: 'Únase — registre su interés',
        buttonUrl: REGISTER_URL,
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Pruebe la <strong>app de Android</strong> en Google Play. Asegúrese de que su correo esté invitado.',
        buttonLabel: 'Descargar app de Android',
        buttonUrl: ANDROID_APP_URL,
      },
    ];
  }

  if (language === 'de') {
    return [
      { id: createMarketingSectionId(), type: 'heading', html: 'Sehr geehrte/r Dr. {{name}},' },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Wir entwickeln <strong>3elagi</strong> — Telemedizin für den <strong>Golfraum & Nahen Osten</strong>.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Das bietet 3elagi',
        items: [
          '<strong>Sichere Chat-Konsultationen</strong>.',
          '<strong>Interaktives Körperskelett</strong>.',
          '<strong>KI-Assistent</strong>.',
          '<strong>Videosprechstunden</strong>.',
        ],
      },
      { id: createMarketingSectionId(), type: 'screenshots', title: 'Ein Blick auf die Plattform' },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Registrieren Sie sich für ein Testkonto.',
        buttonLabel: 'Mitmachen — Interesse anmelden',
        buttonUrl: REGISTER_URL,
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Testen Sie die <strong>Android-App</strong> bei Google Play. Stellen Sie sicher, dass Ihre E-Mail eingeladen ist.',
        buttonLabel: 'Android-App herunterladen',
        buttonUrl: ANDROID_APP_URL,
      },
    ];
  }

  return [
    { id: createMarketingSectionId(), type: 'heading', html: 'Dear Dr. {{name}},' },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'We are building <strong>3elagi</strong> — a modern online consultation platform for the <strong>Gulf and Middle East</strong>.',
    },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'Whether you want <strong>more patients</strong>, smoother follow-ups, or a professional digital clinic, 3elagi grows with you before our public launch.',
    },
    {
      id: createMarketingSectionId(),
      type: 'feature_box',
      title: 'What you can do on 3elagi',
      items: [
        '<strong>Secure chat consultations</strong> with medical record sharing.',
        '<strong>View records as a list or interactive body skeleton</strong>.',
        '<strong>Ask 3elagi AI about patient status</strong> and prescription help.',
        '<strong>Video consultations</strong> with live record sharing.',
      ],
    },
    {
      id: createMarketingSectionId(),
      type: 'callout',
      variant: 'soft',
      title: 'We are in testing phase',
      html: 'Join a select group of clinicians to <strong>test, give feedback, and shape the product</strong>.',
    },
    {
      id: createMarketingSectionId(),
      type: 'callout',
      variant: 'highlight',
      title: 'Why join from the start?',
      html: 'Early doctors receive <strong>prioritised visibility and privileges after launch</strong>.',
    },
    { id: createMarketingSectionId(), type: 'screenshots', title: 'A glimpse of the platform' },
    {
      id: createMarketingSectionId(),
      type: 'cta',
      html: 'Register your interest — we will create a <strong>test account</strong> and send web + mobile links.',
      buttonLabel: 'Join us — register your interest',
      buttonUrl: REGISTER_URL,
    },
    {
      id: createMarketingSectionId(),
      type: 'cta',
      html: 'Try the <strong>Android app</strong> on Google Play (internal test). Make sure your email is invited to access the app.',
      buttonLabel: 'Download Android app',
      buttonUrl: ANDROID_APP_URL,
    },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'We would be honoured to have you in our founding doctor community.',
    },
  ];
}
