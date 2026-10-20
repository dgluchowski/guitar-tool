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
  const targetNote = targetIdx != null ? tuning[targetIdx] : null;

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
  const highlightIdx = targetIdx ?? nearestIdx;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {listening ? (
          <button onClick={stop} className="rounded-lg shadow-sm transition-colors bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            ■ Stop microphone
          </button>
        ) : (
          <button
            onClick={start}
            disabled={status === 'starting'}
            className="rounded-lg shadow-sm transition-colors bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:bg-stone-400"
          >
            {status === 'starting' ? 'Starting…' : '● Start microphone'}
          </button>
        )}
        <label className="flex items-center gap-2 text-sm" title="Boost a quiet input (e.g. an unplugged electric). Lower it if the reading jumps around.">
          Sensitivity
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
          />
          <span className="w-9 tabular-nums text-stone-500">{gain}×</span>
        </label>
      </div>
      <p className="text-sm text-stone-500">
        {targetNote
          ? `Locked to ${targetNote} — tune that string until the dot is centered and green.`
          : 'Pick a string below to lock onto it, or leave on Auto and play one string at a time. Audio stays on your device.'}
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-6 dark:border-stone-700 dark:bg-stone-800/50">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <div className={`text-6xl font-bold tabular-nums ${inTune ? 'text-green-500' : ''}`}>
              {bigPc}
              {bigOct && <span className="text-2xl text-stone-400">{bigOct}</span>}
            </div>
            <div className="mt-1 h-5 text-sm text-stone-500">
              {hasReading ? `${cents > 0 ? '+' : ''}${cents} cents` : listening ? 'Listening…' : 'Mic off'}
            </div>
          </div>

          {/* Cents meter */}
          <div className="w-full max-w-md">
            <div className="relative h-10 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
              {/* in-tune band (±5 cents) — dot is green exactly when it's inside this band */}
              <div className="absolute inset-y-0 bg-green-500/25" style={{ left: '45%', width: '10%' }} />
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-green-500/70" />
              {hasReading && (
                <div
                  className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ${
                    inTune ? 'bg-green-500' : 'bg-amber-500'
                  }`}
                  style={{ left: `${needlePct}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between text-xs text-stone-400">
              <span>♭ -50</span>
              <span>0</span>
              <span>+50 ♯</span>
            </div>
          </div>

          <div className="h-6 text-sm">
            {hasReading ? (
              inTune ? (
                <span className="font-medium text-green-600 dark:text-green-400">In tune ✓</span>
              ) : (
                <span className="text-stone-600 dark:text-stone-300">{cents > 0 ? 'Too sharp — tune down ↓' : 'Too flat — tune up ↑'}</span>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* String selector: Auto + one button per open string */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setTargetIdx(null)}
          aria-pressed={targetIdx == null}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            targetIdx == null
              ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
              : 'border-stone-200 text-stone-500 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800'
          }`}
        >
          Auto
        </button>
        {tuning.map((s, i) => {
          const selected = targetIdx === i;
          const nearest = targetIdx == null && highlightIdx === i;
          return (
            <button
              key={i}
              onClick={() => setTargetIdx(i)}
              aria-pressed={selected}
              className={`rounded-lg border px-3 py-2 font-mono text-sm transition-colors ${
                selected
                  ? `${inTune ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`
                  : nearest
                    ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-950/50'
                    : 'border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800'
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {listening && (
        <div className="text-center text-xs text-stone-400">signal clarity: {(clarity * 100).toFixed(0)}%</div>
      )}
    </div>
  );
}

export default Tuner;
