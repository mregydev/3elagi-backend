/** Detect whether the user message is primarily Arabic or English. */
export function detectMessageLanguage(text: string): 'ar' | 'en' {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (arabicChars === 0 && latinChars === 0) return 'en';
  return arabicChars >= latinChars ? 'ar' : 'en';
}
