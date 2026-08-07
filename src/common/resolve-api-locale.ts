export type ApiLocale = 'ar' | 'en' | 'de' | 'es';

export function resolveApiLocale(lang?: string | null): ApiLocale {
  const v = lang?.trim().toLowerCase();
  if (v === 'ar' || v === 'en' || v === 'de' || v === 'es') return v;
  return 'ar';
}

export function outputLanguageLabel(lang: ApiLocale): string {
  switch (lang) {
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
