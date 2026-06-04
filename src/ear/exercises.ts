import { Note } from 'tonal';
import { notesForChord, voicePitchClasses } from '../music/engine';
import { ROOTS } from '../music/catalog';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Direction = 'asc' | 'desc' | 'harmonic';

/** User-adjustable settings shared across exercises (each uses the relevant ones). */
export interface EarSettings {
  difficulty: Difficulty;
  direction: Direction;
  arpeggio: boolean;
  reference: boolean;
}

/** A single generated ear-training question (pure data — audio is played by the engine). */
export interface EarQuestion {
  choices: string[];
  answerIndex: number;
  /** Text shown after answering, e.g. "Perfect 5th (C4 → G4)". */
  reveal: string;
  /** Note names with octave, in the order they should sound. */
  notes: string[];
  /** Whether the notes play one-by-one or together. */
  play: 'sequence' | 'chord';
}

export interface EarExercise {
  id: string;
  name: string;
  blurb: string;
  difficulties: Difficulty[];
  /** Which optional controls this exercise exposes. */
  controls: { direction?: boolean; arpeggio?: boolean; reference?: boolean };
  make: (s: EarSettings) => EarQuestion;
}

const rand = (n: number) => Math.floor(Math.random() * n);
function pick<T>(arr: readonly T[]): T {
  return arr[rand(arr.length)];
}
const nameOf = (midi: number) => Note.fromMidi(midi);

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export const INTERVAL_NAMES: Record<number, string> = {
  1: 'Minor 2nd',
  2: 'Major 2nd',
  3: 'Minor 3rd',
  4: 'Major 3rd',
  5: 'Perfect 4th',
  6: 'Tritone',
  7: 'Perfect 5th',
  8: 'Minor 6th',
  9: 'Major 6th',
  10: 'Minor 7th',
  11: 'Major 7th',
  12: 'Octave',
};

const INTERVAL_POOLS: Record<Difficulty, number[]> = {
  easy: [5, 7, 12],
  medium: [2, 3, 4, 5, 7, 9, 12],
  hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

function makeInterval(s: EarSettings): EarQuestion {
  const pool = INTERVAL_POOLS[s.difficulty];
  const semis = pick(pool);
  const baseMidi = 52 + rand(9); // E3 .. C4
  const lo = nameOf(baseMidi);
  const hi = nameOf(baseMidi + semis);
  const notes = s.direction === 'desc' ? [hi, lo] : [lo, hi];
  return {
    choices: pool.map((x) => INTERVAL_NAMES[x]),
    answerIndex: pool.indexOf(semis),
    reveal: `${INTERVAL_NAMES[semis]} (${lo} → ${hi})`,
    notes,
    play: s.direction === 'harmonic' ? 'chord' : 'sequence',
  };
}

// ---------------------------------------------------------------------------
// Higher or lower
// ---------------------------------------------------------------------------

const HL_POOLS: Record<Difficulty, number[]> = {
  easy: [12, 19, 24], // an octave or more
  medium: [3, 4, 5, 7, 8, 9], // 3rd – 6th
  hard: [1, 2], // a semitone / whole tone
};

function makeHigherLower(s: EarSettings): EarQuestion {
  const semis = pick(HL_POOLS[s.difficulty]);
  const baseMidi = 52 + rand(8);
  const low = nameOf(baseMidi);
  const high = nameOf(baseMidi + semis);
  const secondHigher = Math.random() < 0.5;
  const notes = secondHigher ? [low, high] : [high, low];
  return {
    choices: ['1st note', '2nd note'],
    answerIndex: secondHigher ? 1 : 0,
    reveal: `${secondHigher ? 'The 2nd' : 'The 1st'} note was higher (${notes[0]} → ${notes[1]})`,
    notes,
    play: 'sequence',
  };
}

// ---------------------------------------------------------------------------
// Chord quality
// ---------------------------------------------------------------------------

interface ChordQuality {
  suffix: string;
  label: string;
}

const CHORD_EASY: ChordQuality[] = [
  { suffix: '', label: 'Major' },
  { suffix: 'm', label: 'Minor' },
];
const CHORD_MED: ChordQuality[] = [
  ...CHORD_EASY,
  { suffix: '7', label: 'Dominant 7th' },
  { suffix: 'maj7', label: 'Major 7th' },
  { suffix: 'm7', label: 'Minor 7th' },
];
const CHORD_HARD: ChordQuality[] = [
  ...CHORD_MED,
  { suffix: 'dim', label: 'Diminished' },
  { suffix: 'aug', label: 'Augmented' },
  { suffix: 'sus4', label: 'Sus4' },
  { suffix: 'm7b5', label: 'Half-dim (m7♭5)' },
];
const CHORD_POOLS: Record<Difficulty, ChordQuality[]> = {
  easy: CHORD_EASY,
  medium: CHORD_MED,
  hard: CHORD_HARD,
};

function makeChord(s: EarSettings): EarQuestion {
  const pool = CHORD_POOLS[s.difficulty];
  const q = pick(pool);
  const root = pick(ROOTS);
  const set = notesForChord(`${root}${q.suffix}`);
  const notes = voicePitchClasses(
    set.pitches.map((p) => p.pc),
    3,
  );
  return {
    choices: pool.map((x) => x.label),
    answerIndex: pool.indexOf(q),
    reveal: `${root} ${q.label}`,
    notes,
    play: s.arpeggio ? 'sequence' : 'chord',
  };
}

// ---------------------------------------------------------------------------
// Scale degree
// ---------------------------------------------------------------------------

export const DEGREE_LABELS: Record<number, string> = {
  0: '1',
  1: '♭2',
  2: '2',
  3: '♭3',
  4: '3',
  5: '4',
  6: '♯4',
  7: '5',
  8: '♭6',
  9: '6',
  10: '♭7',
  11: '7',
};

const DEGREE_POOLS: Record<Difficulty, number[]> = {
  easy: [0, 4, 7], // 1, 3, 5
  medium: [0, 2, 4, 5, 7, 9, 11], // full major scale
  hard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // chromatic
};

function makeDegree(s: EarSettings): EarQuestion {
  const pool = DEGREE_POOLS[s.difficulty];
  const semis = pick(pool);
  const tonicMidi = 48 + rand(12); // C3 .. B3
  const tonic = nameOf(tonicMidi);
  const target = nameOf(tonicMidi + semis);
  return {
    choices: pool.map((x) => DEGREE_LABELS[x]),
    answerIndex: pool.indexOf(semis),
    reveal: `Scale degree ${DEGREE_LABELS[semis]} — ${target} over ${tonic}`,
    notes: s.reference ? [tonic, target] : [target],
    play: 'sequence',
  };
}

// ---------------------------------------------------------------------------

export const EXERCISES: EarExercise[] = [
  {
    id: 'higher-lower',
    name: 'Higher or Lower',
    blurb: 'Two notes play in sequence — pick which one is higher.',
    difficulties: ['easy', 'medium', 'hard'],
    controls: {},
    make: makeHigherLower,
  },
  {
    id: 'interval',
    name: 'Interval Recognition',
    blurb: 'Name the distance between the two notes you hear.',
    difficulties: ['easy', 'medium', 'hard'],
    controls: { direction: true },
    make: makeInterval,
  },
  {
    id: 'chord-quality',
    name: 'Chord Quality',
    blurb: 'Identify the type of chord — the heart of playing songs by ear.',
    difficulties: ['easy', 'medium', 'hard'],
    controls: { arpeggio: true },
    make: makeChord,
  },
  {
    id: 'scale-degree',
    name: 'Scale Degree',
    blurb: 'Name where a note sits in the key — trains your improviser’s ear.',
    difficulties: ['easy', 'medium', 'hard'],
    controls: { reference: true },
    make: makeDegree,
  },
];
