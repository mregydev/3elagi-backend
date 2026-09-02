/** SVG wordmark matching 3elagi-mobile/components/Logo3elagi.tsx (viewBox 0 0 360 90). */
export function buildLogo3elagiSvg(input: {
  stroke: string;
  fill: string;
  markOnly?: boolean;
}): string {
  const { stroke, fill, markOnly = false } = input;
  const viewBox = markOnly ? '0 0 90 90' : '0 0 360 90';
  const wordmark = markOnly
    ? ''
    : `<text x="98" y="62" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="58" fill="${stroke}">3elagi</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">
  <circle cx="45" cy="45" r="42" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
  <path d="M 28,38 C 20,38 17,30 22,24 C 26,19 34,20 34,27" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M 62,38 C 70,38 73,30 68,24 C 64,19 56,20 56,27" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M 28,38 C 28,48 45,50 45,58" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <path d="M 62,38 C 62,48 45,50 45,58" stroke="${stroke}" stroke-width="5.5" stroke-linecap="round" fill="none"/>
  <circle cx="45" cy="65" r="7" stroke="${stroke}" stroke-width="4" fill="none"/>
  <circle cx="45" cy="65" r="2.5" fill="${stroke}"/>
  ${wordmark}
</svg>`;
}

/** White logo for gradient email headers (Logo3elagi dark variant). */
export function buildMarketingHeaderLogoSvg(): string {
  return buildLogo3elagiSvg({
    stroke: '#ffffff',
    fill: 'rgba(255,255,255,0.12)',
  });
}

/** Theme-colored logo for light backgrounds (footer). */
export function buildMarketingFooterLogoSvg(brand: string): string {
  return buildLogo3elagiSvg({
    stroke: brand,
    fill: `${brand}14`,
  });
}
