export type MessageLanguage = 'ar' | 'en' | 'de' | 'es';

/** Detect whether text is primarily Arabic, English, German, or Spanish. */
export function detectMessageLanguage(
  text: string,
  allowUnknown = false,
): MessageLanguage | 'unknown' {
  const sample = text.trim();
  if (!sample) return allowUnknown ? 'unknown' : 'en';

  const arabicChars = (sample.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (sample.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const total = arabicChars + latinChars;

  // Even a short Arabic phrase should win over the profile language.
  if (arabicChars > 0 && (total === 0 || arabicChars >= latinChars)) {
    return 'ar';
  }
  if (total < 3) return allowUnknown ? 'unknown' : 'en';

  if (arabicChars / total > 0.25) return 'ar';

  const lower = sample.toLowerCase();
  const germanScore =
    (sample.match(/[äöüß]/gi) ?? []).length +
    (/\b(und|nicht|ist|das|die|der|ich|ein|eine|mit|für|auf|bitte|danke|wie|was|wo|warum)\b/i.test(
      lower,
    )
      ? 2
      : 0);
  const spanishScore =
    (sample.match(/[ñáéíóúü¿¡]/gi) ?? []).length +
    (/\b(el|la|los|las|que|por|para|con|es|está|como|más|hola|gracias|qué|cómo|dónde)\b/i.test(
      lower,
    )
      ? 2
      : 0);

  if (germanScore > spanishScore && germanScore > 0) return 'de';
  if (spanishScore > germanScore && spanishScore > 0) return 'es';
  if (germanScore > 0 && germanScore === spanishScore) {
    return allowUnknown ? 'unknown' : 'en';
  }

  return 'en';
}
