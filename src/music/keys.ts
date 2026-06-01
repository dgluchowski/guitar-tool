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

  // Determine quality suffix from explicit markers, else from case.
  let suffix: string;
  const rl = rest.toLowerCase();
  if (rl.includes('°') || rl.startsWith('o') || rl.startsWith('dim')) {
    suffix = rl.includes('7') ? 'm7b5' : 'dim';
  } else if (rest.includes('+') || rl.startsWith('aug')) {
    suffix = 'aug';
  } else if (rl === 'maj7' || rl === 'M7') {
    suffix = 'maj7';
  } else if (rl === '7') {
    suffix = isUpper ? '7' : 'm7';
  } else if (rl === 'm' || rl === 'm7') {
    suffix = rl;
  } else {
    suffix = isUpper ? '' : 'm';
  }

  return { degree, accidental, suffix };
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
