import { useCallback, useEffect, useRef, useState } from 'react';
import Fretboard, { type HighlightMap } from './Fretboard';
import { useMicPitch } from '../audio/useMicPitch';
import { samePitchClass } from '../music/notes';

interface Props {
  /** Current tuning's open-string notes, used for the optional fretboard hint. */
  tuning: string[];
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Consecutive matching frames required to count a note as "played". */
const CONFIRM_FRAMES = 3;
/** Cents tolerance — generous so beginners aren't blocked by intonation. */
const CENTS_TOLERANCE = 40;
const BEST_KEY = 'gt-trainer-best';

function pickNext(pool: string[], current: string | null): string {
  const choices = pool.filter((n) => n !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
}

export function NoteTrainer({ tuning }: Props) {
  const [naturalsOnly, setNaturalsOnly] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0));
  const [flash, setFlash] = useState(false);

  const matchFramesRef = useRef(0);
  const lockedRef = useRef(false);

  // Boost quiet sources and accept slightly lower clarity, matching the tuner.
  const { status, error, note, start, stop } = useMicPitch({ minClarity: 0.85, gain: 5 });
  const listening = status === 'listening';
  const pool = naturalsOnly ? NATURALS : CHROMATIC;

  const advance = useCallback(() => {
    matchFramesRef.current = 0;
    lockedRef.current = false;
    setTarget((cur) => pickNext(pool, cur));
  }, [pool]);

  const begin = () => {
    setScore(0);
    setStreak(0);
    setTarget(pickNext(pool, null));
    matchFramesRef.current = 0;
    lockedRef.current = false;
    start();
  };

  const end = () => {
    stop();
    setTarget(null);
  };

  // Evaluate each detected-note frame against the target.
  useEffect(() => {
    if (!listening || !target || lockedRef.current) return;
    if (note && samePitchClass(note.pc, target) && Math.abs(note.cents) <= CENTS_TOLERANCE) {
      matchFramesRef.current += 1;
      if (matchFramesRef.current >= CONFIRM_FRAMES) {
        lockedRef.current = true;
        setScore((s) => s + 1);
        setStreak((st) => st + 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 450);
        setTimeout(advance, 650);
      }
    } else if (note && !samePitchClass(note.pc, target)) {
      matchFramesRef.current = 0;
    }
  }, [note, listening, target, advance]);

  // Persist the best streak whenever the current streak exceeds it.
  useEffect(() => {
    if (streak > best) {
      setBest(streak);
      localStorage.setItem(BEST_KEY, String(streak));
    }
  }, [streak, best]);

  const skip = () => {
    setStreak(0);
    advance();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {listening ? (
          <button onClick={end} className="rounded-lg shadow-sm transition-colors bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            ■ End session
          </button>
        ) : (
          <button
            onClick={begin}
            disabled={status === 'starting'}
            className="rounded-lg shadow-sm transition-colors bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-stone-400"
          >
            {status === 'starting' ? 'Starting…' : '▶ Start session'}
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={naturalsOnly}
            disabled={listening}
            onChange={(e) => setNaturalsOnly(e.target.checked)}
          />
          Naturals only (no sharps/flats)
        </label>
        <label className="flex items-center gap-2 text-sm" title="New to guitar? Show where the target note is on the fretboard.">
          <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} />
          Show fretboard hint
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Score" value={score} />
        <Stat label="Streak" value={streak} />
        <Stat label="Best streak" value={best} />
      </div>

      <div
        className={`rounded-lg border p-8 text-center transition-colors ${
          flash
            ? 'border-green-500 bg-green-50 dark:bg-green-950'
            : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800/50'
        }`}
      >
        {target ? (
          <>
            <div className="text-sm text-stone-500">Play this note (any octave)</div>
            <div className="my-2 text-7xl font-bold">{target}</div>
            <div className="h-6 text-sm">
              {flash ? (
                <span className="font-semibold text-green-600 dark:text-green-400">Correct! ✓</span>
              ) : note ? (
                <span className="text-stone-400">heard {note.pc}{note.octave}…</span>
              ) : (
                <span className="text-stone-400">listening…</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-stone-500">
            Press <span className="font-medium">Start session</span> and play the note shown. Audio stays on your
            device.
          </div>
        )}
      </div>

      {listening && target && (
        <button
          onClick={skip}
          className="self-center rounded border border-stone-300 px-4 py-1 text-sm text-stone-500 hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
        >
          Skip ↦ (resets streak)
        </button>
      )}

      {showHint && target && (
        <div className="rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
          <div className="mb-2 text-sm text-stone-500">
            Every <span className="font-semibold text-violet-600 dark:text-violet-400">{target}</span> on the
            fretboard — play any one of them.
          </div>
          <Fretboard
            tuning={tuning}
            numFrets={12}
            fretRange={[0, 12]}
            showAllNotes={false}
            highlightedNotes={{ [target]: { color: '#8b5cf6', label: target } } as HighlightMap}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-3 dark:border-stone-700 dark:bg-stone-800/50">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  );
}

export default NoteTrainer;
