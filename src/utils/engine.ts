import { Chord, Scale, Note, Interval } from 'tonal';
import { pitchClassAtFret } from './notes';

/** A pitch class tagged with its interval/degree relative to the chord or scale root. */
export interface PitchInfo {
  /** Pitch class, e.g. "C", "Eb". */
  pc: string;
  /** Chroma 0-11. */
  chroma: number;
  /** Interval from the root, e.g. "1P", "3M", "7m". */
  interval: string;
  /** Human degree label, e.g. "1", "b3", "5", "b7". */
  degree: string;
}

export interface NoteSet {
  /** Root pitch class. */
  root: string;
  /** Display name (e.g. "C major", "Cmaj7"). */
  name: string;
  pitches: PitchInfo[];
}

/** A specific note on the fretboard. */
export interface FretPosition {
  /** String index, 0 = lowest. */
  string: number;
  fret: number;
  pc: string;
  interval: string;
  degree: string;
}

/** Convert an interval (e.g. "3M", "7m", "5d") into a degree label like "3", "b7", "b5". */
export function degreeLabel(interval: string): string {
  const ivl = Interval.get(interval);
  if (ivl.empty || ivl.num == null) return interval;
  const num = Math.abs(ivl.num);
  const alt = ivl.alt ?? 0;
  const acc = alt < 0 ? 'b'.repeat(-alt) : '#'.repeat(alt);
  return `${acc}${num}`;
}

function buildPitches(notes: string[], intervals: string[]): PitchInfo[] {
  return notes.map((n, i) => {
    const interval = intervals[i] ?? '';
    return {
      pc: Note.pitchClass(n) || n,
      chroma: Note.chroma(n) ?? -1,
      interval,
      degree: interval ? degreeLabel(interval) : '?',
    };
  });
}

/** Pitch classes of a chord symbol (e.g. "Cmaj7", "Em", "G7"), tagged with degrees. */
export function notesForChord(chordSymbol: string): NoteSet {
  const chord = Chord.get(chordSymbol);
  if (chord.empty || chord.notes.length === 0) {
    return { root: '', name: chordSymbol, pitches: [] };
  }
  const root = chord.tonic || chord.notes[0];
  return {
    root: Note.pitchClass(root) || root,
    name: chord.symbol || chordSymbol,
    pitches: buildPitches(chord.notes, chord.intervals),
  };
}

/** Pitch classes of a scale (root + scale name, e.g. "C", "major"), tagged with degrees. */
export function notesForScale(root: string, scaleName: string): NoteSet {
  const scale = Scale.get(`${root} ${scaleName}`);
  if (scale.empty || scale.notes.length === 0) {
    return { root: Note.pitchClass(root) || root, name: `${root} ${scaleName}`, pitches: [] };
  }
  return {
    root: Note.pitchClass(scale.tonic || root) || root,
    name: scale.name || `${root} ${scaleName}`,
    pitches: buildPitches(scale.notes, scale.intervals),
  };
}

/**
 * Every (string, fret) within `fretRange` whose pitch class is in `pitches`,
 * tagged with the matching interval/degree.
 */
export function mapNotesToFretboard(
  pitches: PitchInfo[],
  tuning: string[],
  fretRange: [number, number],
): FretPosition[] {
  const byChroma = new Map<number, PitchInfo>();
  for (const p of pitches) if (p.chroma >= 0) byChroma.set(p.chroma, p);

  const [lo, hi] = fretRange;
  const out: FretPosition[] = [];
  for (let s = 0; s < tuning.length; s++) {
    for (let f = lo; f <= hi; f++) {
      const pc = pitchClassAtFret(tuning[s], f);
      const c = Note.chroma(pc);
      if (c == null) continue;
      const info = byChroma.get(c);
      if (info) {
        out.push({ string: s, fret: f, pc, interval: info.interval, degree: info.degree });
      }
    }
  }
  return out;
}

/**
 * Turn a list of pitch classes into ascending note names with octaves,
 * e.g. ["C","E","G"] -> ["C3","E3","G3"], ["G","B","D","F"] -> ["G3","B3","D4","F4"].
 * Useful for audio playback.
 */
export function voicePitchClasses(pitchClasses: string[], startOctave = 3): string[] {
  let octave = startOctave;
  let prevChroma = -1;
  return pitchClasses.map((pc) => {
    const c = Note.chroma(pc) ?? 0;
    if (c <= prevChroma) octave++;
    prevChroma = c;
    return `${pc}${octave}`;
  });
}

// ---------------------------------------------------------------------------
// findChordShapes — constrained search for playable voicings
// ---------------------------------------------------------------------------

export interface ChordShape {
  /** Fret per string, low to high. null = muted, 0 = open. */
  frets: (number | null)[];
  /** Lowest fretted fret (0 if only open strings). */
  baseFret: number;
  /** Estimated fingers needed (accounts for a barre at the base fret). */
  fingers: number;
  /** Note/degree per sounding string. */
  positions: FretPosition[];
  /** Lower is more playable. */
  score: number;
}

export interface ShapeOptions {
  maxFretSpan?: number;
  allowMutedStrings?: boolean;
  maxFrets?: number;
  /** Max number of shapes to return. */
  limit?: number;
}

interface ChordToneInfo {
  chordChromas: number[];
  chromaSet: Set<number>;
  rootChroma: number;
  chromaToInfo: Map<number, PitchInfo>;
  /** Perfect 5th, the only chord tone a shape may omit. */
  fifthChroma: number | null;
}

function chordToneInfo(chordSymbol: string): ChordToneInfo | null {
  const chord = Chord.get(chordSymbol);
  if (chord.empty || chord.notes.length === 0) return null;

  const chordChromas = chord.notes.map((n) => Note.chroma(n)!).filter((c) => c != null);
  const chromaToInfo = new Map<number, PitchInfo>();
  buildPitches(chord.notes, chord.intervals).forEach((p) => chromaToInfo.set(p.chroma, p));

  let fifthChroma: number | null = null;
  chord.intervals.forEach((ivl, i) => {
    const info = Interval.get(ivl);
    if (info.num === 5 && info.alt === 0) fifthChroma = Note.chroma(chord.notes[i])!;
  });

  return {
    chordChromas,
    chromaSet: new Set(chordChromas),
    rootChroma: Note.chroma(chord.tonic || chord.notes[0])!,
    chromaToInfo,
    fifthChroma,
  };
}

/** Score one fret assignment. Returns null when it is not a playable chord shape. */
function shapeFromFrets(
  frets: (number | null)[],
  tuning: string[],
  tones: ChordToneInfo,
): ChordShape | null {
  const soundingIdx = frets.map((f, i) => (f !== null ? i : -1)).filter((i) => i >= 0);
  if (soundingIdx.length < 3) return null;

  const presentChromas = new Set(
    soundingIdx.map((i) => Note.chroma(pitchClassAtFret(tuning[i], frets[i]!))!),
  );
  const missing = tones.chordChromas.filter((c) => !presentChromas.has(c));
  if (missing.length > 0) {
    if (!(missing.length === 1 && tones.fifthChroma != null && missing[0] === tones.fifthChroma)) return null;
  }

  const fretted = soundingIdx.map((i) => frets[i]!).filter((f) => f > 0);
  const baseFret = fretted.length ? Math.min(...fretted) : 0;
  const topFret = fretted.length ? Math.max(...fretted) : 0;
  const span = fretted.length ? topFret - baseFret : 0;
  const countAtBase = fretted.filter((f) => f === baseFret).length;
  const barreSaving = countAtBase >= 2 ? countAtBase - 1 : 0;
  const fingers = fretted.length - barreSaving;
  if (fingers > 4) return null;

  const firstS = soundingIdx[0];
  const lastS = soundingIdx[soundingIdx.length - 1];
  let innerMutes = 0;
  for (let i = firstS; i <= lastS; i++) if (frets[i] === null) innerMutes++;

  const mutedCount = frets.filter((f) => f === null).length;
  const bassChroma = Note.chroma(pitchClassAtFret(tuning[firstS], frets[firstS]!))!;
  const bassIsRoot = bassChroma === tones.rootChroma;

  const score =
    baseFret * 0.5 +
    span * 1.2 +
    fingers * 1.0 +
    innerMutes * 3 +
    (bassIsRoot ? 0 : 2.5) +
    missing.length * 3 +
    mutedCount * 1.5;

  const positions: FretPosition[] = soundingIdx.map((i) => {
    const pc = pitchClassAtFret(tuning[i], frets[i]!);
    const info = tones.chromaToInfo.get(Note.chroma(pc)!);
    return { string: i, fret: frets[i]!, pc, interval: info?.interval ?? '', degree: info?.degree ?? '?' };
  });

  return { frets, baseFret, fingers, positions, score };
}

/**
 * Full search. Cost is exponential in the string count, which is fine for a
 * 6-string guitar and too slow once a 7th or 8th string is added.
 */
function searchPlayable(
  tuning: string[],
  tones: ChordToneInfo,
  options: Required<Pick<ShapeOptions, 'maxFretSpan' | 'allowMutedStrings' | 'maxFrets' | 'limit'>>,
): ChordShape[] {
  const { maxFretSpan, allowMutedStrings, maxFrets, limit } = options;
  const n = tuning.length;
  const candidates: (number | null)[][] = tuning.map((open) => {
    const arr: (number | null)[] = [];
    for (let f = 0; f <= maxFrets; f++) {
      const c = Note.chroma(pitchClassAtFret(open, f));
      if (c != null && tones.chromaSet.has(c)) arr.push(f);
    }
    if (allowMutedStrings) arr.push(null);
    return arr;
  });

  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  const cur: (number | null)[] = new Array(n).fill(null);

  const evaluate = () => {
    const shape = shapeFromFrets(cur.slice(), tuning, tones);
    if (!shape) return;
    const key = shape.frets.map((f) => (f === null ? 'x' : f)).join('-');
    if (seen.has(key)) return;
    seen.add(key);
    shapes.push(shape);
  };

  const recurse = (i: number, minF: number, maxF: number) => {
    if (i === n) {
      evaluate();
      return;
    }
    for (const c of candidates[i]) {
      let nMin = minF;
      let nMax = maxF;
      if (c !== null && c > 0) {
        nMin = Math.min(minF, c);
        nMax = Math.max(maxF, c);
        if (nMax - nMin >= maxFretSpan) continue;
      }
      cur[i] = c;
      recurse(i + 1, nMin, nMax);
      cur[i] = null;
    }
  };

  recurse(0, Infinity, -Infinity);
  shapes.sort((a, b) => a.score - b.score);
  return shapes.slice(0, limit);
}

/**
 * For 7+ strings, search each contiguous 6-string window with the full
 * algorithm, then let each leftover string be muted, open (when that open
 * note is a chord tone), or barred at the shape's base fret. That stays fast
 * and still offers voicings that use the extra strings.
 */
function searchExtended(
  tuning: string[],
  tones: ChordToneInfo,
  options: Required<Pick<ShapeOptions, 'maxFretSpan' | 'allowMutedStrings' | 'maxFrets' | 'limit'>>,
): ChordShape[] {
  const windowSize = 6;
  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  // Enough window shapes that a familiar open voicing is not crowded out
  // before the extra strings are filled in.
  const windowLimit = Math.max(options.limit, 30);

  for (let start = 0; start <= tuning.length - windowSize; start++) {
    const windowTuning = tuning.slice(start, start + windowSize);
    const windowShapes = searchPlayable(windowTuning, tones, { ...options, limit: windowLimit });
    for (const windowShape of windowShapes) {
      for (const frets of expandWindow(tuning, tones, start, windowShape.frets, windowShape.baseFret)) {
        const shape = shapeFromFrets(frets, tuning, tones);
        if (!shape) continue;
        const key = shape.frets.map((f) => (f === null ? 'x' : f)).join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        shapes.push(shape);
      }
    }
  }

  shapes.sort((a, b) => a.score - b.score);
  return shapes.slice(0, options.limit);
}

/** Fret choices for strings outside a 6-string window. */
function expandWindow(
  tuning: string[],
  tones: ChordToneInfo,
  start: number,
  windowFrets: (number | null)[],
  baseFret: number,
): (number | null)[][] {
  const extras: number[] = [];
  for (let i = 0; i < tuning.length; i++) {
    if (i < start || i >= start + windowFrets.length) extras.push(i);
  }

  // A full product is cheap for one or two extra strings (7- and 8-string
  // guitars). Past that, mute the leftovers so a custom 12-string cannot hang.
  const fillExtras = extras.length <= 2;
  const options: (number | null)[][] = extras.map((i) => {
    if (!fillExtras) return [null];
    const opts: (number | null)[] = [null];
    const openChroma = Note.chroma(pitchClassAtFret(tuning[i], 0));
    if (openChroma != null && tones.chromaSet.has(openChroma)) opts.push(0);
    if (baseFret > 0) {
      const barreChroma = Note.chroma(pitchClassAtFret(tuning[i], baseFret));
      if (barreChroma != null && tones.chromaSet.has(barreChroma)) opts.push(baseFret);
    }
    return opts;
  });

  const variants: (number | null)[][] = [];
  const cur: (number | null)[] = new Array(tuning.length).fill(null);
  for (let k = 0; k < windowFrets.length; k++) cur[start + k] = windowFrets[k];

  const walk = (extraIndex: number) => {
    if (extraIndex === extras.length) {
      variants.push(cur.slice());
      return;
    }
    for (const fret of options[extraIndex]) {
      cur[extras[extraIndex]] = fret;
      walk(extraIndex + 1);
    }
  };
  walk(0);
  return variants;
}

/**
 * Search for playable voicings of a chord in a given tuning.
 * One note per string, within a `maxFretSpan`-fret window, containing the
 * chord tones, ranked by playability (fewer stretches, lower position,
 * root in the bass, fuller voicings).
 *
 * Six strings and fewer use a full search. More strings search 6-string
 * windows so the chord dictionary stays responsive on a 7- or 8-string guitar.
 */
export function findChordShapes(
  chordSymbol: string,
  tuning: string[],
  options: ShapeOptions = {},
): ChordShape[] {
  const resolved = {
    maxFretSpan: options.maxFretSpan ?? 4,
    allowMutedStrings: options.allowMutedStrings ?? true,
    maxFrets: options.maxFrets ?? 12,
    limit: options.limit ?? 8,
  };
  const tones = chordToneInfo(chordSymbol);
  if (!tones || tuning.length < 2) return [];
  if (tuning.length <= 6) return searchPlayable(tuning, tones, resolved);
  return searchExtended(tuning, tones, resolved);
}
