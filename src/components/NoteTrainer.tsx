import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fretboard, { type CellMarker } from './Fretboard';
import { useMicPitch } from '../hooks/useMicPitch';
import { pitchClassAtFret, pitchClassesInWindow, samePitchClass } from '../utils/notes';

interface Props {
  /** Current tuning's open-string notes, used for the optional fretboard hint. */
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

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
  const [tapMode, setTapMode] = useState(false);
  const [stringFrom, setStringFrom] = useState(1);
  const [stringTo, setStringTo] = useState(() => tuning.length);
  const [fretFrom, setFretFrom] = useState(0);
  const [fretTo, setFretTo] = useState(numFrets);
  const [tapped, setTapped] = useState<string | null>(null);
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
  const stringLo = Math.min(stringFrom, stringTo, tuning.length) - 1;
  const stringHi = Math.min(Math.max(stringFrom, stringTo), tuning.length) - 1;
  const fretLo = Math.min(fretFrom, fretTo, numFrets);
  const fretHi = Math.min(Math.max(fretFrom, fretTo), numFrets);
  const pool = useMemo(
    () =>
      pitchClassesInWindow(
        tuning,
        [Math.max(0, stringLo), Math.max(0, stringHi)],
        [fretLo, fretHi],
        naturalsOnly,
      ),
    [fretHi, fretLo, naturalsOnly, stringHi, stringLo, tuning],
  );

  const advance = useCallback(() => {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
    matchFramesRef.current = 0;
    lockedRef.current = false;
    setTarget((cur) => pickNext(pool, cur));
  }, [pool]);

  const begin = () => {
    if (!pool.length) return;
    clearPending();
    setScore(0);
    setStreak(0);
    setTapped(null);
    setTarget(pickNext(pool, null));
    matchFramesRef.current = 0;
    lockedRef.current = false;
    if (!tapMode) start();
  };

  const end = () => {
    clearPending();
    stop();
    setTapped(null);
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
    if (tapMode || !listening || !target || lockedRef.current) return;
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
  }, [note, listening, tapMode, target, advance]);

  if (streak > best) setBest(streak);

  useEffect(() => {
    localStorage.setItem(BEST_KEY, String(best));
  }, [best]);

  const skip = () => {
    setStreak(0);
    setTapped(null);
    advance();
  };

  const inWindow = (stringIndex: number, fret: number) =>
    stringIndex >= stringLo && stringIndex <= stringHi && fret >= fretLo && fret <= fretHi;

  const answerPositions: CellMarker[] = [];
  if (target) {
    for (let s = Math.max(0, stringLo); s <= stringHi && s < tuning.length; s++) {
      for (let f = fretLo; f <= fretHi; f++) {
        if (samePitchClass(pitchClassAtFret(tuning[s], f), target)) {
          answerPositions.push({ string: s, fret: f, color: '#F0E442', label: target });
        }
      }
    }
  }
  const outsideStrings = tuning.map((_, i) => i).filter((i) => i < stringLo || i > stringHi);

  const onTap = (stringIndex: number, fret: number) => {
    if (!tapMode || !target || lockedRef.current || !inWindow(stringIndex, fret)) return;
    const pc = pitchClassAtFret(tuning[stringIndex], fret);
    if (samePitchClass(pc, target)) {
      lockedRef.current = true;
      setTapped(null);
      setScore((s) => s + 1);
      setStreak((st) => st + 1);
      setFlash(true);
      pendingTimers.current.push(setTimeout(() => setFlash(false), 450));
      pendingTimers.current.push(setTimeout(advance, 650));
    } else {
      setTapped(pc);
    }
  };

  const sessionOn = tapMode ? target != null : listening;

  return (
    <div className="stack">
      <div className="toolbar">
        {sessionOn ? (
          <button type="button" onClick={end} className="btn btn-danger">
            ■ End session
          </button>
        ) : (
          <button type="button" onClick={begin} disabled={status === 'starting' || pool.length === 0} className="btn btn-primary">
            {status === 'starting' ? 'Starting…' : '▶ Start session'}
          </button>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={naturalsOnly}
            disabled={sessionOn}
            onChange={(e) => setNaturalsOnly(e.target.checked)}
          />
          Naturals only (no sharps/flats)
        </label>
        <label className="check" title="Find the note by clicking the fretboard instead of playing it.">
          <input
            type="checkbox"
            checked={tapMode}
            disabled={sessionOn}
            onChange={(e) => setTapMode(e.target.checked)}
          />
          Tap the fretboard
        </label>
        <label className="check" title="New to guitar? Show where the target note is on the fretboard.">
          <input type="checkbox" checked={showHint} onChange={(e) => setShowHint(e.target.checked)} />
          Show fretboard hint
        </label>
      </div>

      <div className="control-row">
        <label className="field">
          Low string
          <select
            value={Math.min(stringFrom, tuning.length)}
            disabled={sessionOn}
            onChange={(e) => setStringFrom(Number(e.target.value))}
            className="control"
            aria-label="First string in the drill, 1 is lowest"
          >
            {tuning.map((open, i) => (
              <option key={open + i} value={i + 1}>
                {i + 1} · {open}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          High string
          <select
            value={Math.min(stringTo, tuning.length)}
            disabled={sessionOn}
            onChange={(e) => setStringTo(Number(e.target.value))}
            className="control"
            aria-label="Last string in the drill, 1 is lowest"
          >
            {tuning.map((open, i) => (
              <option key={open + i} value={i + 1}>
                {i + 1} · {open}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Fret from
          <input
            type="number"
            min={0}
            max={numFrets}
            value={Math.min(fretFrom, numFrets)}
            disabled={sessionOn}
            onChange={(e) => setFretFrom(Math.max(0, Math.min(numFrets, Number(e.target.value))))}
            className="control"
            aria-label="Lowest fret in the drill"
          />
        </label>
        <label className="field">
          Fret to
          <input
            type="number"
            min={0}
            max={numFrets}
            value={Math.min(fretTo, numFrets)}
            disabled={sessionOn}
            onChange={(e) => setFretTo(Math.max(0, Math.min(numFrets, Number(e.target.value))))}
            className="control"
            aria-label="Highest fret in the drill"
          />
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
            <div className="muted">{tapMode ? 'Tap this note inside the window' : 'Play this note (any octave)'}</div>
            <div className="hero-note">{target}</div>
            <div style={{ minHeight: '1.5rem' }}>
              {flash ? (
                <span className="ok-text">Correct! ✓</span>
              ) : tapMode && tapped ? (
                <span className="faint">that’s {tapped}</span>
              ) : note && !tapMode ? (
                <span className="faint">
                  heard {note.pc}
                  {note.octave}…
                </span>
              ) : (
                <span className="faint">{tapMode ? 'tap a fret…' : 'listening…'}</span>
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

      {sessionOn && target && (
        <button type="button" onClick={skip} className="btn" style={{ alignSelf: 'center' }}>
          Skip ↦ (resets streak)
        </button>
      )}

      {(tapMode || showHint) && target && (
        <div className="panel">
          <div className="hint hint-flush" style={{ marginBottom: 'var(--space-3)' }}>
            {tapMode
              ? 'Tap the fret you think holds the note. Strings outside the drill are muted.'
              : 'Where the note sits inside the drill window.'}
            {showHint ? ' Highlighted frets are the answer.' : ''}
          </div>
          <Fretboard
            tuning={tuning}
            numFrets={numFrets}
            fretRange={[fretLo, Math.min(fretHi, numFrets)]}
            leftHanded={leftHanded}
            showAllNotes={false}
            positions={showHint ? answerPositions : undefined}
            mutedStrings={outsideStrings}
            onCellClick={tapMode ? (stringIndex, fret) => onTap(stringIndex, fret) : undefined}
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
