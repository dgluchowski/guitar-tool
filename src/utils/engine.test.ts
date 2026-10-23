import { describe, it, expect } from 'vitest';
import { Note } from 'tonal';
import { notesForChord, notesForScale, mapNotesToFretboard, findChordShapes } from './engine';

const STANDARD = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const DADGAD = ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'];

/** Compare pitch-class name lists by chroma (enharmonic-insensitive). */
const chromas = (names: string[]) => names.map((n) => Note.chroma(n)).sort((a, b) => a! - b!);

describe('notesForChord', () => {
  it('C major = C E G with degrees 1 3 5', () => {
    const set = notesForChord('C');
    expect(chromas(set.pitches.map((p) => p.pc))).toEqual(chromas(['C', 'E', 'G']));
    expect(set.pitches.map((p) => p.degree)).toEqual(['1', '3', '5']);
    expect(set.root).toBe('C');
  });

  it('Em = E G B with degrees 1 b3 5', () => {
    const set = notesForChord('Em');
    expect(chromas(set.pitches.map((p) => p.pc))).toEqual(chromas(['E', 'G', 'B']));
    expect(set.pitches.map((p) => p.degree)).toEqual(['1', 'b3', '5']);
  });

  it('G7 = G B D F with degrees 1 3 5 b7', () => {
    const set = notesForChord('G7');
    expect(chromas(set.pitches.map((p) => p.pc))).toEqual(chromas(['G', 'B', 'D', 'F']));
    expect(set.pitches.map((p) => p.degree)).toEqual(['1', '3', '5', 'b7']);
  });
});

describe('notesForScale', () => {
  it('C major has 7 notes C D E F G A B', () => {
    const set = notesForScale('C', 'major');
    expect(set.pitches).toHaveLength(7);
    expect(chromas(set.pitches.map((p) => p.pc))).toEqual(chromas(['C', 'D', 'E', 'F', 'G', 'A', 'B']));
  });
});

describe('mapNotesToFretboard', () => {
  it('maps C major onto the low E string within frets 0-3', () => {
    const set = notesForChord('C');
    const positions = mapNotesToFretboard(set.pitches, STANDARD, [0, 3]);
    const lowE = positions.filter((p) => p.string === 0).sort((a, b) => a.fret - b.fret);
    // E2 open = E (the 3rd); fret 3 = G (the 5th)
    expect(lowE.map((p) => p.fret)).toEqual([0, 3]);
    expect(lowE[0].degree).toBe('3');
    expect(lowE[1].degree).toBe('5');
  });

  it('only includes chord tones', () => {
    const set = notesForChord('C');
    const positions = mapNotesToFretboard(set.pitches, STANDARD, [0, 12]);
    const allowed = new Set(set.pitches.map((p) => p.chroma));
    for (const p of positions) expect(allowed.has(Note.chroma(p.pc)!)).toBe(true);
  });
});

/** Render a shape's frets as a compact string like "x32010". */
const fretStr = (frets: (number | null)[]) => frets.map((f) => (f === null ? 'x' : f)).join('');

describe('findChordShapes (standard tuning)', () => {
  it('finds the open C major shape x32010', () => {
    const shapes = findChordShapes('C', STANDARD);
    const strs = shapes.map((s) => fretStr(s.frets));
    expect(strs).toContain('x32010');
  });

  it('finds the open Em shape 022000', () => {
    const shapes = findChordShapes('Em', STANDARD);
    const strs = shapes.map((s) => fretStr(s.frets));
    expect(strs).toContain('022000');
  });

  it('finds the open G7 shape 320001', () => {
    const shapes = findChordShapes('G7', STANDARD);
    const strs = shapes.map((s) => fretStr(s.frets));
    expect(strs).toContain('320001');
  });

  it('every sounding note in every shape is a chord tone', () => {
    const set = notesForChord('C');
    const allowed = new Set(set.pitches.map((p) => p.chroma));
    for (const shape of findChordShapes('C', STANDARD)) {
      for (const pos of shape.positions) expect(allowed.has(Note.chroma(pos.pc)!)).toBe(true);
    }
  });

  it('respects the 4-fret span limit', () => {
    for (const shape of findChordShapes('C', STANDARD)) {
      const fretted = shape.frets.filter((f): f is number => f != null && f > 0);
      if (fretted.length) {
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(4);
      }
    }
  });
});

describe('findChordShapes (custom DADGAD tuning)', () => {
  it('returns playable D major voicings with only chord tones', () => {
    const set = notesForChord('D');
    const allowed = new Set(set.pitches.map((p) => p.chroma));
    const shapes = findChordShapes('D', DADGAD);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      for (const pos of shape.positions) expect(allowed.has(Note.chroma(pos.pc)!)).toBe(true);
    }
  });
});

const STANDARD_7 = ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const STANDARD_8 = ['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const DROP_E = ['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

describe('findChordShapes (7 and 8 strings)', () => {
  it('keeps the open C shape on the upper strings of 7-string standard', () => {
    const shapes = findChordShapes('C', STANDARD_7, { maxFrets: 15 });
    expect(shapes.map((s) => fretStr(s.frets))).toContain('xx32010');
  });

  it('searches an 8-string chord quickly and only sounds chord tones', () => {
    const set = notesForChord('Cmaj7');
    const allowed = new Set(set.pitches.map((p) => p.chroma));
    const start = performance.now();
    const shapes = findChordShapes('Cmaj7', STANDARD_8, { maxFrets: 15 });
    expect(performance.now() - start).toBeLessThan(500);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape.fingers).toBeLessThanOrEqual(4);
      const fretted = shape.frets.filter((f): f is number => f != null && f > 0);
      if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(4);
      for (const pos of shape.positions) expect(allowed.has(Note.chroma(pos.pc)!)).toBe(true);
    }
  });

  it('can use the extra open strings in an Em voicing of Drop E', () => {
    const shapes = findChordShapes('Em', DROP_E, { maxFrets: 15 });
    const strs = shapes.map((s) => fretStr(s.frets));
    expect(strs.some((s) => s === '00022000' || s === 'x0022000' || s === 'xx022000')).toBe(true);
  });

  it('stays responsive with more than eight strings', () => {
    const tuning = ['C1', 'F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'];
    const start = performance.now();
    const shapes = findChordShapes('C', tuning, { maxFrets: 15 });
    expect(performance.now() - start).toBeLessThan(500);
    expect(shapes.length).toBeGreaterThan(0);
  });
});
