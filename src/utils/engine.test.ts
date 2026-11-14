import { describe, it, expect } from 'vitest';
import { Note } from 'tonal';
import {
  notesForChord,
  notesForScale,
  mapNotesToFretboard,
  findChordShapes,
  findChordShapesByPosition,
  neckZones,
  selectProgressionVoicings,
  type ChordShape,
} from './engine';

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

const degrees = (shape: ChordShape) => new Set(shape.positions.map((p) => p.degree));

describe('extended chord omissions', () => {
  it('voices G13 with guide tones, and the 4-string grip omits 5 and 9', () => {
    const shapes = findChordShapes('G13', STANDARD, { maxFrets: 15, limit: 12 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const d = degrees(shape);
      expect(d.has('1')).toBe(true);
      expect(d.has('3')).toBe(true);
      expect(d.has('b7')).toBe(true);
      expect(d.has('13')).toBe(true);
      expect(shape.fingers).toBeLessThanOrEqual(4);
    }

    // A 4-string grip has room for exactly the guide tones 1–3–b7–13.
    const fours = findChordShapes('G13', STANDARD, { voicingStyle: 'drop2', maxFrets: 15, limit: 8 });
    expect(fours.length).toBeGreaterThan(0);
    for (const shape of fours) {
      const d = degrees(shape);
      expect([...d].sort()).toEqual(['1', '13', '3', 'b7']);
      expect(shape.positions).toHaveLength(4);
    }
  });

  it('keeps the altered 9th in E7#9 and the 9th in Fmaj9 and E9', () => {
    for (const symbol of ['E7#9', 'Fmaj9', 'E9'] as const) {
      const shapes = findChordShapes(symbol, STANDARD, { maxFrets: 15, limit: 20 });
      expect(shapes.length, symbol).toBeGreaterThan(0);
      const required = symbol === 'E7#9' ? '#9' : '9';
      for (const shape of shapes) expect(degrees(shape).has(required), symbol).toBe(true);
    }
  });
});

describe('findChordShapesByPosition', () => {
  it('adds upper zones only when the neck is long enough', () => {
    expect(neckZones(15).map((z) => z.id)).toEqual(['open', 'iii', 'v', 'vii', 'ix', 'xii']);
    expect(neckZones(17).map((z) => z.id)).toContain('upper14');
    expect(neckZones(17).map((z) => z.id)).not.toContain('upper18');
    expect(neckZones(24).map((z) => z.id)).toContain('upper18');
  });

  it.each([
    ['6-string', STANDARD],
    ['7-string', STANDARD_7],
    ['8-string', STANDARD_8],
  ])('finds %s voicings in the low, mid, and high zones', (_label, tuning) => {
    const start = performance.now();
    const buckets = findChordShapesByPosition('C', tuning, { maxFrets: 15 });
    expect(performance.now() - start).toBeLessThan(500);
    for (const id of ['open', 'v', 'ix', 'xii']) {
      const bucket = buckets.find((b) => b.zone.id === id);
      expect(bucket?.shapes.length, id).toBeGreaterThan(0);
      for (const shape of bucket!.shapes) {
        expect(shape.positionLabel).toBe(bucket!.zone.label);
        expect(shape.fingerMap).toHaveLength(tuning.length);
        expect(shape.stringSpan[0]).toBeGreaterThanOrEqual(1);
        expect(shape.stringSpan[1]).toBeLessThanOrEqual(tuning.length);
        for (const pos of shape.positions) {
          if (pos.fret === 0) expect(bucket!.zone.range[0]).toBe(0);
          else {
            expect(pos.fret).toBeGreaterThanOrEqual(bucket!.zone.range[0]);
            expect(pos.fret).toBeLessThanOrEqual(bucket!.zone.range[1]);
          }
        }
      }
    }
  });

  it('labels the open C shape and its fingering', () => {
    const open = findChordShapesByPosition('C', STANDARD, { maxFrets: 15 })
      .flatMap((b) => b.shapes)
      .find((s) => fretStr(s.frets) === 'x32010');
    expect(open).toBeDefined();
    expect(open!.inversion).toBe('Root');
    expect(open!.stringSpan).toEqual([2, 6]);
    // Fret 1 is the index; fret 2 then fret 3 take the next fingers. Opens and the mute stay empty.
    expect(open!.fingerMap).toEqual([null, 3, 2, null, 1, null]);
  });
});

describe('voicing style and string register', () => {
  it('limits triads to three contiguous strings and shells to 1–3–7', () => {
    const triads = findChordShapes('Cmaj7', STANDARD, { voicingStyle: 'triad', maxFrets: 12, limit: 12 });
    expect(triads.length).toBeGreaterThan(0);
    for (const shape of triads) {
      expect(shape.positions).toHaveLength(3);
      const d = degrees(shape);
      expect(d.has('1') && d.has('3') && d.has('5')).toBe(true);
      const strings = shape.positions.map((p) => p.string);
      expect(Math.max(...strings) - Math.min(...strings)).toBe(2);
    }

    const shells = findChordShapes('Cmaj7', STANDARD, { voicingStyle: 'shell', maxFrets: 12, limit: 12 });
    expect(shells.length).toBeGreaterThan(0);
    for (const shape of shells) {
      expect(shape.positions.length).toBeGreaterThanOrEqual(3);
      expect(shape.positions.length).toBeLessThanOrEqual(4);
      const d = degrees(shape);
      expect(d.has('1') && d.has('3') && d.has('7')).toBe(true);
    }

    const fours = findChordShapes('G7', STANDARD, { voicingStyle: 'drop2', maxFrets: 12, limit: 8 });
    expect(fours.length).toBeGreaterThan(0);
    for (const shape of fours) expect(shape.positions).toHaveLength(4);
  });

  it('voice-leads a progression inside the chosen neck zone', () => {
    const open = selectProgressionVoicings(['C', 'G', 'Am', 'F'], STANDARD, 15, 'open');
    expect(open.every((shape) => shape != null)).toBe(true);
    for (const shape of open) {
      for (const pos of shape!.positions) {
        expect(pos.fret === 0 || (pos.fret >= 0 && pos.fret <= 4)).toBe(true);
      }
    }

    const smooth = selectProgressionVoicings(['C', 'F', 'G', 'C'], STANDARD, 15, 'smooth');
    for (let i = 1; i < smooth.length; i++) {
      expect(smooth[i]).not.toBeNull();
      expect(Math.abs(smooth[i]!.baseFret - smooth[i - 1]!.baseFret)).toBeLessThanOrEqual(7);
    }
  });

  it('keeps a low-string filter on the bottom of an 8-string tuning', () => {
    const shapes = findChordShapes('E5', STANDARD_8, { stringGroup: 'low', maxFrets: 12, limit: 8 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      for (const pos of shape.positions) expect(pos.string).toBeLessThanOrEqual(3);
    }
  });
});
