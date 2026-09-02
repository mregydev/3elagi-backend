/** Matches 3elagi-mobile/constants/colors.ts ACCENTS palettes. */
export const MARKETING_EMAIL_THEMES = ['blue', 'green', 'red'] as const;
export type MarketingEmailTheme = (typeof MARKETING_EMAIL_THEMES)[number];

export const DEFAULT_MARKETING_EMAIL_THEME: MarketingEmailTheme = 'blue';

export interface MarketingEmailThemeColors {
  brand: string;
  gradientEnd: string;
  brandDark: string;
  tint: string;
  tintSoft: string;
  highlightBorder: string;
}

export const MARKETING_THEME_COLORS: Record<
  MarketingEmailTheme,
  MarketingEmailThemeColors
> = {
  blue: {
    brand: '#3057F2',
    gradientEnd: '#38BDF8',
    brandDark: '#2546C4',
    tint: '#E8EFFE',
    tintSoft: '#F0F5FF',
    highlightBorder: '#C7D7FE',
  },
  green: {
    brand: '#0F766E',
    gradientEnd: '#34D399',
    brandDark: '#115E59',
    tint: '#E6F4F1',
    tintSoft: '#F0FDFA',
    highlightBorder: '#99F6E4',
  },
  red: {
    brand: '#BE123C',
    gradientEnd: '#FB7185',
    brandDark: '#9F1239',
    tint: '#FFE4E6',
    tintSoft: '#FFF1F2',
    highlightBorder: '#FECDD3',
  },
};

export function resolveMarketingEmailTheme(
  raw: string | undefined | null,
): MarketingEmailTheme {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (MARKETING_EMAIL_THEMES.includes(normalized as MarketingEmailTheme)) {
    return normalized as MarketingEmailTheme;
  }
  return DEFAULT_MARKETING_EMAIL_THEME;
}

/** Swap known palette colors in edited HTML when the admin picks another theme. */
export function rethemeMarketingBodyHtml(
  html: string,
  theme: MarketingEmailTheme,
): string {
  let out = html;
  const target = MARKETING_THEME_COLORS[theme];
  for (const palette of Object.values(MARKETING_THEME_COLORS)) {
    if (palette === target) continue;
    for (const key of Object.keys(target) as (keyof MarketingEmailThemeColors)[]) {
      out = out.split(palette[key]).join(target[key]);
    }
  }
  return out;
}
