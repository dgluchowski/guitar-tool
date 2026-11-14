import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, DEFAULT_STATE } from './appState';

describe('decodeState', () => {
  it('spells flat roots and key tonics with sharps', () => {
    const state = decodeState('#r=Bb&q=m7&kt=Eb&km=major');
    expect(state.root).toBe('A#');
    expect(state.quality).toBe('m7');
    expect(state.keyTonic).toBe('D#');
    expect(state.keyMode).toBe('major');
  });

  it('ignores a root that is not a pitch class', () => {
    expect(decodeState('#r=H').root).toBeUndefined();
  });

  it('reads the fret count and the identify mode', () => {
    const state = decodeState('#m=identify&nf=22');
    expect(state.mode).toBe('identify');
    expect(state.numFrets).toBe(22);
    expect(decodeState('#nf=16').numFrets).toBeUndefined();
    expect(decodeState('#nf=15').numFrets).toBe(15);
  });

  it('round-trips a non-default fret count', () => {
    const encoded = encodeState({ ...DEFAULT_STATE, numFrets: 24, mode: 'identify' });
    expect(encoded).toContain('nf=24');
    expect(encoded).toContain('m=identify');
    const decoded = decodeState(encoded);
    expect(decoded.numFrets).toBe(24);
    expect(decoded.mode).toBe('identify');
  });
});
