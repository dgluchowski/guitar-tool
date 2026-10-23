import { Note } from 'tonal';

/** Where a preset's pitches, or a band association, were checked. */
export type TuningSource = {
  title: string;
  url: string;
};

/** A tuning is the list of open-string notes, ordered low (thickest) to high (thinnest). */
export type Tuning = {
  id: string;
  name: string;
  /** Open-string notes with octave, low to high, e.g. ["E2","A2","D3","G3","B3","E4"]. */
  strings: string[];
  /** Shown when this preset is selected. Band names appear only when the source states them. */
  sources?: TuningSource[];
};

const SEVEN_STRING = 'https://en.wikipedia.org/wiki/Seven-string_guitar';
const EIGHT_STRING = 'https://en.wikipedia.org/wiki/Eight-string_guitar';

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard E', strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'drop-d', name: 'Drop D', strings: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'drop-db', name: 'Drop D♭ (Drop C#)', strings: ['Db2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
  { id: 'drop-c', name: 'Drop C', strings: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'dadgad', name: 'DADGAD', strings: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  {
    id: 'facgce',
    name: 'FACGCE',
    strings: ['F2', 'A2', 'C3', 'G3', 'C4', 'E4'],
    sources: [
      {
        title: 'Guitar World — Mike Kinsella on FACGCE',
        url: 'https://www.guitarworld.com/features/mike-kinsella-american-football-owen',
      },
    ],
  },
  { id: 'open-g', name: 'Open G', strings: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'open-d', name: 'Open D', strings: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  { id: 'open-e', name: 'Open E', strings: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] },
  { id: 'half-step-down', name: 'Half-step down (Eb)', strings: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
  { id: 'd-standard', name: 'D Standard (whole step down)', strings: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  {
    id: 'standard-7',
    name: '7-string standard (B)',
    strings: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    sources: [{ title: 'Seven-string guitar — Wikipedia', url: SEVEN_STRING }],
  },
  {
    id: 'drop-a',
    name: '7-string Drop A',
    strings: ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    sources: [{ title: 'Seven-string guitar — Wikipedia', url: SEVEN_STRING }],
  },
  {
    id: 'high-a-7',
    name: '7-string high A',
    strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'],
    sources: [{ title: 'Seven-string guitar — Wikipedia', url: SEVEN_STRING }],
  },
  {
    id: 'standard-8',
    name: '8-string standard (F#)',
    strings: ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    sources: [{ title: 'Eight-string guitar — Wikipedia', url: EIGHT_STRING }],
  },
  {
    id: 'drop-e',
    name: '8-string Drop E',
    strings: ['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    sources: [{ title: 'Eight-string guitar — Wikipedia', url: EIGHT_STRING }],
  },
];

export const DEFAULT_TUNING = TUNINGS[0];

/** String counts the tuning picker offers as a filter. */
export const STRING_COUNTS = [6, 7, 8] as const;

/** The usual "standard" preset for 6, 7, or 8 strings. */
export function standardTuningForCount(count: number): Tuning | undefined {
  const id = count === 6 ? 'standard' : count === 7 ? 'standard-7' : count === 8 ? 'standard-8' : '';
  return TUNINGS.find((t) => t.id === id);
}

/** Named preset with the same pitches and octaves, if there is one. */
export function findTuningPreset(tuning: string[]): Tuning | undefined {
  return TUNINGS.find(
    (t) =>
      t.strings.length === tuning.length &&
      t.strings.every(
        (n, i) => Note.chroma(n) === Note.chroma(tuning[i]) && Note.octave(n) === Note.octave(tuning[i]),
      ),
  );
}

/** Frets that conventionally carry a position marker dot (single, then double at 12/24). */
export const SINGLE_DOT_FRETS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
export const DOUBLE_DOT_FRETS = new Set([12, 24]);

/**
 * Note (with octave) at a given fret on an open string.
 * fret 0 = the open string itself. Returns a sharp-spelled name (e.g. "C#4").
 */
export function noteAtFret(openNote: string, fret: number): string {
  const midi = Note.midi(openNote);
  if (midi == null) return '';
  return Note.fromMidi(midi + fret);
}

/** Pitch class (no octave) at a given fret, e.g. "C#". */
export function pitchClassAtFret(openNote: string, fret: number): string {
  return Note.pitchClass(noteAtFret(openNote, fret));
}

/** True if `note` (any spelling, with or without octave) shares the pitch class of `pc`. */
export function samePitchClass(note: string, pc: string): boolean {
  return Note.chroma(note) === Note.chroma(pc);
}

/** Chroma (0-11) of a note or pitch class, or null if invalid. */
export function chroma(note: string): number | null {
  const c = Note.chroma(note);
  return c == null ? null : c;
}

export interface DetectedNote {
  /** Full note name with octave, sharp-spelled, e.g. "A4". */
  name: string;
  /** Pitch class without octave, e.g. "A". */
  pc: string;
  octave: number;
  /** Nearest MIDI note number. */
  midi: number;
  /** How far the input is from the nearest note, in cents (-50..+50). */
  cents: number;
  /** The input frequency in Hz. */
  freq: number;
}

/**
 * Convert a frequency (Hz) to the nearest equal-tempered note (A4 = 440Hz)
 * plus the deviation in cents. Returns null for non-positive/invalid input.
 */
export function frequencyToNote(freq: number): DetectedNote | null {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const name = Note.fromMidi(midi);
  return {
    name,
    pc: Note.pitchClass(name),
    octave: Note.octave(name) ?? 0,
    midi,
    cents,
    freq,
  };
}

/** Equal-tempered frequency (Hz) of a note name, or null if invalid. */
export function noteToFrequency(note: string): number | null {
  return Note.freq(note);
}

/** MIDI number of a note name (with octave), or null if invalid. */
export function midiOf(note: string): number | null {
  return Note.midi(note);
}
