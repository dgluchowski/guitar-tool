import { useMemo, useState } from 'react';
import ChordView from './ChordView';
import ScaleView from './ScaleView';
import ProgressionPlayer from './ProgressionPlayer';
import { GENRES, getGenre, type Genre, type Lesson, type LessonContent } from '../data/genres';

interface Props {
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  /** Apply a tuning from a lesson/genre to the whole app. */
  onUseTuning: (strings: string[], name: string) => void;
}

export function Genres({ tuning, leftHanded, numFrets, onUseTuning }: Props) {
  const [genreId, setGenreId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  const genre = useMemo(() => (genreId ? getGenre(genreId) : undefined), [genreId]);
  const lesson = useMemo(
    () => (genre && lessonId ? genre.lessons.find((l) => l.id === lessonId) : undefined),
    [genre, lessonId],
  );

  if (!genre) {
    return <GenreList onSelect={(id) => { setGenreId(id); setLessonId(null); }} />;
  }

  if (lesson) {
    return (
      <LessonView
        genre={genre}
        lesson={lesson}
        tuning={tuning}
        leftHanded={leftHanded}
        numFrets={numFrets}
        onUseTuning={onUseTuning}
        onBack={() => setLessonId(null)}
      />
    );
  }

  return (
    <GenreDetail
      genre={genre}
      tuning={tuning}
      leftHanded={leftHanded}
      numFrets={numFrets}
      onUseTuning={onUseTuning}
      onOpenLesson={setLessonId}
      onBack={() => setGenreId(null)}
    />
  );
}

function UnverifiedBadge() {
  return (
    <span
      className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
      title="This content is placeholder and has not been fact-checked yet."
    >
      Unverified
    </span>
  );
}

function GenreList({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-500">
        Genre learning paths. Each path bundles relevant tunings, scales, voicings, progressions and
        bite-sized lessons.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            className="flex flex-col items-start gap-2 rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 text-left hover:border-violet-400 hover:shadow dark:border-stone-700 dark:bg-stone-800/50"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-lg font-semibold">{g.name}</span>
              {!g.verified && <UnverifiedBadge />}
            </div>
            <span className="text-sm text-stone-500">{g.blurb}</span>
            <span className="mt-1 text-xs text-stone-400">{g.lessons.length} lessons</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface DetailProps {
  genre: Genre;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  onUseTuning: (strings: string[], name: string) => void;
  onOpenLesson: (id: string) => void;
  onBack: () => void;
}

function GenreDetail({ genre, onUseTuning, onOpenLesson, onBack }: DetailProps) {
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="self-start text-sm text-violet-600 hover:underline dark:text-violet-400">
        ← All genres
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{genre.name}</h2>
        {!genre.verified && <UnverifiedBadge />}
      </div>
      <p className="text-sm text-stone-500">{genre.blurb}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Tunings">
          <ul className="flex flex-col gap-2">
            {genre.tunings.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{t.name}</span>{' '}
                  <span className="font-mono text-xs text-stone-400">{t.strings.join(' ')}</span>
                </span>
                <button
                  onClick={() => onUseTuning(t.strings, t.name)}
                  className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Scales">
          <ul className="flex flex-col gap-1 text-sm">
            {genre.scales.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{s.root}</span> <span className="capitalize">{s.scaleType}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Key voicings">
          <ul className="flex flex-wrap gap-2 text-sm">
            {genre.voicings.map((v, i) => (
              <li key={i} className="rounded bg-stone-100 px-2 py-1 dark:bg-stone-800">
                <span className="text-xs text-stone-400">{v.label}</span>{' '}
                <span className="font-mono font-medium">{v.chordSymbol}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Progressions">
          <ul className="flex flex-col gap-1 text-sm">
            {genre.progressions.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 font-mono text-xs text-stone-400">{p.numerals.join(' – ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 dark:border-stone-700 dark:bg-stone-800/50">
        <div className="mb-3 text-sm font-medium">Lessons</div>
        <ol className="flex flex-col gap-2">
          {genre.lessons.map((l, i) => (
            <li key={l.id}>
              <button
                onClick={() => onOpenLesson(l.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200/80 shadow-sm px-3 py-2 text-left hover:border-violet-400 dark:border-stone-700"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-stone-100 text-xs font-medium dark:bg-stone-800">
                  {i + 1}
                </span>
                <span className="font-medium">{l.title}</span>
                <span className="ml-auto text-xs uppercase text-stone-400">{l.content.kind}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

interface LessonProps {
  genre: Genre;
  lesson: Lesson;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  onUseTuning: (strings: string[], name: string) => void;
  onBack: () => void;
}

function LessonView({ genre, lesson, tuning, leftHanded, numFrets, onUseTuning, onBack }: LessonProps) {
  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="self-start text-sm text-violet-600 hover:underline dark:text-violet-400">
        ← {genre.name} lessons
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{lesson.title}</h2>
        {!genre.verified && <UnverifiedBadge />}
      </div>

      <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 dark:border-stone-700 dark:bg-stone-800/50">
        <p className="text-sm leading-relaxed">{lesson.explainer}</p>
        <div className="mt-3 rounded bg-stone-50 p-3 text-sm dark:bg-stone-800">
          <span className="font-medium">Practice: </span>
          {lesson.practice}
        </div>
      </div>

      <LessonContentView
        content={lesson.content}
        tuning={tuning}
        leftHanded={leftHanded}
        numFrets={numFrets}
        onUseTuning={onUseTuning}
      />
    </div>
  );
}

function LessonContentView({
  content,
  tuning,
  leftHanded,
  numFrets,
  onUseTuning,
}: {
  content: LessonContent;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  onUseTuning: (strings: string[], name: string) => void;
}) {
  switch (content.kind) {
    case 'chord':
      return <ChordView chordSymbol={content.chordSymbol} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />;
    case 'scale':
      return (
        <ScaleView
          root={content.root}
          scaleType={content.scaleType}
          tuning={tuning}
          leftHanded={leftHanded}
          numFrets={numFrets}
        />
      );
    case 'progression':
      return (
        <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 dark:border-stone-700 dark:bg-stone-800/50">
          <ProgressionPlayer numerals={content.numerals} keyTonic={content.keyTonic} keyMode={content.keyMode} />
        </div>
      );
    case 'tuning': {
      const active = tuning.join(',') === content.strings.join(',');
      return (
        <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 dark:border-stone-700 dark:bg-stone-800/50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">{content.name}</span>
            <span className="font-mono text-sm text-stone-400">{content.strings.join(' ')}</span>
            <button
              disabled={active}
              onClick={() => onUseTuning(content.strings, content.name)}
              className="rounded-lg shadow-sm transition-colors bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-default disabled:bg-stone-300 dark:disabled:bg-stone-700"
            >
              {active ? '✓ In use' : 'Use this tuning'}
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-400">
            Applying a tuning updates the fretboard everywhere in the app.
          </p>
        </div>
      );
    }
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-4 dark:border-stone-700 dark:bg-stone-800/50">
      <div className="mb-2 text-sm font-medium">{title}</div>
      {children}
    </div>
  );
}

export default Genres;
