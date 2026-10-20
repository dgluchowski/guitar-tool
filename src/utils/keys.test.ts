import { describe, it, expect } from 'vitest';
import { resolveNumeral, resolveProgression, diatonicChords } from './keys';

describe('diatonicChords', () => {
  it('C major triads', () => {
    expect(diatonicChords('C', 'major').map((c) => c.symbol)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim',
    ]);
  });

  it('A natural minor triads', () => {
    expect(diatonicChords('A', 'minor').map((c) => c.symbol)).toEqual([
      'Am',
      'Bdim',
      'C',
      'Dm',
      'Em',
      'F',
      'G',
    ]);
  });
});

describe('resolveNumeral', () => {
  it('honors explicit dominant 7 (V7 in C = G7)', () => {
    expect(resolveNumeral('V7', 'C', 'major')).toBe('G7');
  });

  it('uppercase V in minor is a major chord (harmonic borrowing)', () => {
    expect(resolveNumeral('V', 'A', 'minor')).toBe('E');
    expect(resolveNumeral('V7', 'A', 'minor')).toBe('E7');
  });

  it('handles flat numerals (bVII in C = Bb)', () => {
    expect(resolveNumeral('bVII', 'C', 'major')).toBe('Bb');
    expect(resolveNumeral('bIII', 'C', 'major')).toBe('Eb');
  });

  it('vii° in C = Bdim', () => {
    expect(resolveNumeral('vii°', 'C', 'major')).toBe('Bdim');
  });
});

describe('resolveProgression', () => {
  it('I-V-vi-IV in C = C G Am F', () => {
    expect(resolveProgression(['I', 'V', 'vi', 'IV'], 'C', 'major')).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('i-iv-v in A minor = Am Dm Em', () => {
    expect(resolveProgression(['i', 'iv', 'v'], 'A', 'minor')).toEqual(['Am', 'Dm', 'Em']);
  });

  it('12-bar style I-IV-V in G = G C D', () => {
    expect(resolveProgression(['I', 'IV', 'V'], 'G', 'major')).toEqual(['G', 'C', 'D']);
  });
});
