import { describe, expect, it } from 'vitest';
import { canonicalRoot, splitChordSymbol } from './catalog';

describe('canonicalRoot', () => {
  it('spells flats as the sharp names used by the pickers', () => {
    expect(canonicalRoot('Bb')).toBe('A#');
    expect(canonicalRoot('Eb')).toBe('D#');
    expect(canonicalRoot('C#')).toBe('C#');
    expect(canonicalRoot('F')).toBe('F');
  });

  it('rejects names that are not pitch classes', () => {
    expect(canonicalRoot('H')).toBeNull();
    expect(canonicalRoot('')).toBeNull();
  });
});

describe('splitChordSymbol', () => {
  it('keeps a sharp root and its quality', () => {
    expect(splitChordSymbol('F#m7')).toEqual({ root: 'F#', quality: 'm7' });
  });

  it('rewrites a flat root so it matches a dropdown option', () => {
    expect(splitChordSymbol('Bbmaj7')).toEqual({ root: 'A#', quality: 'maj7' });
    expect(splitChordSymbol('Ebm')).toEqual({ root: 'D#', quality: 'm' });
  });

  it('falls back for an unparseable symbol', () => {
    expect(splitChordSymbol('nope')).toEqual({ root: 'C', quality: '' });
  });
});
