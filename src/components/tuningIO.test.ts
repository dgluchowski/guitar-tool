import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { parseTuningText, tuningToText } from '../music/tuningIO';
import { TUNINGS } from '../music/notes';

describe('tuning import/export', () => {
  it('exports a tuning as space-separated notes', () => {
    expect(tuningToText(['E2', 'A2', 'D3', 'G3', 'B3', 'E4'])).toBe('E2 A2 D3 G3 B3 E4');
  });

  it('parses space-separated text', () => {
    expect(parseTuningText('D2 G2 C3 F3 A3 D4')).toEqual(['D2', 'G2', 'C3', 'F3', 'A3', 'D4']);
  });

  it('parses comma-separated and messy whitespace', () => {
    expect(parseTuningText('  D2 ,G2,  C3 ,F3, A3 ,D4 ')).toEqual(['D2', 'G2', 'C3', 'F3', 'A3', 'D4']);
  });

  it('normalises flats to sharps but keeps the same pitch', () => {
    const parsed = parseTuningText('Eb2 Ab2 Db3 Gb3 Bb3 Eb4');
    expect(parsed).not.toBeNull();
    const original = ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'];
    expect(parsed!.map(Note.midi)).toEqual(original.map(Note.midi));
  });

  it('rejects invalid or too-short input', () => {
    expect(parseTuningText('')).toBeNull();
    expect(parseTuningText('E2')).toBeNull(); // need at least two strings
    expect(parseTuningText('E A D G')).toBeNull(); // missing octaves
    expect(parseTuningText('banana E2')).toBeNull();
  });

  it('round-trips every preset tuning by pitch', () => {
    for (const t of TUNINGS) {
      const parsed = parseTuningText(tuningToText(t.strings));
      expect(parsed, t.name).not.toBeNull();
      expect(parsed!.map(Note.midi)).toEqual(t.strings.map(Note.midi));
    }
  });
});