import { describe, expect, it } from 'vitest';
import { GENRES } from './genres';
import { SCALE_TYPES } from '../utils/catalog';
import { notesForChord, notesForScale } from '../utils/engine';
import { resolveNumeral } from '../utils/keys';
import { findTuningPreset, midiOf } from '../utils/notes';

describe('genre content', () => {
  it('checks every referenced scale, chord, tuning, and progression', () => {
    expect(GENRES.length).toBeGreaterThanOrEqual(9);

    for (const genre of GENRES) {
      expect(genre.verified, genre.id).toBe(true);
      expect(genre.sources.length, genre.id).toBeGreaterThan(0);
      expect(genre.lessons.length, genre.id).toBeGreaterThanOrEqual(4);
      for (const source of genre.sources) {
        expect(source.title.length, genre.id).toBeGreaterThan(0);
        expect(source.url, genre.id).toMatch(/^https:\/\//);
      }

      for (const tuning of genre.tunings) {
        expect(tuning.strings.length, `${genre.id} ${tuning.name}`).toBeGreaterThanOrEqual(6);
        for (const open of tuning.strings) expect(midiOf(open), open).not.toBeNull();
      }

      for (const scale of genre.scales) {
        expect(SCALE_TYPES, `${genre.id} ${scale.scaleType}`).toContain(scale.scaleType);
        const notes = notesForScale(scale.root, scale.scaleType);
        expect(notes.pitches.length, `${genre.id} ${scale.root} ${scale.scaleType}`).toBeGreaterThan(0);
      }

      for (const voicing of genre.voicings) {
        const notes = notesForChord(voicing.chordSymbol);
        expect(notes.pitches.length, `${genre.id} ${voicing.chordSymbol}`).toBeGreaterThan(0);
      }

      for (const progression of genre.progressions) {
        expect(progression.numerals.length, progression.name).toBeGreaterThan(0);
        for (const numeral of progression.numerals) {
          const symbol = resolveNumeral(numeral, progression.keyTonic, progression.keyMode);
          expect(symbol, `${genre.id} ${progression.name} ${numeral}`).not.toBe('');
          expect(notesForChord(symbol).pitches.length, symbol).toBeGreaterThan(0);
        }
      }

      for (const lesson of genre.lessons) {
        const content = lesson.content;
        if (content.kind === 'chord') {
          expect(notesForChord(content.chordSymbol).pitches.length, lesson.id).toBeGreaterThan(0);
        } else if (content.kind === 'scale') {
          expect(SCALE_TYPES).toContain(content.scaleType);
          expect(notesForScale(content.root, content.scaleType).pitches.length, lesson.id).toBeGreaterThan(0);
        } else if (content.kind === 'progression') {
          for (const numeral of content.numerals) {
            const symbol = resolveNumeral(numeral, content.keyTonic, content.keyMode);
            expect(symbol, `${lesson.id} ${numeral}`).not.toBe('');
            expect(notesForChord(symbol).pitches.length, symbol).toBeGreaterThan(0);
          }
        } else {
          for (const open of content.strings) expect(midiOf(open), lesson.id).not.toBeNull();
        }
      }
    }
  });

  it('wires Djent to the 7- and 8-string presets', () => {
    const djent = GENRES.find((g) => g.id === 'djent');
    expect(djent).toBeDefined();
    const counts = new Set(djent!.tunings.map((t) => t.strings.length));
    expect(counts.has(7)).toBe(true);
    expect(counts.has(8)).toBe(true);
    for (const tuning of djent!.tunings) {
      const preset = findTuningPreset(tuning.strings);
      expect(preset, tuning.name).toBeDefined();
      expect(preset!.sources?.length, tuning.name).toBeGreaterThan(0);
    }
  });
});
