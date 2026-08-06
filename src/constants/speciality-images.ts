/** Bundled speciality image filenames (served from /specialities/images/:filename). */
export const SPECIALITY_IMAGE_FILES: Record<string, string> = {
  'General Medicine': 'general-medicine.png',
  Cardiology: 'cardiology.png',
  Dermatology: 'dermatology.png',
  Pediatrics: 'pediatrics.png',
  Orthopedics: 'orthopedics.png',
  Neurology: 'neurology.png',
  Ophthalmology: 'ophthalmology.png',
  Dentistry: 'dentistry.png',
  Surgery: 'surgery.png',
  Emergency: 'emergency.png',
  Gynaecology: 'gynaecology.png',
};

export function specialityImagePath(nameEn: string): string {
  const file = SPECIALITY_IMAGE_FILES[nameEn];
  return file ? `specialities/images/${file}` : '';
}

/** Stored in doctor_specialities.image_url (relative to API prefix). */
export const SPECIALITY_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIALITY_IMAGE_FILES).map(([nameEn, file]) => [
    nameEn,
    `specialities/images/${file}`,
  ]),
);

export function resolveSpecialityPublicUrl(
  stored: string,
  publicApiUrl?: string,
): string {
  if (!stored) return stored;
  if (stored.startsWith('http://') || stored.startsWith('https://')) {
    return stored;
  }
  const base = (publicApiUrl || process.env.PUBLIC_API_URL || '').replace(
    /\/$/,
    '',
  );
  if (!base) return stored;
  const path = stored.startsWith('3eyadahub-api/')
    ? stored
    : `3eyadahub-api/${stored.replace(/^\//, '')}`;
  return `${base}/${path}`;
}
