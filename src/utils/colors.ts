/**
 * Okabe-Ito color-blind-safe palette.
 * Distinguishable for the common forms of color vision deficiency.
 */
export const PALETTE = {
  orange: '#E69F00',
  skyBlue: '#56B4E9',
  green: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  purple: '#CC79A7',
  black: '#000000',
} as const;

/** Default mapping of scale/chord degree -> color, root most prominent. */
export const DEGREE_COLORS: Record<string, string> = {
  '1': PALETTE.vermillion, // root
  '3': PALETTE.blue,
  '5': PALETTE.green,
  '7': PALETTE.purple,
  other: PALETTE.skyBlue,
};

/** Color for a degree label like "1", "b3", "5", "#5", "b7". */
export function colorForDegree(degree: string): string {
  const num = degree.replace(/[^0-9]/g, '');
  switch (num) {
    case '1':
      return DEGREE_COLORS['1'];
    case '3':
      return DEGREE_COLORS['3'];
    case '5':
      return DEGREE_COLORS['5'];
    case '7':
      return DEGREE_COLORS['7'];
    default:
      return DEGREE_COLORS.other;
  }
}

/** Pick black or white text for best contrast against a hex background. */
export function contrastText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Relative luminance (sRGB approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111111' : '#ffffff';
}
