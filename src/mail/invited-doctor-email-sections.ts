import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import { createMarketingSectionId, type MarketingEmailSection } from './marketing-email-sections';

export {
  applyDoctorWelcomePlaceholders,
  applyDoctorWelcomeSections,
  DOCTOR_LOGIN_URL,
  type DoctorWelcomePlaceholders,
} from './doctor-welcome-email-sections';

const INVITED_SUBJECT: Record<MarketingEmailLanguage, (name: string) => string> = {
  en: (name) => `Dr. ${name}, you're invited to 3elagi — grow your practice remotely`,
  ar: (name) => `د. ${name} — دعوتك إلى 3elagi لتوسيع ممارستك عن بُعد`,
  es: (name) => `Dr. ${name}, le invitamos a 3elagi — haga crecer su práctica a distancia`,
  de: (name) => `Dr. ${name}, Ihre Einladung zu 3elagi — Praxis remote ausbauen`,
};

export function invitedDoctorSubject(
  language: MarketingEmailLanguage,
  name: string,
): string {
  return INVITED_SUBJECT[language](name.trim() || 'Doctor');
}

export function getDefaultInvitedDoctorSections(
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
        html: 'يسعدنا دعوتك إلى <strong>3elagi</strong>. منصّتنا تساعدك على <strong>زيادة عدد مرضاك</strong> — سواء بالوصول إلى مرضى من دول أخرى يبحثون عن تخصّصك، أو <strong>متابعة مرضاك الحاليين عن بُعد</strong> حتى لا تفقدهم بين الزيارات.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'كيف ينمو عدد مرضاك مع 3elagi',
        items: [
          '<strong>مرضى من دول أخرى</strong> يصلون إليك عن بُعد حسب تخصّصك.',
          '<strong>متابعة عن بُعد</strong> لمرضاك الحاليين بعد الزيارة.',
          '<strong>استشارات آمنة</strong> عبر المحادثة مع مشاركة السجل الطبي.',
          '<strong>طلبات تحاليل وأشعة</strong> داخل المحادثة دون عبء إداري.',
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
        type: 'screenshots',
        title: 'لمحة عن المنصّة',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'سجّل الدخول وابدأ استقبال المرضى عن بُعد.',
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
        html: 'Le invitamos a <strong>3elagi</strong>. Le ayudamos a <strong>aumentar su base de pacientes</strong>: llegando a personas en otros países que buscan su especialidad, y <strong>haciendo seguimiento remoto</strong> con pacientes actuales para no perderlos entre visitas.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'Cómo crece su práctica',
        items: [
          '<strong>Pacientes en otros países</strong> que le encuentran a distancia.',
          '<strong>Seguimiento remoto</strong> con pacientes actuales.',
          '<strong>Consultas seguras</strong> por chat con historiales compartidos.',
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
        type: 'screenshots',
        title: 'Un vistazo a la plataforma',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Inicie sesión y empiece a atender pacientes a distancia.',
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
        html: 'Wir laden Sie zu <strong>3elagi</strong> ein. Wir helfen Ihnen, <strong>mehr Patienten zu gewinnen</strong> — durch Patienten aus anderen Ländern, die Ihre Fachrichtung suchen, und durch <strong>Remote-Nachsorge</strong>, damit Sie bestehende Patienten zwischen Terminen nicht verlieren.',
      },
      {
        id: createMarketingSectionId(),
        type: 'feature_box',
        title: 'So wächst Ihre Praxis',
        items: [
          '<strong>Patienten aus anderen Ländern</strong> erreichen Sie remote.',
          '<strong>Nachsorge</strong> für bestehende Patienten nach dem Besuch.',
          '<strong>Sichere Chat-Konsultationen</strong> mit geteilten Befunden.',
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
        type: 'screenshots',
        title: 'Ein Blick auf die Plattform',
      },
      {
        id: createMarketingSectionId(),
        type: 'cta',
        html: 'Melden Sie sich an und starten Sie mit Remote-Patienten.',
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
      html: 'We’re glad to invite you to <strong>3elagi</strong>. Our platform helps you <strong>grow your patient base</strong> — by reaching patients in other countries who need your specialty, and by <strong>following up remotely</strong> with existing patients so you don’t lose them between visits.',
    },
    {
      id: createMarketingSectionId(),
      type: 'feature_box',
      title: 'How 3elagi grows your practice',
      items: [
        '<strong>Patients abroad</strong> can find and consult you remotely.',
        '<strong>Remote follow-ups</strong> keep existing patients engaged after clinic visits.',
        '<strong>Secure chat consultations</strong> with shared medical records.',
        '<strong>Lab and X-ray requests</strong> inside the chat — less admin work.',
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
      html: 'Log in and start caring for patients remotely.',
      buttonLabel: 'Log in to 3elagi',
      buttonUrl: '{{login_url}}',
    },
  ];
}
