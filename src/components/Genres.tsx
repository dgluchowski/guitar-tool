import { useMemo, useState } from 'react';
import ChordView from './ChordView';
import ScaleView from './ScaleView';
import ProgressionPlayer from './ProgressionPlayer';
import { GENRES, getGenre, type Genre, type Lesson, type LessonContent } from '../data/genres';
import type { KeyMode } from '../utils/keys';

interface Props {
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  /** Apply a tuning from a lesson/genre to the whole app. */
  onUseTuning: (strings: string[], name: string) => void;
  /** Open a chord on the Explore fretboard. */
  onOpenChord: (symbol: string) => void;
  /** Open a scale on the Explore fretboard. */
  onOpenScale: (root: string, scaleType: string) => void;
  /** Load a Roman-numeral progression into the Progressions tab. */
  onOpenProgression: (numerals: string[], keyTonic: string, keyMode: KeyMode) => void;
}

export function Genres({
  tuning,
  leftHanded,
  numFrets,
  onUseTuning,
  onOpenChord,
  onOpenScale,
  onOpenProgression,
}: Props) {
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
      onUseTuning={onUseTuning}
      onOpenChord={onOpenChord}
      onOpenScale={onOpenScale}
      onOpenProgression={onOpenProgression}
      onOpenLesson={setLessonId}
      onBack={() => setGenreId(null)}
    />
  );
}

function UnverifiedBadge() {
  return (
    <span
      className="badge"
      title="These musical claims have not been checked against sources yet."
    >
      Unverified
    </span>
  );
}

function GenreList({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="stack">
      <p className="muted">
        Genre learning paths. Each path bundles relevant tunings, scales, voicings, progressions and
        bite-sized lessons.
      </p>
      <div className="card-grid">
        {GENRES.map((g) => (
          <button key={g.id} type="button" onClick={() => onSelect(g.id)} className="genre-card">
            <div className="row-between">
              <span className="title">{g.name}</span>
              {!g.verified && <UnverifiedBadge />}
            </div>
            <span className="muted">{g.blurb}</span>
            <span className="faint small">{g.lessons.length} lessons</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface DetailProps {
  genre: Genre;
  onUseTuning: (strings: string[], name: string) => void;
  onOpenChord: (symbol: string) => void;
  onOpenScale: (root: string, scaleType: string) => void;
  onOpenProgression: (numerals: string[], keyTonic: string, keyMode: KeyMode) => void;
  onOpenLesson: (id: string) => void;
  onBack: () => void;
}

function GenreDetail({
  genre,
  onUseTuning,
  onOpenChord,
  onOpenScale,
  onOpenProgression,
  onOpenLesson,
  onBack,
}: DetailProps) {
  return (
    <div className="stack">
      <button type="button" onClick={onBack} className="link">
        ← All genres
      </button>

      <div className="toolbar">
        <h2 className="title-xl">{genre.name}</h2>
        {!genre.verified && <UnverifiedBadge />}
      </div>
      <p className="muted">{genre.blurb}</p>

      <div className="card-grid">
        <Card title="Tunings">
          <ul className="list">
            {genre.tunings.map((t) => (
              <li key={t.name} className="row-between">
                <span>
                  <span className="strong">{t.name}</span>{' '}
                  <span className="mono faint small">{t.strings.join(' ')}</span>
                </span>
                <button type="button" onClick={() => onUseTuning(t.strings, t.name)} className="btn btn-sm">
                  Use
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Scales">
          <ul className="list">
            {genre.scales.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="link"
                  onClick={() => onOpenScale(s.root, s.scaleType)}
                >
                  <span className="strong">{s.root}</span> <span className="capitalize">{s.scaleType}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Key voicings">
          <div className="chip-row">
            {genre.voicings.map((v, i) => (
              <button key={i} type="button" className="chip" onClick={() => onOpenChord(v.chordSymbol)}>
                <span className="faint small">{v.label}</span>
                <span className="mono strong">{v.chordSymbol}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Sources">
          <ul className="list">
            {genre.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer" className="link">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Progressions">
          <div className="stack-sm">
            {genre.progressions.map((p, i) => (
              <button
                key={i}
                type="button"
                className="lesson-row"
                onClick={() => onOpenProgression(p.numerals, p.keyTonic, p.keyMode)}
              >
                <span className="strong">{p.name}</span>
                <span className="mono faint small">{p.numerals.join(' – ')}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="panel">
        <div className="panel-title">Lessons</div>
        <ol className="list">
          {genre.lessons.map((l, i) => (
            <li key={l.id}>
              <button type="button" onClick={() => onOpenLesson(l.id)} className="lesson-row">
                <span className="lesson-index">{i + 1}</span>
                <span className="strong">{l.title}</span>
                <span className="lesson-kind">{l.content.kind}</span>
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
    <div className="stack">
      <button type="button" onClick={onBack} className="link">
        ← {genre.name} lessons
      </button>

      <div className="toolbar">
        <h2 className="title-xl">{lesson.title}</h2>
        {!genre.verified && <UnverifiedBadge />}
      </div>

      <div className="panel">
        <p className="prose">{lesson.explainer}</p>
        <div className="practice-box">
          <span className="strong">Practice: </span>
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
        <ProgressionLesson
          content={content}
          tuning={tuning}
          leftHanded={leftHanded}
          numFrets={numFrets}
        />
      );
    case 'tuning': {
      const active = tuning.join(',') === content.strings.join(',');
      return (
        <div className="panel">
          <div className="toolbar">
            <span className="strong">{content.name}</span>
            <span className="mono faint">{content.strings.join(' ')}</span>
            <button
              type="button"
              disabled={active}
              onClick={() => onUseTuning(content.strings, content.name)}
              className="btn btn-primary"
            >
              {active ? '✓ In use' : 'Use this tuning'}
            </button>
          </div>
          <p className="hint">Applying a tuning updates the fretboard everywhere in the app.</p>
        </div>
      );
    }
  }
}

function ProgressionLesson({
  content,
  tuning,
  leftHanded,
  numFrets,
}: {
  content: Extract<LessonContent, { kind: 'progression' }>;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}) {
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  return (
    <div className="stack">
      <div className="panel">
        <ProgressionPlayer
          numerals={content.numerals}
          keyTonic={content.keyTonic}
          keyMode={content.keyMode}
          onSelectChord={setSelectedChord}
        />
      </div>
      {selectedChord && (
        <ChordView chordSymbol={selectedChord} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {children}
    </div>
  );
}

export default Genres;
