import { Scale, Note } from 'tonal';

export type KeyMode = 'major' | 'minor';

/** Standard diatonic Roman numerals per mode (minor = natural minor). */
export const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

const ROMAN_TO_DEGREE: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
};

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Shift a pitch class by a number of semitones, spelled with flats. */
function shift(pc: string, semitones: number): string {
  const c = Note.chroma(pc);
  if (c == null) return pc;
  return FLAT_NAMES[(c + semitones + 1200) % 12];
}

/** Degree roots (pitch classes) of a key, e.g. C major -> [C,D,E,F,G,A,B]. */
function degreeRoots(tonic: string, mode: KeyMode): string[] {
  const scaleName = mode === 'major' ? 'major' : 'aeolian';
  const scale = Scale.get(`${tonic} ${scaleName}`);
  return scale.notes.map((n) => Note.pitchClass(n));
}

interface ParsedNumeral {
  degree: number;
  accidental: number; // semitone offset from the diatonic root
  /** explicit quality suffix appended to the chord symbol */
  suffix: string;
}

/** Parse a Roman numeral token like "V7", "bVII", "vii°", "ii", "IV". */
export function parseRomanNumeral(token: string): ParsedNumeral | null {
  let s = token.trim();
  let accidental = 0;
  while (s[0] === 'b' || s[0] === '#') {
    accidental += s[0] === 'b' ? -1 : 1;
    s = s.slice(1);
  }
  const m = s.match(/^(iii|ii|iv|vii|vi|v|i)/i);
  if (!m) return null;
  const roman = m[0];
  const degree = ROMAN_TO_DEGREE[roman.toLowerCase()];
  if (!degree) return null;
  const rest = s.slice(roman.length);
  const isUpper = roman[0] === roman[0].toUpperCase();
  return { degree, accidental, suffix: qualitySuffix(rest, isUpper) };
}

/**
 * Quality written after a Roman numeral. Longer suffixes are listed first.
 * `7b5` and `°7` are the half-diminished numeral spellings of `m7b5`.
 * A bare `7` follows the numeral's case (I7 dominant, i7 minor).
 */
const NUMERAL_SUFFIXES: { pattern: string; suffix: string }[] = [
  { pattern: 'maj9', suffix: 'maj9' },
  { pattern: 'maj7', suffix: 'maj7' },
  { pattern: 'm7b5', suffix: 'm7b5' },
  { pattern: '7sus4', suffix: '7sus4' },
  { pattern: '7#9', suffix: '7#9' },
  { pattern: '7b9', suffix: '7b9' },
  { pattern: '7b5', suffix: 'm7b5' },
  { pattern: 'dim7', suffix: 'dim7' },
  { pattern: 'add9', suffix: 'add9' },
  { pattern: 'sus4', suffix: 'sus4' },
  { pattern: 'sus2', suffix: 'sus2' },
  { pattern: 'm9', suffix: 'm9' },
  { pattern: 'm7', suffix: 'm7' },
  { pattern: 'm6', suffix: 'm6' },
  { pattern: '13', suffix: '13' },
  { pattern: '11', suffix: '11' },
  { pattern: '9', suffix: '9' },
  { pattern: '6', suffix: '6' },
  { pattern: '5', suffix: '5' },
];

function qualitySuffix(rest: string, isUpper: boolean): string {
  if (rest === 'M9') return 'maj9';
  if (rest === 'M7') return 'maj7';
  if (!rest) return isUpper ? '' : 'm';

  const rl = rest.toLowerCase();
  // °7 / o7 / ø are half-diminished. A plain ° or o is a diminished triad.
  // dim7 is the fully diminished seventh, so it is matched on its own below.
  if (rl.includes('ø') || rl.includes('°') || rl === 'o' || rl === 'o7') {
    return rl.includes('7') || rl.includes('ø') ? 'm7b5' : 'dim';
  }
  if (rl === 'dim7') return 'dim7';
  if (rl === 'dim' || rl.startsWith('dim')) return 'dim';
  if (rest.includes('+') || rl.startsWith('aug')) return 'aug';

  for (const rule of NUMERAL_SUFFIXES) {
    if (rl === rule.pattern) return rule.suffix;
  }
  if (rl === '7') return isUpper ? '7' : 'm7';
  if (rl === 'm') return 'm';
  return isUpper ? '' : 'm';
}

/** Resolve a single Roman numeral to a chord symbol within a key. */
export function resolveNumeral(token: string, tonic: string, mode: KeyMode): string {
  const parsed = parseRomanNumeral(token);
  if (!parsed) return '';
  const roots = degreeRoots(tonic, mode);
  let root = roots[parsed.degree - 1];
  if (!root) return '';
  if (parsed.accidental) root = shift(root, parsed.accidental);
  return `${root}${parsed.suffix}`;
}

/** Resolve a list of Roman numerals to chord symbols. */
export function resolveProgression(numerals: string[], tonic: string, mode: KeyMode): string[] {
  return numerals.map((n) => resolveNumeral(n, tonic, mode));
}

/** The seven diatonic chords of a key, as {roman, symbol}. */
export function diatonicChords(tonic: string, mode: KeyMode): { roman: string; symbol: string }[] {
  const numerals = mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
  return numerals.map((roman) => ({ roman, symbol: resolveNumeral(roman, tonic, mode) }));
}
