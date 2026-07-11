export type AppLocale = 'ar' | 'en';

const ATTACHED_DOC_MARKER = '[Attached document contents]';

/** Strip embedded document text before detecting the user's own language. */
export function stripAttachmentBlock(message: string): string {
  const idx = message.indexOf(ATTACHED_DOC_MARKER);
  const head = idx >= 0 ? message.slice(0, idx) : message;
  return head.trim();
}

/** Rough detection of Arabic vs English in user-typed text. */
export function detectMessageLocale(text: string): AppLocale | 'unknown' {
  const sample = stripAttachmentBlock(text).trim();
  if (!sample) return 'unknown';

  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (sample.match(/[a-zA-Z]/g) ?? []).length;
  const total = arabicChars + latinChars;
  if (total < 3) return 'unknown';

  const arabicRatio = arabicChars / total;
  if (arabicRatio > 0.4) return 'ar';
  if (arabicRatio < 0.15) return 'en';
  return 'unknown';
}

export function resolvePreferredLocale(
  value: string | null | undefined,
): AppLocale {
  return value === 'ar' ? 'ar' : 'en';
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
  if (preferred === 'ar') {
    return 'لغة التطبيق مضبوطة على العربية. من فضلك اكتب رسالتك بالعربية، أو غيّر لغة التطبيق من الإعدادات في ملفك الشخصي ثم أعد الإرسال.';
  }
  return 'Your app language is set to English. Please write your message in English, or change your language in Profile → Settings and try again.';
}

export function localeLabel(preferred: AppLocale): string {
  return preferred === 'ar' ? 'Arabic (Egyptian)' : 'English';
}
