import { Note } from 'tonal';

/** Human-readable text for a tuning, low → high, e.g. "E2 A2 D3 G3 B3 E4". */
export function tuningToText(tuning: string[]): string {
  return tuning.join(' ');
}

/**
 * Parse exported tuning text back into note names. Accepts space- or
 * comma-separated note names (with octave), e.g. "D2, G2, C3 F3 A3 D4".
 * Returns null if it isn't at least two valid notes.
 */
export function parseTuningText(text: string): string[] | null {
  const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const notes: string[] = [];
  for (const tok of tokens) {
    const midi = Note.midi(tok);
    if (midi == null) return null; // must be a real note *with* an octave
    notes.push(Note.fromMidi(midi)); // normalise spelling/octave (e.g. "Gb3" → "F#3")
  }
  return notes;
}
