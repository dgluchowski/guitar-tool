import { useCallback, useEffect, useRef, useState } from 'react';
import Fretboard, { type HighlightMap } from './Fretboard';
import { useMicPitch } from '../hooks/useMicPitch';
import { samePitchClass } from '../utils/notes';

interface Props {
  /** Current tuning's open-string notes, used for the optional fretboard hint. */
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Consecutive matching frames required to count a note as "played". */
const CONFIRM_FRAMES = 3;
/** Cents tolerance — generous so beginners aren't blocked by intonation. */
const CENTS_TOLERANCE = 40;
const BEST_KEY = 'gt-trainer-best';

function readBest(key: string): number {
  const n = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickNext(pool: string[], current: string | null): string {
  const choices = pool.filter((n) => n !== current);
  return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
}

export function NoteTrainer({ tuning, leftHanded, numFrets }: Props) {
  const [naturalsOnly, setNaturalsOnly] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => readBest(BEST_KEY));
  const [flash, setFlash] = useState(false);

  const matchFramesRef = useRef(0);
  const lockedRef = useRef(false);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPending = () => {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
  };

  // Boost quiet sources and accept slightly lower clarity, matching the tuner.
  const { status, error, note, start, stop } = useMicPitch({ minClarity: 0.85, gain: 5 });
  const listening = status === 'listening';
  const pool = naturalsOnly ? NATURALS : CHROMATIC;

  const advance = useCallback(() => {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
    matchFramesRef.current = 0;
    lockedRef.current = false;
    setTarget((cur) => pickNext(pool, cur));
  }, [pool]);

  const begin = () => {
    clearPending();
    setScore(0);
    setStreak(0);
    setTarget(pickNext(pool, null));
    matchFramesRef.current = 0;
    lockedRef.current = false;
    start();
  };

  const end = () => {
    clearPending();
    stop();
    setTarget(null);
  };

  useEffect(
    () => () => {
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];
    },
    [],
  );

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
        pendingTimers.current.push(setTimeout(() => setFlash(false), 450));
        pendingTimers.current.push(setTimeout(advance, 650));
      }
    } else if (note && !samePitchClass(note.pc, target)) {
      matchFramesRef.current = 0;
    }
  }, [note, listening, target, advance]);

  if (streak > best) setBest(streak);

  useEffect(() => {
    localStorage.setItem(BEST_KEY, String(best));
  }, [best]);

  const skip = () => {
    setStreak(0);
    advance();
  };

  return (
    <div className="stack">
      <div className="toolbar">
        {listening ? (
          <button type="button" onClick={end} className="btn btn-danger">
            ■ End session
          </button>
        ) : (
          <button type="button" onClick={begin} disabled={status === 'starting'} className="btn btn-primary">
            {status === 'starting' ? 'Starting…' : '▶ Start session'}
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={naturalsOnly}
            disabled={listening}
            onChange={(e) => setNaturalsOnly(e.target.checked)}
          />
          Naturals only (no sharps/flats)
        </label>
        <label className="check" title="New to guitar? Show where the target note is on the fretboard.">
          <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} />
          Show fretboard hint
        </label>
      </div>

      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}

      <div className="stat-grid">
        <Stat label="Score" value={score} />
        <Stat label="Streak" value={streak} />
        <Stat label="Best streak" value={best} />
      </div>

      <div className={flash ? 'panel hero-card is-correct' : 'panel hero-card'}>
        {target ? (
          <>
            <div className="muted">Play this note (any octave)</div>
            <div className="hero-note">{target}</div>
            <div style={{ minHeight: '1.5rem' }}>
              {flash ? (
                <span className="ok-text">Correct! ✓</span>
              ) : note ? (
                <span className="faint">
                  heard {note.pc}
                  {note.octave}…
                </span>
              ) : (
                <span className="faint">listening…</span>
              )}
            </div>
          </>
        ) : (
          <div className="muted">
            Press <span className="strong">Start session</span> and play the note shown. Audio stays on your
            device.
          </div>
        )}
      </div>

      {listening && target && (
        <button type="button" onClick={skip} className="btn" style={{ alignSelf: 'center' }}>
          Skip ↦ (resets streak)
        </button>
      )}

      {showHint && target && (
        <div className="panel">
          <div className="hint hint-flush" style={{ marginBottom: 'var(--space-3)' }}>
            Every <span className="strong" style={{ color: 'var(--accent-text)' }}>{target}</span> on the
            fretboard — play any one of them.
          </div>
          <Fretboard
            tuning={tuning}
            numFrets={numFrets}
            fretRange={[0, numFrets]}
            leftHanded={leftHanded}
            showAllNotes={false}
            highlightedNotes={{ [target]: { color: '#F0E442', label: target } } as HighlightMap}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default NoteTrainer;
