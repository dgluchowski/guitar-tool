import type { KeyMode } from '../music/keys';
import data from './genres.json';

/** A tuning suggested for a genre (low → high string pitches, e.g. ["E2",...]). */
export interface GenreTuning {
  name: string;
  strings: string[];
}

export interface GenreScale {
  root: string;
  scaleType: string;
}

export interface GenreVoicing {
  /** Display label, e.g. "I7" or "IV5". */
  label: string;
  chordSymbol: string;
}

export interface GenreProgression {
  name: string;
  numerals: string[];
  keyTonic: string;
  keyMode: KeyMode;
}

/** Discriminated union describing what a lesson puts on screen. */
export type LessonContent =
  | { kind: 'chord'; chordSymbol: string }
  | { kind: 'scale'; root: string; scaleType: string }
  | { kind: 'progression'; numerals: string[]; keyTonic: string; keyMode: KeyMode }
  | { kind: 'tuning'; name: string; strings: string[] };

export interface Lesson {
  id: string;
  title: string;
  explainer: string;
  practice: string;
  content: LessonContent;
}

export interface Genre {
  id: string;
  name: string;
  blurb: string;
  /** Whether a human has fact-checked this genre's content. */
  verified: boolean;
  tunings: GenreTuning[];
  scales: GenreScale[];
  voicings: GenreVoicing[];
  progressions: GenreProgression[];
  lessons: Lesson[];
}

/** All genres, typed. Content is authored in genres.json for easy review/editing. */
export const GENRES: Genre[] = (data as { genres: Genre[] }).genres;

/** Look up a single genre by id. */
export function getGenre(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}
