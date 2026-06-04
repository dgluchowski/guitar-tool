import { describe, it, expect } from 'vitest';
import { EXERCISES, INTERVAL_NAMES, DEGREE_LABELS, type EarSettings } from './exercises';
import { midiOf } from '../music/notes';

const base: EarSettings = { difficulty: 'easy', direction: 'asc', arpeggio: false, reference: true };
const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe('ear exercises', () => {
  it('generate structurally valid questions across all difficulties', () => {
    for (const e of EXERCISES) {
      for (const d of e.difficulties) {
        for (let n = 0; n < 30; n++) {
          const q = e.make({ ...base, difficulty: d });
          expect(q.choices.length).toBeGreaterThanOrEqual(2);
          expect(q.answerIndex).toBeGreaterThanOrEqual(0);
          expect(q.answerIndex).toBeLessThan(q.choices.length);
          expect(q.notes.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('interval answer matches the real semitone gap (ascending)', () => {
    const e = ex('interval');
    for (const d of e.difficulties)
      for (let n = 0; n < 50; n++) {
        const q = e.make({ ...base, difficulty: d, direction: 'asc' });
        const semis = midiOf(q.notes[1])! - midiOf(q.notes[0])!;
        expect(q.choices[q.answerIndex]).toBe(INTERVAL_NAMES[semis]);
      }
  });

  it('interval answer is correct even when played descending', () => {
    const e = ex('interval');
    for (let n = 0; n < 50; n++) {
      const q = e.make({ ...base, difficulty: 'hard', direction: 'desc' });
      const semis = Math.abs(midiOf(q.notes[1])! - midiOf(q.notes[0])!);
      expect(q.choices[q.answerIndex]).toBe(INTERVAL_NAMES[semis]);
    }
  });

  it('higher-or-lower marks the genuinely higher note', () => {
    const e = ex('higher-lower');
    for (let n = 0; n < 50; n++) {
      const q = e.make({ ...base, difficulty: 'medium' });
      const higherIdx = midiOf(q.notes[1])! > midiOf(q.notes[0])! ? 1 : 0;
      expect(q.answerIndex).toBe(higherIdx);
    }
  });

  it('scale-degree answer matches the interval above the tonic', () => {
    const e = ex('scale-degree');
    for (const d of e.difficulties)
      for (let n = 0; n < 50; n++) {
        const q = e.make({ ...base, difficulty: d, reference: true });
        const semis = (midiOf(q.notes[1])! - midiOf(q.notes[0])!) % 12;
        expect(q.choices[q.answerIndex]).toBe(DEGREE_LABELS[semis]);
      }
  });

  it('chord-quality reveal ends with the correct answer and voices ≥3 notes', () => {
    const e = ex('chord-quality');
    for (const d of e.difficulties)
      for (let n = 0; n < 30; n++) {
        const q = e.make({ ...base, difficulty: d });
        expect(q.reveal.endsWith(q.choices[q.answerIndex])).toBe(true);
        expect(q.notes.length).toBeGreaterThanOrEqual(3);
      }
  });
});
