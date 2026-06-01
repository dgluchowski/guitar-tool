import { useMemo } from 'react';
import { useMicPitch } from '../audio/useMicPitch';
import { midiOf } from '../music/notes';

interface Props {
  /** Current tuning's open-string notes, low → high (e.g. ["E2",...]). */
  tuning: string[];
}

/** |cents| within this band counts as "in tune". */
const IN_TUNE_CENTS = 5;

export function Tuner({ tuning }: Props) {
  // Boost the (often quiet) acoustic signal from an unplugged electric, accept
  // slightly lower clarity, and hold the last reading ~0.9s so a decaying note
  // doesn't make the readout flicker between the note and "listening".
  const { status, error, note, clarity, start, stop } = useMicPitch({
    minClarity: 0.85,
    holdMs: 900,
    gain: 5,
  });

  // Continuous MIDI of the detected pitch (note + cents fraction).
  const midiFloat = note ? note.midi + note.cents / 100 : null;

  // Find the nearest open string in the current tuning.
  const nearestString = useMemo(() => {
    if (midiFloat == null) return null;
    let best: { index: number; name: string; diff: number } | null = null;
    tuning.forEach((openNote, index) => {
      const m = midiOf(openNote);
      if (m == null) return;
      const diff = midiFloat - m; // semitones above the open string
      if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { index, name: openNote, diff };
    });
    return best as { index: number; name: string; diff: number } | null;
  }, [midiFloat, tuning]);

  const cents = note?.cents ?? 0;
  const inTune = note != null && Math.abs(cents) <= IN_TUNE_CENTS;
  // Needle position 0..100% across a -50..+50 cent scale.
  const needlePct = Math.max(0, Math.min(100, ((cents + 50) / 100) * 100));

  const listening = status === 'listening';

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
        <span className="text-sm text-stone-500">
          Play one string at a time. Audio stays on your device — nothing is uploaded.
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-stone-200/80 shadow-sm bg-white p-6 dark:border-stone-700 dark:bg-stone-800/50">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <div className={`text-6xl font-bold tabular-nums ${inTune ? 'text-green-500' : ''}`}>
              {note ? note.pc : '—'}
              {note && <span className="text-2xl text-stone-400">{note.octave}</span>}
            </div>
            <div className="mt-1 h-5 text-sm text-stone-500">
              {note ? `${cents > 0 ? '+' : ''}${cents} cents` : listening ? 'Listening…' : 'Mic off'}
            </div>
          </div>

          {/* Cents meter */}
          <div className="w-full max-w-md">
            <div className="relative h-10 rounded-full bg-stone-100 dark:bg-stone-800">
              {/* center in-tune zone */}
              <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-green-400/60" />
              {note && (
                <div
                  className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
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

          {/* Nearest-string guidance */}
          <div className="h-6 text-sm">
            {nearestString && note ? (
              inTune ? (
                <span className="font-medium text-green-600 dark:text-green-400">In tune ✓</span>
              ) : (
                <span className="text-stone-600 dark:text-stone-300">
                  Nearest string <span className="font-semibold">{nearestString.name}</span> —{' '}
                  {cents > 0 ? 'tune down ↓' : 'tune up ↑'}
                </span>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Open strings of current tuning, highlighting the nearest */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {tuning.map((s, i) => (
          <span
            key={i}
            className={`rounded-lg border px-3 py-2 font-mono text-sm ${
              nearestString?.index === i
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                : 'border-stone-200 dark:border-stone-700'
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      {listening && (
        <div className="text-center text-xs text-stone-400">signal clarity: {(clarity * 100).toFixed(0)}%</div>
      )}
    </div>
  );
}

export default Tuner;
