import { Chord, Note } from 'tonal';
import { notesForScale } from './engine';
import { pitchClassAtFret } from './notes';

export interface ScalePosition {
  id: string;
  label: string;
  range: [number, number];
}

export interface ScaleChord {
  /** Chord symbol, e.g. "Cmaj7". */
  symbol: string;
  /** Scale degree of the root, e.g. "1" or "b3". */
  degree: string;
  chromas: number[];
}

/** Five CAGED-style boxes, as fret offsets from the root on the lowest string. */
const CAGED_OFFSETS: [number, number][] = [
  [0, 4],
  [3, 6],
  [5, 8],
  [7, 10],
  [9, 12],
];

function lowestFret(open: string, pc: string, maxFret: number): number | null {
  const target = Note.chroma(pc);
  if (target == null) return null;
  for (let fret = 0; fret <= maxFret; fret++) {
    if (Note.chroma(pitchClassAtFret(open, fret)) === target) return fret;
  }
  return null;
}

/** Shift a window onto the neck, an octave at a time, then clip to `numFrets`. */
function placeWindow(start: number, end: number, numFrets: number): [number, number] | null {
  let lo = start;
  let hi = end;
  while (lo < 0) {
    lo += 12;
    hi += 12;
  }
  while (lo > numFrets && lo >= 12) {
    lo -= 12;
    hi -= 12;
  }
  if (lo > numFrets || hi < 0) return null;
  hi = Math.min(hi, numFrets);
  if (hi < lo) return null;
  return [lo, hi];
}

/**
 * Whole neck, five root-relative CAGED boxes, and one 3-notes-per-string
 * window per scale degree (7 for a diatonic scale, fewer for pentatonic or blues).
 * Boxes are anchored to the root's fret on the lowest string and wrap by an
 * octave when they would fall off the neck.
 */
export function scalePositions(
  root: string,
  scaleType: string,
  tuning: string[],
  numFrets: number,
): ScalePosition[] {
  const positions: ScalePosition[] = [{ id: 'neck', label: 'Whole neck', range: [0, numFrets] }];
  if (!tuning.length || numFrets < 1) return positions;

  const rootFret = lowestFret(tuning[0], root, Math.min(11, numFrets)) ?? 0;
  CAGED_OFFSETS.forEach(([from, to], index) => {
    const range = placeWindow(rootFret + from, rootFret + to, numFrets);
    if (!range) return;
    positions.push({ id: `box-${index + 1}`, label: `Box ${index + 1}`, range });
  });

  const scale = notesForScale(root, scaleType);
  const used = new Set<number>();
  scale.pitches.forEach((pitch, index) => {
    const fret = lowestFret(tuning[0], pitch.pc, Math.min(11, numFrets));
    if (fret == null || used.has(fret)) return;
    used.add(fret);
    const range = placeWindow(fret, fret + 4, numFrets);
    if (!range) return;
    positions.push({ id: `nps-${index}`, label: `3NPS ${pitch.degree}`, range });
  });
  return positions;
}

/**
 * Chords built from each scale degree that has a 3rd and a 5th in the scale,
 * plus a 7th when the scale contains one. This is the diatonic seventh on a
 * 7-note scale, and the available triad or seventh on a shorter scale.
 */
export function chordsInScale(root: string, scaleType: string): ScaleChord[] {
  const scale = notesForScale(root, scaleType);
  const chords: ScaleChord[] = [];
  const pick = (index: number, ranked: number[]) => {
    const root = scale.pitches[index];
    let best: { chroma: number; pc: string; rank: number } | null = null;
    for (let step = 1; step < scale.pitches.length; step++) {
      const note = scale.pitches[(index + step) % scale.pitches.length];
      const interval = (note.chroma - root.chroma + 12) % 12;
      const rank = ranked.indexOf(interval);
      if (rank === -1) continue;
      if (!best || rank < best.rank) best = { chroma: note.chroma, pc: note.pc, rank };
    }
    return best;
  };

  scale.pitches.forEach((pitch, index) => {
    // Prefer a perfect fifth over an altered one, and take whichever 3rd and 7th the scale has.
    const third = pick(index, [3, 4]);
    const fifth = pick(index, [7, 6, 8]);
    const seventh = pick(index, [10, 11]);
    if (!third || !fifth) return;
    const pcs = [pitch.pc, third.pc, fifth.pc, ...(seventh ? [seventh.pc] : [])];
    const detected = Chord.detect(pcs).find((symbol) => !symbol.includes('/'));
    const chord = detected ? Chord.get(detected) : null;
    const symbol = chord && !chord.empty && chord.symbol ? chord.symbol : pitch.pc;
    chords.push({
      symbol,
      degree: pitch.degree,
      chromas: pcs.map((pc) => Note.chroma(pc)!),
    });
  });
  return chords;
}
