import { describe, it, expect } from 'vitest';
import { findTuningPreset, frequencyToNote, midiOf, noteToFrequency, TUNINGS } from './notes';

describe('frequencyToNote', () => {
  it('maps A4 = 440Hz to A4 with 0 cents', () => {
    const d = frequencyToNote(440);
    expect(d).not.toBeNull();
    expect(d!.name).toBe('A4');
    expect(d!.pc).toBe('A');
    expect(d!.octave).toBe(4);
    expect(d!.midi).toBe(69);
    expect(d!.cents).toBe(0);
  });

  it('maps standard low E (82.41Hz) to E2', () => {
    const d = frequencyToNote(82.41);
    expect(d!.pc).toBe('E');
    expect(d!.octave).toBe(2);
    expect(Math.abs(d!.cents)).toBeLessThanOrEqual(1);
  });

  it('reports a slightly sharp pitch as positive cents', () => {
    // ~quarter tone above A4
    const d = frequencyToNote(440 * Math.pow(2, 25 / 1200));
    expect(d!.name).toBe('A4');
    expect(d!.cents).toBeGreaterThan(20);
    expect(d!.cents).toBeLessThan(30);
  });

  it('reports a slightly flat pitch as negative cents', () => {
    const d = frequencyToNote(440 * Math.pow(2, -25 / 1200));
    expect(d!.name).toBe('A4');
    expect(d!.cents).toBeLessThan(-20);
    expect(d!.cents).toBeGreaterThan(-30);
  });

  it('rejects invalid input', () => {
    expect(frequencyToNote(0)).toBeNull();
    expect(frequencyToNote(-100)).toBeNull();
    expect(frequencyToNote(NaN)).toBeNull();
  });
});

describe('noteToFrequency', () => {
  it('gives 440Hz for A4', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 1);
  });
  it('round-trips with frequencyToNote', () => {
    const f = noteToFrequency('E2')!;
    expect(frequencyToNote(f)!.name).toBe('E2');
  });
});

describe('extended-range tunings', () => {
  it('uses the documented 7- and 8-string pitches', () => {
    const byId = Object.fromEntries(TUNINGS.map((t) => [t.id, t]));
    expect(byId['standard-7'].strings).toEqual(['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(byId['drop-a'].strings).toEqual(['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(byId['high-a-7'].strings).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4']);
    expect(byId['standard-8'].strings).toEqual(['F#1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(byId['drop-e'].strings).toEqual(['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(byId.facgce.strings).toEqual(['F2', 'A2', 'C3', 'G3', 'C4', 'E4']);
    for (const id of ['standard-7', 'drop-a', 'high-a-7', 'standard-8', 'drop-e', 'facgce']) {
      expect(byId[id].sources?.length, id).toBeGreaterThan(0);
      for (const open of byId[id].strings) expect(midiOf(open), open).not.toBeNull();
    }
  });

  it('recognises a preset when the pitches and octaves match', () => {
    expect(findTuningPreset(['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'])?.id).toBe('standard-7');
    expect(findTuningPreset(['E1', 'B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'])?.id).toBe('drop-e');
  });
});
