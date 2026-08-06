/** Bundled campaign banner filenames (served from /advertisements/images/:filename). */
export const ADVERTISEMENT_IMAGE_FILES: Record<string, string> = {
  'Care in One Tap': 'banner-care-one-tap.png',
  'Trusted Doctors Near You': 'banner-trusted-doctors.png',
  'Your AI Health Companion': 'banner-ai-companion.png',
  'Book. Chat. Heal.': 'banner-book-chat-heal.png',
};

/** All files that may be served (visual-only art; copy rendered in the client). */
export const ADVERTISEMENT_ALLOWED_FILES: string[] = Object.values(
  ADVERTISEMENT_IMAGE_FILES,
);

/** Stored in advertisements.banner_image_url (relative to API prefix). */
export const ADVERTISEMENT_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(ADVERTISEMENT_IMAGE_FILES).map(([title, file]) => [
    title,
    `advertisements/images/${file}`,
  ]),
);
