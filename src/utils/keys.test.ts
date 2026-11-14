import { describe, it, expect } from 'vitest';
import { CHORD_QUALITIES } from './catalog';
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

  it('keeps half-diminished °7 distinct from a fully diminished 7th', () => {
    expect(resolveNumeral('ii°7', 'A', 'minor')).toBe('Bm7b5');
    expect(resolveNumeral('viidim7', 'C', 'major')).toBe('Bdim7');
  });

  it('preserves extended suffixes from the chord catalog', () => {
    expect(resolveNumeral('IVmaj9', 'C', 'major')).toBe('Fmaj9');
    expect(resolveNumeral('I7#9', 'E', 'major')).toBe('E7#9');
    expect(resolveNumeral('Vsus4', 'C', 'major')).toBe('Gsus4');
    expect(resolveNumeral('ii7b5', 'C', 'major')).toBe('Dm7b5');
    expect(resolveNumeral('Iadd9', 'C', 'major')).toBe('Cadd9');
    expect(resolveNumeral('V13', 'C', 'major')).toBe('G13');
    expect(resolveNumeral('i5', 'A', 'minor')).toBe('A5');
    expect(resolveNumeral('I5', 'E', 'major')).toBe('E5');

    for (const quality of CHORD_QUALITIES) {
      if (quality.suffix === '7') {
        expect(resolveNumeral('I7', 'C', 'major')).toBe('C7');
        expect(resolveNumeral('i7', 'C', 'major')).toBe('Cm7');
        continue;
      }
      if (quality.suffix === 'm7b5') {
        expect(resolveNumeral('iim7b5', 'C', 'major')).toBe('Dm7b5');
        continue;
      }
      expect(resolveNumeral(`IV${quality.suffix}`, 'C', 'major')).toBe(`F${quality.suffix}`);
    }
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
