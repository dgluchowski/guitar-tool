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

/**
 * Search for playable voicings of a chord in a given tuning.
 * One note per string, within a `maxFretSpan`-fret window, containing the
 * chord tones, ranked by playability (fewer stretches, lower position,
 * root in the bass, fuller voicings).
 */
export function findChordShapes(
  chordSymbol: string,
  tuning: string[],
  options: ShapeOptions = {},
): ChordShape[] {
  const { maxFretSpan = 4, allowMutedStrings = true, maxFrets = 12, limit = 8 } = options;

  const chord = Chord.get(chordSymbol);
  if (chord.empty || chord.notes.length === 0) return [];

  const chordChromas = chord.notes.map((n) => Note.chroma(n)!).filter((c) => c != null);
  const chromaSet = new Set(chordChromas);
  const rootChroma = Note.chroma(chord.tonic || chord.notes[0])!;

  // chroma -> degree info (for tagging positions)
  const chromaToInfo = new Map<number, PitchInfo>();
  buildPitches(chord.notes, chord.intervals).forEach((p) => chromaToInfo.set(p.chroma, p));

  // perfect-5th chroma (the tone we allow omitting)
  let fifthChroma: number | null = null;
  chord.intervals.forEach((ivl, i) => {
    const info = Interval.get(ivl);
    if (info.num === 5 && info.alt === 0) fifthChroma = Note.chroma(chord.notes[i])!;
  });

  const n = tuning.length;

  // Candidate frets per string (chord tones only) + optional mute.
  const candidates: (number | null)[][] = tuning.map((open) => {
    const arr: (number | null)[] = [];
    for (let f = 0; f <= maxFrets; f++) {
      const c = Note.chroma(pitchClassAtFret(open, f));
      if (c != null && chromaSet.has(c)) arr.push(f);
    }
    if (allowMutedStrings) arr.push(null);
    return arr;
  });

  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  const cur: (number | null)[] = new Array(n).fill(null);

  const evaluate = () => {
    const frets = cur.slice();
    const soundingIdx = frets.map((f, i) => (f !== null ? i : -1)).filter((i) => i >= 0);
    if (soundingIdx.length < 3) return; // too sparse to be a chord

    // chord tones present
    const presentChromas = new Set(
      soundingIdx.map((i) => Note.chroma(pitchClassAtFret(tuning[i], frets[i]!))!),
    );
    const missing = chordChromas.filter((c) => !presentChromas.has(c));
    // allow omitting only the perfect 5th
    if (missing.length > 0) {
      if (!(missing.length === 1 && fifthChroma != null && missing[0] === fifthChroma)) return;
    }

    // fingers / span (open strings need no finger)
    const fretted = soundingIdx.map((i) => frets[i]!).filter((f) => f > 0);
    const baseFret = fretted.length ? Math.min(...fretted) : 0;
    const topFret = fretted.length ? Math.max(...fretted) : 0;
    const span = fretted.length ? topFret - baseFret : 0;
    const countAtBase = fretted.filter((f) => f === baseFret).length;
    const barreSaving = countAtBase >= 2 ? countAtBase - 1 : 0;
    const fingers = fretted.length - barreSaving;
    if (fingers > 4) return;

    // inner muted strings (between two sounding strings) are awkward
    const firstS = soundingIdx[0];
    const lastS = soundingIdx[soundingIdx.length - 1];
    let innerMutes = 0;
    for (let i = firstS; i <= lastS; i++) if (frets[i] === null) innerMutes++;

    const mutedCount = frets.filter((f) => f === null).length;
    const bassChroma = Note.chroma(pitchClassAtFret(tuning[firstS], frets[firstS]!))!;
    const bassIsRoot = bassChroma === rootChroma;

    const score =
      baseFret * 0.5 +
      span * 1.2 +
      fingers * 1.0 +
      innerMutes * 3 +
      (bassIsRoot ? 0 : 2.5) +
      missing.length * 3 +
      mutedCount * 1.5; // strongly prefer fuller voicings

    const key = frets.map((f) => (f === null ? 'x' : f)).join('-');
    if (seen.has(key)) return;
    seen.add(key);

    const positions: FretPosition[] = soundingIdx.map((i) => {
      const pc = pitchClassAtFret(tuning[i], frets[i]!);
      const info = chromaToInfo.get(Note.chroma(pc)!);
      return { string: i, fret: frets[i]!, pc, interval: info?.interval ?? '', degree: info?.degree ?? '?' };
    });

    shapes.push({ frets, baseFret, fingers, positions, score });
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
        if (nMax - nMin >= maxFretSpan) continue; // exceeds hand span
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
