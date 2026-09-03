import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import { createMarketingSectionId, type MarketingEmailSection } from './marketing-email-sections';

const DOCTOR_LOGIN_URL =
  process.env.DOCTOR_LOGIN_URL?.trim() || 'https://development.3elagi.net';

export { DOCTOR_LOGIN_URL };

export function getDefaultDoctorWelcomeSections(
  language: MarketingEmailLanguage,
): MarketingEmailSection[] {
  if (language === 'ar') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: 'مرحباً د. {{name}} — حسابك على 3elagi جاهز',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'أنشأنا لك حساب طبيب على <strong>3elagi</strong> — منصة الاستشارات الطبية عن بُعد. نساعدك على <strong>الوصول لمرضى جدد عن بُعد</strong> ومتابعة مرضاك الحاليين بسهولة.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'لماذا 3elagi؟',
        items: [
          '<strong>استشارات آمنة عبر المحادثة</strong> مع مشاركة السجلات الطبية.',
          '<strong>مرضى عن بُعد</strong> يوسّعون ممارستك خارج العيادة.',
          '<strong>متابعة المرضى الحاليين</strong> بعد الزيارة.',
          '<strong>طلبات تحاليل وأشعة</strong> داخل المحادثة.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'بيانات الدخول',
        html: 'البريد: <strong>{{email}}</strong><br/>كلمة المرور: <strong>{{password}}</strong>',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'سجّل الدخول وابدأ استخدام المنصة.',
        buttonLabel: 'تسجيل الدخول',
        buttonUrl: '{{login_url}}',
      },
    ];
  }

  if (language === 'es') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: 'Bienvenido/a Dr. {{name}} — su cuenta 3elagi está lista',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Creamos su cuenta de médico en <strong>3elagi</strong>, nuestra plataforma de consultas en línea. Le ayudamos a <strong>atraer pacientes remotos</strong> y hacer seguimiento con pacientes existentes.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Por qué 3elagi',
        items: [
          '<strong>Consultas seguras por chat</strong> con historiales compartidos.',
          '<strong>Pacientes remotos</strong> amplían su práctica.',
          '<strong>Seguimiento</strong> con pacientes actuales.',
          '<strong>Solicitudes de laboratorio y radiografía</strong> en el chat.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'Sus credenciales',
        html: 'Correo: <strong>{{email}}</strong><br/>Contraseña: <strong>{{password}}</strong>',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Inicie sesión y empiece a usar la plataforma.',
        buttonLabel: 'Iniciar sesión',
        buttonUrl: '{{login_url}}',
      },
    ];
  }

  if (language === 'de') {
    return [
      {
        id: createMarketingSectionId(),
        type: 'heading',
        html: 'Willkommen Dr. {{name}} — Ihr 3elagi-Konto ist bereit',
      },
      {
        id: createMarketingSectionId(),
        type: 'paragraph',
        html: 'Wir haben Ihr Arztkonto auf <strong>3elagi</strong> eingerichtet — unserer Online-Konsultationsplattform. Wir helfen Ihnen, <strong>entfernte Patienten zu gewinnen</strong> und Bestandspatienten nachzubetreuen.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Warum 3elagi',
        items: [
          '<strong>Sichere Chat-Konsultationen</strong> mit geteilten Befunden.',
          '<strong>Remote-Patienten</strong> erweitern Ihre Praxis.',
          '<strong>Nachsorge</strong> für bestehende Patienten.',
          '<strong>Labor- und Röntgenanforderungen</strong> im Chat.',
        ],
      },
      {
        id: createMarketingSectionId(),
        type: 'callout',
        variant: 'soft',
        title: 'Ihre Zugangsdaten',
        html: 'E-Mail: <strong>{{email}}</strong><br/>Passwort: <strong>{{password}}</strong>',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Melden Sie sich an und starten Sie auf der Plattform.',
        buttonLabel: 'Anmelden',
        buttonUrl: '{{login_url}}',
      },
    ];
  }

  return [
    {
      id: createMarketingSectionId(),
      type: 'heading',
      html: 'Welcome to 3elagi, Dr. {{name}}',
    },
    {
      id: createMarketingSectionId(),
      type: 'paragraph',
      html: 'We created your doctor account on <strong>3elagi</strong> — our online consultation platform. We help you <strong>reach remote patients</strong> and stay connected with existing patients through follow-ups.',
    },
    {
      id: createMarketingSectionId(),
      type: 'feature_box',
      title: 'Why doctors choose 3elagi',
      items: [
        '<strong>Secure chat consultations</strong> with shared medical records.',
        '<strong>Remote patients</strong> expand your practice beyond the clinic.',
        '<strong>Follow-ups</strong> with your existing patients after visits.',
        '<strong>Lab and X-ray requests</strong> inside the consultation chat.',
      ],
    },
    {
      id: createMarketingSectionId(),
      type: 'callout',
      variant: 'soft',
      title: 'Your login credentials',
      html: 'Email: <strong>{{email}}</strong><br/>Password: <strong>{{password}}</strong>',
    },
    {
      id: createMarketingSectionId(),
      type: 'screenshots',
      title: 'A glimpse of the platform',
    },
    {
      id: createMarketingSectionId(),
      type: 'cta',
      html: 'Log in and start using your account.',
      buttonLabel: 'Log in to 3elagi',
      buttonUrl: '{{login_url}}',
    },
  ];
}

export interface DoctorWelcomePlaceholders {
  name: string;
  email: string;
  password: string;
  loginUrl?: string;
}

function applyToOptional(
  value: string | undefined,
  vars: DoctorWelcomePlaceholders,
): string | undefined {
  if (!value) return value;
  return applyDoctorWelcomePlaceholders(value, vars);
}

export function applyDoctorWelcomePlaceholders(
  content: string,
  vars: DoctorWelcomePlaceholders,
): string {
  const loginUrl = vars.loginUrl?.trim() || DOCTOR_LOGIN_URL;
  return content
    .replace(/\{\{name\}\}/g, vars.name)
    .replace(/\{\{email\}\}/g, vars.email)
    .replace(/\{\{password\}\}/g, vars.password)
    .replace(/\{\{login_url\}\}/g, loginUrl);
}

export function applyDoctorWelcomeSections(
  sections: MarketingEmailSection[],
  vars: DoctorWelcomePlaceholders,
): MarketingEmailSection[] {
  return sections.map((section) => ({
    ...section,
    html: applyToOptional(section.html, vars),
    title: applyToOptional(section.title, vars),
    buttonLabel: applyToOptional(section.buttonLabel, vars),
    buttonUrl: applyToOptional(section.buttonUrl, vars),
    items: section.items?.map((item) => applyDoctorWelcomePlaceholders(item, vars)),
  }));
}

const WELCOME_SUBJECT: Record<MarketingEmailLanguage, (name: string) => string> = {
  en: (name) => `Dr. ${name}, your 3elagi doctor account is ready`,
  ar: (name) => `د. ${name} — حسابك على 3elagi جاهز`,
  es: (name) => `Dr. ${name}, su cuenta 3elagi está lista`,
  de: (name) => `Dr. ${name}, Ihr 3elagi-Arztkonto ist bereit`,
};

export function doctorWelcomeSubject(
  language: MarketingEmailLanguage,
  name: string,
): string {
  return WELCOME_SUBJECT[language](name.trim() || 'Doctor');
}
