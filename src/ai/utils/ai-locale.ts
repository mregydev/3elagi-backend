import { detectMessageLanguage } from './detect-message-language';

export type AppLocale = 'ar' | 'en' | 'de' | 'es';

const ATTACHED_DOC_MARKER = '[Attached document contents]';
export const ATTACHMENT_ONLY_PLACEHOLDER = 'Please review the attachment.';

/** Strip embedded document text before detecting the user's own language. */
export function stripAttachmentBlock(message: string): string {
  const idx = message.indexOf(ATTACHED_DOC_MARKER);
  const head = idx >= 0 ? message.slice(0, idx) : message;
  return head.trim();
}

/** Text stored/shown for user messages (no embedded doc body or attachment-only filler). */
export function userMessageDisplayContent(
  message: string,
  hasAttachment: boolean,
): string {
  const text = stripAttachmentBlock(message);
  if (hasAttachment && (text === ATTACHMENT_ONLY_PLACEHOLDER || !text)) {
    return '';
  }
  return text;
}

/** Rough detection of the language used in user-typed text. */
export function detectMessageLocale(text: string): AppLocale | 'unknown' {
  const sample = stripAttachmentBlock(text).trim();
  if (!sample) return 'unknown';
  return detectMessageLanguage(sample, true);
}

export function resolvePreferredLocale(
  value: string | null | undefined,
): AppLocale {
  const v = value?.trim().toLowerCase();
  if (v === 'ar' || v === 'en' || v === 'de' || v === 'es') return v;
  return 'en';
}

export function messageLocaleMismatch(
  preferred: AppLocale,
  message: string,
): boolean {
  const detected = detectMessageLocale(message);
  if (detected === 'unknown') return false;
  return detected !== preferred;
}

export function localeMismatchReply(preferred: AppLocale): string {
  switch (preferred) {
    case 'ar':
      return 'لغة التطبيق مضبوطة على العربية. من فضلك اكتب رسالتك بالعربية، أو غيّر لغة التطبيق من الإعدادات في ملفك الشخصي ثم أعد الإرسال.';
    case 'de':
      return 'Die App-Sprache ist auf Deutsch eingestellt. Bitte schreiben Sie auf Deutsch oder ändern Sie die Sprache unter Profil → Einstellungen und versuchen Sie es erneut.';
    case 'es':
      return 'El idioma de la app está en español. Escribe en español o cambia el idioma en Perfil → Ajustes e inténtalo de nuevo.';
    default:
      return 'Your app language is set to English. Please write your message in English, or change your language in Profile → Settings and try again.';
  }
}

export function localeLabel(preferred: AppLocale): string {
  switch (preferred) {
    case 'ar':
      return 'Arabic (Egyptian)';
    case 'de':
      return 'German';
    case 'es':
      return 'Spanish';
    default:
      return 'English';
  }
}
