import { describe, expect, it } from 'vitest';
import { chordsInScale, scalePositions } from './scalePositions';

const STANDARD = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

describe('scalePositions', () => {
  it('covers the whole neck and five boxes from an open root', () => {
    const positions = scalePositions('E', 'major', STANDARD, 15);
    expect(positions[0]).toEqual({ id: 'neck', label: 'Whole neck', range: [0, 15] });
    const boxes = positions.filter((p) => p.id.startsWith('box-'));
    expect(boxes).toHaveLength(5);
    expect(boxes[0].range).toEqual([0, 4]);
    expect(boxes[4].range[1]).toBeLessThanOrEqual(15);
    const nps = positions.filter((p) => p.id.startsWith('nps-'));
    expect(nps).toHaveLength(7);
    for (const position of positions) {
      expect(position.range[0]).toBeGreaterThanOrEqual(0);
      expect(position.range[1]).toBeLessThanOrEqual(15);
    }
  });

  it('wraps a high root back onto a 15-fret neck', () => {
    const boxes = scalePositions('C', 'major', STANDARD, 15).filter((p) => p.id.startsWith('box-'));
    expect(boxes).toHaveLength(5);
    for (const box of boxes) {
      expect(box.range[0]).toBeLessThanOrEqual(15);
      expect(box.range[1]).toBeLessThanOrEqual(15);
    }
    // C is fret 8 on the low E. The fifth box starts 9 frets higher (fret 17) and drops an octave.
    expect(boxes[4].range).toEqual([5, 8]);
  });

  it('builds one 3NPS window per pentatonic degree', () => {
    const nps = scalePositions('A', 'minor pentatonic', STANDARD, 22).filter((p) => p.id.startsWith('nps-'));
    expect(nps).toHaveLength(5);
    for (const position of nps) expect(position.range[1]).toBeLessThanOrEqual(22);
  });
});

describe('chordsInScale', () => {
  it('names the diatonic sevenths of C major', () => {
    expect(chordsInScale('C', 'major').map((c) => c.symbol)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7b5',
    ]);
  });
});