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

export type VoicingStyle = 'all' | 'full' | 'triad' | 'drop2' | 'shell';
export type StringGroup = 'all' | 'low' | 'mid' | 'high';
export type InversionName = 'Root' | '1st Inv' | '2nd Inv' | '3rd Inv' | 'Ext Bass';
export type FingerNumber = 1 | 2 | 3 | 4 | null;

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
  /** Neck zone this shape was found in, e.g. "Pos V (4–8)". */
  positionLabel: string;
  /** Recommended fretting finger per string. null = open or muted. */
  fingerMap: FingerNumber[];
  /** Inversion from the lowest sounding chord tone. */
  inversion: InversionName;
  /** 1-based inclusive string numbers of the first and last sounding string. */
  stringSpan: [number, number];
}

export interface ShapeOptions {
  maxFretSpan?: number;
  allowMutedStrings?: boolean;
  maxFrets?: number;
  /** Max number of shapes to return. */
  limit?: number;
  /** Fretted notes must sit in this inclusive fret window. */
  positionRange?: [number, number];
  /** Restrict sounding strings to a register of the tuning. */
  stringGroup?: StringGroup;
  /** Filter by how many strings sound and which guide tones they carry. */
  voicingStyle?: VoicingStyle;
  /** Allow open strings even when `positionRange` does not include fret 0. */
  allowOpenStrings?: boolean;
}

/** One overlapping neck zone used by the position search. */
export interface NeckZone {
  id: string;
  label: string;
  range: [number, number];
}

/** Shapes found inside one neck zone. */
export interface PositionBucket {
  zone: NeckZone;
  /** Best shapes in this zone (capped). */
  shapes: ChordShape[];
  /** How many playable shapes the zone search kept before the display cap. */
  count: number;
}

interface ClassifiedTone {
  chroma: number;
  num: number;
  alt: number;
  essential: boolean;
}

interface ChordToneInfo {
  chordChromas: number[];
  chromaSet: Set<number>;
  rootChroma: number;
  chromaToInfo: Map<number, PitchInfo>;
  classified: ClassifiedTone[];
  /** Chord tones a normal voicing must include. The perfect 5th, and the 9th of an 11 or 13, are left out. */
  essentialChromas: number[];
}

interface SearchContext {
  maxFretSpan: number;
  allowMutedStrings: boolean;
  maxFrets: number;
  positionRange: [number, number] | null;
  allowOpen: boolean;
  /** When set, the low-fret penalty is measured from this fret instead of the nut. */
  zoneStart: number | null;
  positionLabel: string | null;
  voicingStyle: VoicingStyle;
}

/**
 * Overlapping 5-fret zones. Upper zones are added only when the neck is long
 * enough to play them: 14–19 once the guitar has more than 15 frets, and
 * 18–24 once it reaches the 18th fret.
 */
export function neckZones(maxFrets: number): NeckZone[] {
  const defs: NeckZone[] = [
    { id: 'open', label: 'Open (0–4)', range: [0, 4] },
    { id: 'iii', label: 'Pos III (2–6)', range: [2, 6] },
    { id: 'v', label: 'Pos V (4–8)', range: [4, 8] },
    { id: 'vii', label: 'Pos VII (6–10)', range: [6, 10] },
    { id: 'ix', label: 'Pos IX (8–12)', range: [8, 12] },
    { id: 'xii', label: 'Pos XII (11–15)', range: [11, 15] },
  ];
  if (maxFrets > 15) defs.push({ id: 'upper14', label: 'Upper (14–19)', range: [14, 19] });
  if (maxFrets >= 18) defs.push({ id: 'upper18', label: 'Upper (18–24)', range: [18, 24] });
  return defs
    .filter((z) => z.range[0] <= maxFrets)
    .map((z) => ({ ...z, range: [z.range[0], Math.min(z.range[1], maxFrets)] as [number, number] }))
    .filter((z) => z.range[1] >= z.range[0]);
}

/**
 * Low / mid / high registers as inclusive string indexes (0 = lowest).
 * Each register is at least four strings when the instrument has them, so a
 * 4-string voicing still fits inside the filter.
 */
export function stringGroupRange(stringCount: number, group: StringGroup): [number, number] {
  if (group === 'all' || stringCount <= 1) return [0, Math.max(0, stringCount - 1)];
  const width = Math.min(stringCount, Math.max(4, Math.ceil(stringCount / 2)));
  if (group === 'low') return [0, width - 1];
  if (group === 'high') return [stringCount - width, stringCount - 1];
  const start = Math.round((stringCount - width) / 2);
  return [start, start + width - 1];
}

function labelForBaseFret(baseFret: number, maxFrets: number): string {
  const zones = neckZones(Math.max(maxFrets, baseFret)).filter(
    (z) => baseFret >= z.range[0] && baseFret <= z.range[1],
  );
  if (!zones.length) return baseFret >= 14 ? 'Upper (14+)' : 'Open (0–4)';
  zones.sort((a, b) => baseFret - a.range[0] - (baseFret - b.range[0]));
  return zones[0].label;
}

/**
 * Guide-tone rules used by real guitar voicings:
 * - The perfect 5th may be omitted once the chord has four or more notes.
 *   An altered 5th (b5, #5) stays, because it is the chord's color.
 * - On 11 and 13 chords the major 9th may also be omitted, so a 13th can be
 *   played as 1–3–b7–13 (G13 = G–B–F–E). The 9th of a 9 / maj9 / m9 / 7#9 / 7b9
 *   is the top extension and stays required.
 * - Root, 3rd (or 2nd/4th on a sus chord), 6th/7th, and that top extension are
 *   essential. Triad and shell filters relax this further.
 */
function chordToneInfo(chordSymbol: string): ChordToneInfo | null {
  const chord = Chord.get(chordSymbol);
  if (chord.empty || chord.notes.length === 0) return null;

  const pitches = buildPitches(chord.notes, chord.intervals);
  const chromaToInfo = new Map<number, PitchInfo>();
  pitches.forEach((p) => chromaToInfo.set(p.chroma, p));

  const classified: ClassifiedTone[] = [];
  chord.intervals.forEach((ivl, i) => {
    const info = Interval.get(ivl);
    const chroma = Note.chroma(chord.notes[i]);
    if (info.empty || info.num == null || chroma == null) return;
    classified.push({ chroma, num: Math.abs(info.num), alt: info.alt ?? 0, essential: true });
  });

  const noteCount = classified.length;
  const has11or13 = classified.some((t) => t.num === 11 || t.num === 13);
  for (const tone of classified) {
    const omitFifth = tone.num === 5 && tone.alt === 0 && noteCount >= 4;
    const omitNinth = tone.num === 9 && tone.alt === 0 && has11or13;
    tone.essential = !omitFifth && !omitNinth;
  }

  const chordChromas = classified.map((t) => t.chroma);
  return {
    chordChromas,
    chromaSet: new Set(chordChromas),
    rootChroma: Note.chroma(chord.tonic || chord.notes[0])!,
    chromaToInfo,
    classified,
    essentialChromas: classified.filter((t) => t.essential).map((t) => t.chroma),
  };
}

function toneChroma(tones: ChordToneInfo, num: number): number | null {
  return tones.classified.find((t) => t.num === num)?.chroma ?? null;
}

/** 1–3–5 (or 1–2–5 / 1–4–5 for sus). Power chords have no third, so 1–5. */
function triadChromas(tones: ChordToneInfo): number[] | null {
  const root = toneChroma(tones, 1);
  const fifth = toneChroma(tones, 5);
  if (root == null || fifth == null) return null;
  const third = toneChroma(tones, 3) ?? toneChroma(tones, 4) ?? toneChroma(tones, 2);
  return third == null ? [root, fifth] : [root, third, fifth];
}

/** 1–3–7, or 1–3–6 when the chord has a sixth instead of a seventh. */
function shellChromas(tones: ChordToneInfo): number[] | null {
  const root = toneChroma(tones, 1);
  const third = toneChroma(tones, 3);
  const color = toneChroma(tones, 7) ?? toneChroma(tones, 6);
  if (root == null || third == null || color == null) return null;
  return [root, third, color];
}

const LEGACY_CONTEXT: SearchContext = {
  maxFretSpan: 4,
  allowMutedStrings: true,
  maxFrets: 12,
  positionRange: null,
  allowOpen: true,
  zoneStart: null,
  positionLabel: null,
  voicingStyle: 'all',
};

function inversionFromDegree(degree: string): InversionName {
  const num = degree.replace(/^[#b]+/, '');
  if (num === '1') return 'Root';
  if (num === '3') return '1st Inv';
  if (num === '5') return '2nd Inv';
  if (num === '7') return '3rd Inv';
  return 'Ext Bass';
}

/** Index finger on the barre (or the lone note at the lowest fret); 2–4 walk up by fret, then string. */
function buildFingerMap(frets: (number | null)[]): FingerNumber[] | null {
  const map: FingerNumber[] = frets.map(() => null);
  const fretted: { i: number; f: number }[] = [];
  frets.forEach((f, i) => {
    if (f != null && f > 0) fretted.push({ i, f });
  });
  if (!fretted.length) return map;
  const base = Math.min(...fretted.map((n) => n.f));
  for (const n of fretted) if (n.f === base) map[n.i] = 1;
  const above = fretted.filter((n) => n.f !== base).sort((a, b) => a.f - b.f || a.i - b.i);
  const fingers: FingerNumber[] = [2, 3, 4];
  for (let k = 0; k < above.length; k++) {
    const finger = fingers[k];
    if (!finger) return null;
    map[above[k].i] = finger;
  }
  return map;
}

function hasChromas(present: Set<number>, required: number[]): boolean {
  return required.every((c) => present.has(c));
}

/** Score one fret assignment. Returns null when it is not a playable chord shape. */
function shapeFromFrets(
  frets: (number | null)[],
  tuning: string[],
  tones: ChordToneInfo,
  ctx: SearchContext = LEGACY_CONTEXT,
): ChordShape | null {
  const soundingIdx = frets.map((f, i) => (f !== null ? i : -1)).filter((i) => i >= 0);
  if (soundingIdx.length < 3) return null;

  for (const i of soundingIdx) {
    const fret = frets[i]!;
    if (fret === 0) {
      if (!ctx.allowOpen) return null;
    } else if (ctx.positionRange && (fret < ctx.positionRange[0] || fret > ctx.positionRange[1])) {
      return null;
    }
  }

  const presentChromas = new Set(
    soundingIdx.map((i) => Note.chroma(pitchClassAtFret(tuning[i], frets[i]!))!),
  );
  if ([...presentChromas].some((c) => !tones.chromaSet.has(c))) return null;

  const contiguous =
    soundingIdx[soundingIdx.length - 1] - soundingIdx[0] + 1 === soundingIdx.length;
  const style = ctx.voicingStyle;
  if (style === 'triad') {
    if (soundingIdx.length !== 3 || !contiguous) return null;
    const required = triadChromas(tones);
    if (!required || !hasChromas(presentChromas, required)) return null;
  } else if (style === 'shell') {
    if (soundingIdx.length < 3 || soundingIdx.length > 4 || !contiguous) return null;
    const required = shellChromas(tones);
    if (!required || !hasChromas(presentChromas, required)) return null;
  } else if (style === 'drop2') {
    if (soundingIdx.length !== 4 || !contiguous) return null;
    if (!hasChromas(presentChromas, tones.essentialChromas)) return null;
  } else if (style === 'full') {
    if (soundingIdx.length < 4) return null;
    if (!hasChromas(presentChromas, tones.essentialChromas)) return null;
  } else if (!hasChromas(presentChromas, tones.essentialChromas)) {
    return null;
  }

  const fretted = soundingIdx.map((i) => frets[i]!).filter((f) => f > 0);
  const baseFret = fretted.length ? Math.min(...fretted) : 0;
  const topFret = fretted.length ? Math.max(...fretted) : 0;
  const span = fretted.length ? topFret - baseFret : 0;
  if (span >= ctx.maxFretSpan) return null;
  const countAtBase = fretted.filter((f) => f === baseFret).length;
  const barreSaving = countAtBase >= 2 ? countAtBase - 1 : 0;
  const fingers = fretted.length - barreSaving;
  if (fingers > 4) return null;

  const fingerMap = buildFingerMap(frets);
  if (!fingerMap) return null;

  const firstS = soundingIdx[0];
  const lastS = soundingIdx[soundingIdx.length - 1];
  let innerMutes = 0;
  for (let i = firstS; i <= lastS; i++) if (frets[i] === null) innerMutes++;

  const mutedCount = frets.filter((f) => f === null).length;
  const bassChroma = Note.chroma(pitchClassAtFret(tuning[firstS], frets[firstS]!))!;
  const bassIsRoot = bassChroma === tones.rootChroma;
  const missing = tones.chordChromas.filter((c) => !presentChromas.has(c));
  const positionPenalty =
    ctx.zoneStart == null ? baseFret * 0.5 : Math.max(0, baseFret - ctx.zoneStart) * 0.3;

  const score =
    positionPenalty +
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

  return {
    frets,
    baseFret,
    fingers,
    positions,
    score,
    positionLabel: ctx.positionLabel ?? labelForBaseFret(baseFret, ctx.maxFrets),
    fingerMap,
    inversion: inversionFromDegree(positions[0]?.degree ?? ''),
    stringSpan: [firstS + 1, lastS + 1],
  };
}

/**
 * Full search. Cost is exponential in the string count, which is fine for a
 * 6-string guitar and too slow once a 7th or 8th string is added.
 */
function fretAllowed(fret: number, ctx: SearchContext): boolean {
  if (fret > ctx.maxFrets) return false;
  if (fret === 0) return ctx.allowOpen;
  if (!ctx.positionRange) return true;
  return fret >= ctx.positionRange[0] && fret <= ctx.positionRange[1];
}

function searchPlayable(tuning: string[], tones: ChordToneInfo, ctx: SearchContext, limit: number): ChordShape[] {
  const { maxFretSpan, allowMutedStrings, maxFrets } = ctx;
  const n = tuning.length;
  const candidates: (number | null)[][] = tuning.map((open) => {
    const arr: (number | null)[] = [];
    for (let f = 0; f <= maxFrets; f++) {
      if (!fretAllowed(f, ctx)) continue;
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
    const shape = shapeFromFrets(cur.slice(), tuning, tones, ctx);
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
function searchExtended(tuning: string[], tones: ChordToneInfo, ctx: SearchContext, limit: number): ChordShape[] {
  const windowSize = 6;
  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  // Enough window shapes that a familiar open voicing is not crowded out
  // before the extra strings are filled in.
  const windowLimit = Math.max(limit, 30);

  for (let start = 0; start <= tuning.length - windowSize; start++) {
    const windowTuning = tuning.slice(start, start + windowSize);
    const windowShapes = searchPlayable(windowTuning, tones, ctx, windowLimit);
    for (const windowShape of windowShapes) {
      for (const frets of expandWindow(tuning, tones, start, windowShape.frets, windowShape.baseFret, ctx.allowOpen)) {
        const shape = shapeFromFrets(frets, tuning, tones, ctx);
        if (!shape) continue;
        const key = shape.frets.map((f) => (f === null ? 'x' : f)).join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        shapes.push(shape);
      }
    }
  }

  shapes.sort((a, b) => a.score - b.score);
  return shapes.slice(0, limit);
}

/** Fret choices for strings outside a 6-string window. */
function expandWindow(
  tuning: string[],
  tones: ChordToneInfo,
  start: number,
  windowFrets: (number | null)[],
  baseFret: number,
  allowOpen: boolean,
): (number | null)[][] {
  const extras: number[] = [];
  for (let i = 0; i < tuning.length; i++) {
    if (i < start || i >= start + windowFrets.length) extras.push(i);
  }

  // A full product stays cheap through three extra strings (a 9-string set
  // around a 6-string window). Past that, mute the leftovers so a custom
  // 12-string cannot hang. Outer mutes still leave the window's own shapes.
  const fillExtras = extras.length <= 3;
  const options: (number | null)[][] = extras.map((i) => {
    if (!fillExtras) return [null];
    const opts: (number | null)[] = [null];
    if (allowOpen) {
      const openChroma = Note.chroma(pitchClassAtFret(tuning[i], 0));
      if (openChroma != null && tones.chromaSet.has(openChroma)) opts.push(0);
    }
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

interface WindowPlan {
  start: number;
  size: number;
  allowMuted: boolean;
}

/**
 * Which contiguous string windows to search.
 * Triad / 4-string / shell filters search exactly those widths.
 * Full and unfiltered searches use one window of up to 6 strings; mutes
 * inside it produce the smaller grips, and a 7+ string tuning slides that
 * window so the low strings are searched too.
 */
function windowPlans(style: VoicingStyle, group: [number, number]): WindowPlan[] {
  const [g0, g1] = group;
  const width = g1 - g0 + 1;
  const specs: { size: number; allowMuted: boolean }[] = [];
  if (style === 'triad') specs.push({ size: 3, allowMuted: false });
  else if (style === 'drop2') specs.push({ size: 4, allowMuted: false });
  else if (style === 'shell') {
    specs.push({ size: 3, allowMuted: false });
    specs.push({ size: 4, allowMuted: true });
  } else {
    const size = Math.min(6, width);
    const minSize = style === 'full' ? 4 : 3;
    if (size >= minSize) specs.push({ size, allowMuted: true });
  }

  const plans: WindowPlan[] = [];
  for (const spec of specs) {
    if (spec.size > width) continue;
    for (let start = g0; start + spec.size - 1 <= g1; start++) {
      plans.push({ start, size: spec.size, allowMuted: spec.allowMuted });
    }
  }
  return plans;
}

function pushShape(shapes: ChordShape[], seen: Set<string>, shape: ChordShape | null) {
  if (!shape) return;
  const key = shape.frets.map((f) => (f === null ? 'x' : f)).join('-');
  if (seen.has(key)) return;
  seen.add(key);
  shapes.push(shape);
}

/**
 * Filtered search used by position buckets and by voicing-style / string-set
 * queries. Windows stay at 6 strings or fewer so a 7- or 8-string tuning
 * (and a custom set) still returns low, middle, and high grips.
 */
function searchFiltered(tuning: string[], tones: ChordToneInfo, ctx: SearchContext, limit: number): ChordShape[] {
  const group = stringGroupRange(tuning.length, 'all');
  // stringGroup is applied by the caller via the context's window list.
  const plans = windowPlans(ctx.voicingStyle, group);
  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  const windowLimit = Math.max(limit, 40);

  for (const plan of plans) {
    const windowTuning = tuning.slice(plan.start, plan.start + plan.size);
    const windowCtx: SearchContext = { ...ctx, allowMutedStrings: plan.allowMuted };
    const found = searchPlayable(windowTuning, tones, windowCtx, windowLimit);
    for (const windowShape of found) {
      const frets: (number | null)[] = new Array(tuning.length).fill(null);
      for (let k = 0; k < plan.size; k++) frets[plan.start + k] = windowShape.frets[k];
      pushShape(shapes, seen, shapeFromFrets(frets, tuning, tones, ctx));
    }
  }

  shapes.sort((a, b) => a.score - b.score);
  return shapes.slice(0, limit);
}

function searchInGroup(
  tuning: string[],
  tones: ChordToneInfo,
  ctx: SearchContext,
  group: StringGroup,
  limit: number,
): ChordShape[] {
  if (group === 'all') return searchFiltered(tuning, tones, ctx, limit);
  const [g0, g1] = stringGroupRange(tuning.length, group);
  const sliced = tuning.slice(g0, g1 + 1);
  const found = searchFiltered(sliced, tones, ctx, limit);
  const shapes: ChordShape[] = [];
  const seen = new Set<string>();
  for (const shape of found) {
    const frets: (number | null)[] = new Array(tuning.length).fill(null);
    shape.frets.forEach((fret, i) => {
      frets[g0 + i] = fret;
    });
    pushShape(shapes, seen, shapeFromFrets(frets, tuning, tones, ctx));
  }
  shapes.sort((a, b) => a.score - b.score);
  return shapes.slice(0, limit);
}

function makeContext(options: ShapeOptions, zone?: NeckZone): SearchContext {
  const maxFrets = options.maxFrets ?? (zone ? 15 : 12);
  const positionRange = zone?.range ?? options.positionRange ?? null;
  const allowOpen =
    options.allowOpenStrings ?? (positionRange == null || positionRange[0] <= 0);
  return {
    maxFretSpan: options.maxFretSpan ?? 4,
    allowMutedStrings: options.allowMutedStrings ?? true,
    maxFrets,
    positionRange,
    allowOpen,
    zoneStart: zone ? zone.range[0] : null,
    positionLabel: zone?.label ?? null,
    voicingStyle: options.voicingStyle ?? 'all',
  };
}

const PER_ZONE_LIMIT = 6;
const PER_ZONE_SCAN = 24;

/**
 * Playable voicings partitioned into neck zones, so a high-position grip is
 * not crowded out by open chords. Each zone is scored from its own start
 * fret, and the open zone is the only one that uses open strings.
 */
export function findChordShapesByPosition(
  chordSymbol: string,
  tuning: string[],
  options: ShapeOptions = {},
): PositionBucket[] {
  const maxFrets = options.maxFrets ?? 15;
  const tones = chordToneInfo(chordSymbol);
  if (!tones || tuning.length < 2) return [];
  const zones = options.positionRange
    ? [
        {
          id: 'custom',
          label: labelForBaseFret(options.positionRange[0], maxFrets),
          range: options.positionRange,
        },
      ]
    : neckZones(maxFrets);

  return zones.map((zone) => {
    const ctx = makeContext({ ...options, maxFrets }, zone);
    const found = searchInGroup(tuning, tones, ctx, options.stringGroup ?? 'all', PER_ZONE_SCAN);
    return { zone, shapes: found.slice(0, PER_ZONE_LIMIT), count: found.length };
  });
}

/**
 * Search for playable voicings of a chord in a given tuning.
 * One note per string, within a `maxFretSpan`-fret window, containing the
 * chord's essential tones, ranked by playability (fewer stretches, lower
 * position, root in the bass, fuller voicings).
 *
 * Six strings and fewer use a full search. More strings search 6-string
 * windows so the chord dictionary stays responsive on a 7- or 8-string guitar.
 * A string-set or voicing-style filter searches every matching subset, including
 * 3-string triads and 4-string grips on the low strings of an extended tuning.
 */
export function findChordShapes(
  chordSymbol: string,
  tuning: string[],
  options: ShapeOptions = {},
): ChordShape[] {
  const tones = chordToneInfo(chordSymbol);
  if (!tones || tuning.length < 2) return [];
  const limit = options.limit ?? 8;
  const filtered =
    options.positionRange != null ||
    (options.stringGroup != null && options.stringGroup !== 'all') ||
    (options.voicingStyle != null && options.voicingStyle !== 'all');
  if (filtered) {
    const ctx = makeContext(options, options.positionRange
      ? {
          id: 'custom',
          label: labelForBaseFret(options.positionRange[0], options.maxFrets ?? 12),
          range: options.positionRange,
        }
      : undefined);
    return searchInGroup(tuning, tones, ctx, options.stringGroup ?? 'all', limit);
  }
  const ctx = makeContext(options);
  if (tuning.length <= 6) return searchPlayable(tuning, tones, ctx, limit);
  return searchExtended(tuning, tones, ctx, limit);
}

export type NeckZoneChoice = 'open' | 'mid' | 'high' | 'smooth';

const PROGRESSION_ZONES: Record<Exclude<NeckZoneChoice, 'smooth'>, [number, number]> = {
  open: [0, 4],
  mid: [4, 8],
  high: [8, 12],
};

function progressionPool(
  symbol: string,
  tuning: string[],
  maxFrets: number,
  choice: NeckZoneChoice,
): ChordShape[] {
  if (choice === 'smooth') {
    return findChordShapesByPosition(symbol, tuning, { maxFrets }).flatMap((bucket) => bucket.shapes.slice(0, 2));
  }
  const [lo, hi] = PROGRESSION_ZONES[choice];
  if (lo > maxFrets) return [];
  return findChordShapes(symbol, tuning, {
    maxFrets,
    positionRange: [lo, Math.min(hi, maxFrets)],
    limit: 8,
  });
}

/**
 * One playable shape per chord. A fixed zone stays in that fret window.
 * Smooth voice leading picks, at each step, the shape whose base fret is
 * closest to the previous chord.
 */
export function selectProgressionVoicings(
  symbols: string[],
  tuning: string[],
  maxFrets: number,
  choice: NeckZoneChoice,
): (ChordShape | null)[] {
  let previous: ChordShape | null = null;
  return symbols.map((symbol) => {
    const pool = progressionPool(symbol, tuning, maxFrets, choice);
    if (!pool.length) {
      previous = null;
      return null;
    }
    let best = pool[0];
    if (choice === 'smooth' && previous) {
      const anchor = previous.baseFret;
      best = pool.reduce((current, candidate) => {
        const currentDelta = Math.abs(current.baseFret - anchor);
        const candidateDelta = Math.abs(candidate.baseFret - anchor);
        if (candidateDelta !== currentDelta) return candidateDelta < currentDelta ? candidate : current;
        return candidate.score < current.score ? candidate : current;
      });
    }
    previous = best;
    return best;
  });
}
