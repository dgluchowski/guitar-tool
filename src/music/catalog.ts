export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface ChordQuality {
  label: string;
  /** Suffix appended to the root, e.g. "m7". */
  suffix: string;
  /** Beginner-friendly qualities are shown by default. */
  beginner: boolean;
}

export const CHORD_QUALITIES: ChordQuality[] = [
  { label: 'Major', suffix: '', beginner: true },
  { label: 'Minor', suffix: 'm', beginner: true },
  { label: 'Dominant 7', suffix: '7', beginner: true },
  { label: 'Major 7', suffix: 'maj7', beginner: true },
  { label: 'Minor 7', suffix: 'm7', beginner: true },
  { label: 'Sus2', suffix: 'sus2', beginner: true },
  { label: 'Sus4', suffix: 'sus4', beginner: true },
  { label: 'Power (5)', suffix: '5', beginner: true },
  { label: 'Diminished', suffix: 'dim', beginner: false },
  { label: 'Augmented', suffix: 'aug', beginner: false },
  { label: 'Add9', suffix: 'add9', beginner: false },
  { label: 'Half-dim 7', suffix: 'm7b5', beginner: false },
  { label: '6', suffix: '6', beginner: false },
  { label: 'Minor 6', suffix: 'm6', beginner: false },
  { label: '9', suffix: '9', beginner: false },
];

export const SCALE_TYPES = [
  'major',
  'minor',
  'harmonic minor',
  'melodic minor',
  'major pentatonic',
  'minor pentatonic',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'blues',
];

/** Split a chord symbol into root + quality suffix, e.g. "Bdim" -> {root:"B", quality:"dim"}. */
export function splitChordSymbol(symbol: string): { root: string; quality: string } {
  const m = symbol.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return { root: 'C', quality: '' };
  return { root: m[1], quality: m[2] };
}
