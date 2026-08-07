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
  return 'ar';
}

/**
 * Reply language for this turn: always follow the question language when
 * detectable. Profile / app language is only a fallback for unknown text.
 */
export function resolveReplyLocale(
  message: string,
  preferredLocale: AppLocale,
): AppLocale {
  const detected = detectMessageLocale(message);
  if (detected === 'unknown') return preferredLocale;
  // Question language wins even when it differs from profile settings.
  return detected;
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
