import { useMemo, useState } from 'react';
import { useMicPitch } from '../hooks/useMicPitch';
import { midiOf, noteToFrequency } from '../utils/notes';

interface Props {
  /** Current tuning's open-string notes, low → high (e.g. ["E2",...]). */
  tuning: string[];
}

/** |cents| within this band counts as "in tune". */
const IN_TUNE_CENTS = 5;

const pcOf = (note: string) => note.replace(/-?\d+$/, '');
const octOf = (note: string) => note.match(/-?\d+$/)?.[0] ?? '';

export function Tuner({ tuning }: Props) {
  const [gain, setGain] = useState(3);
  // null = auto-detect; otherwise the index of the string we're locked onto.
  const [targetIdx, setTargetIdx] = useState<number | null>(null);

  // Boost the (often quiet) signal from an unplugged electric and hold the last
  // reading ~0.9s so a decaying note doesn't make the readout flicker.
  const { status, error, note, clarity, start, stop } = useMicPitch({
    minClarity: 0.9,
    holdMs: 900,
    gain,
  });

  const listening = status === 'listening';
  // A lock from a 7- or 8-string tuning must not point past a shorter tuning.
  const lockedIdx = targetIdx != null && targetIdx < tuning.length ? targetIdx : null;
  const targetNote = lockedIdx != null ? tuning[lockedIdx] : null;

  // Continuous MIDI of the detected pitch (auto mode nearest-string search).
  const midiFloat = note ? note.midi + note.cents / 100 : null;
  const nearestIdx = useMemo(() => {
    if (midiFloat == null) return null;
    let best: { index: number; diff: number } | null = null;
    tuning.forEach((openNote, index) => {
      const m = midiOf(openNote);
      if (m == null) return;
      const diff = midiFloat - m;
      if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { index, diff };
    });
    return best ? (best as { index: number }).index : null;
  }, [midiFloat, tuning]);

  // Work out what to display and how far off (cents).
  let bigPc = '—';
  let bigOct = '';
  let cents = 0;
  let hasReading = false;

  if (targetNote) {
    // Locked: always compare to this one string, folding octave errors away so
    // the reading stays stable on that note instead of jumping around.
    bigPc = pcOf(targetNote);
    bigOct = octOf(targetNote);
    const tf = noteToFrequency(targetNote);
    if (note && tf) {
      let semis = 12 * Math.log2(note.freq / tf);
      semis -= 12 * Math.round(semis / 12); // fold to nearest octave → [-6, +6] semitones
      cents = Math.round(semis * 100);
      hasReading = true;
    }
  } else if (note) {
    bigPc = note.pc;
    bigOct = String(note.octave);
    cents = note.cents;
    hasReading = true;
  }

  const inTune = hasReading && Math.abs(cents) <= IN_TUNE_CENTS;
  const needlePct = Math.max(0, Math.min(100, ((cents + 50) / 100) * 100));
  const highlightIdx = lockedIdx ?? nearestIdx;

  return (
    <div className="stack">
      <div className="toolbar">
        {listening ? (
          <button type="button" onClick={stop} className="btn btn-danger">
            ■ Stop microphone
          </button>
        ) : (
          <button type="button" onClick={start} disabled={status === 'starting'} className="btn btn-primary">
            {status === 'starting' ? 'Starting…' : '● Start microphone'}
          </button>
        )}
        <label className="field-inline" title="Boost a quiet input (e.g. an unplugged electric). Lower it if the reading jumps around.">
          Sensitivity
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
          />
          <span className="mono bpm">{gain}×</span>
        </label>
      </div>
      <p className="muted">
        {targetNote
          ? `Locked to ${targetNote} — tune that string until the dot is centered and green.`
          : 'Pick a string below to lock onto it, or leave on Auto and play one string at a time. Audio stays on your device.'}
      </p>

      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}

      <div className="panel">
        <div className="center">
          <div>
            <div className={inTune ? 'hero-note ok-text' : 'hero-note'}>
              {bigPc}
              {bigOct && <span className="faint" style={{ fontSize: '0.42em' }}>{bigOct}</span>}
            </div>
            <div className="muted" style={{ minHeight: '1.25rem' }}>
              {hasReading ? `${cents > 0 ? '+' : ''}${cents} cents` : listening ? 'Listening…' : 'Mic off'}
            </div>
          </div>

          {/* Cents meter */}
          <div style={{ width: 'min(100%, 28rem)' }}>
            <div className="meter">
              {/* in-tune band (±5 cents) — dot is green exactly when it's inside this band */}
              <div className="meter-band" />
              <div className="meter-center" />
              {hasReading && (
                <div className={inTune ? 'meter-dot is-ok' : 'meter-dot is-off'} style={{ left: `${needlePct}%` }} />
              )}
            </div>
            <div className="meter-scale">
              <span>♭ -50</span>
              <span>0</span>
              <span>+50 ♯</span>
            </div>
          </div>

          <div style={{ minHeight: '1.5rem' }}>
            {hasReading ? (
              inTune ? (
                <span className="ok-text">In tune ✓</span>
              ) : (
                <span>{cents > 0 ? 'Too sharp — tune down ↓' : 'Too flat — tune up ↑'}</span>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* String selector: Auto + one button per open string */}
      <div className="chip-row" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setTargetIdx(null)}
          aria-pressed={lockedIdx == null}
          className="chip"
        >
          Auto
        </button>
        {tuning.map((s, i) => {
          const selected = lockedIdx === i;
          const nearest = lockedIdx == null && highlightIdx === i;
          const tone = selected && inTune ? ' is-correct' : nearest ? ' is-near' : '';
          return (
            <button
              key={i}
              type="button"
              onClick={() => setTargetIdx(i)}
              aria-pressed={selected}
              className={`chip mono${tone}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {listening && (
        <div className="hint" style={{ textAlign: 'center' }}>
          signal clarity: {(clarity * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

export default Tuner;
