import { describe, expect, it } from 'vitest';
import { decodeState } from './appState';

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
});
