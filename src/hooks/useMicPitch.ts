import { useCallback, useEffect, useRef, useState } from 'react';
import { startPitchListener, type PitchListener } from '../utils/pitch';
import { frequencyToNote, type DetectedNote } from '../utils/notes';

/** How many recent frames to median-filter, to reject single-frame octave/noise spikes. */
const MEDIAN_WINDOW = 5;

export type MicStatus = 'idle' | 'starting' | 'listening' | 'error';

export interface MicPitchState {
  status: MicStatus;
  error: string | null;
  /** Latest confidently-detected note, or null when nothing clear is heard. */
  note: DetectedNote | null;
  /** Raw clarity 0..1 of the most recent frame. */
  clarity: number;
  start: () => void;
  stop: () => void;
}

interface Options {
  /** Minimum clarity to treat a reading as a real note. */
  minClarity?: number;
  /** Ignore frequencies outside a guitar-plausible band (Hz). */
  minFreq?: number;
  maxFreq?: number;
  /**
   * Keep displaying the last good note for this many ms after detection drops
   * out. Smooths over the natural clarity dip as a plucked note decays so the
   * readout doesn't flicker. 0 = clear immediately.
   */
  holdMs?: number;
  /** Linear gain applied to the mic signal (boost quiet sources). */
  gain?: number;
}

/**
 * React hook for monophonic mic pitch detection. Manages permission/lifecycle
 * and exposes the latest detected note. Always cleans up the mic on unmount.
 */
export function useMicPitch(options: Options = {}): MicPitchState {
  const { minClarity = 0.9, minFreq = 60, maxFreq = 1200, holdMs = 0, gain = 1 } = options;
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<DetectedNote | null>(null);
  const [clarity, setClarity] = useState(0);
  const listenerRef = useRef<PitchListener | null>(null);
  const lastGoodAtRef = useRef(0);
  const recentFreqRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    recentFreqRef.current = [];
    setStatus('idle');
    setNote(null);
    setClarity(0);
  }, []);

  const start = useCallback(() => {
    if (listenerRef.current) return;
    setStatus('starting');
    setError(null);
    startPitchListener({
      gain,
      onReading: ({ frequency, clarity }) => {
        setClarity(clarity);
        if (clarity >= minClarity && frequency >= minFreq && frequency <= maxFreq) {
          lastGoodAtRef.current = performance.now();
          // Median-filter the last few readings so a single bad frame (an octave
          // jump or a noise spike) can't yank the displayed note around.
          const buf = recentFreqRef.current;
          buf.push(frequency);
          if (buf.length > MEDIAN_WINDOW) buf.shift();
          const sorted = [...buf].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          setNote(frequencyToNote(median));
        } else if (performance.now() - lastGoodAtRef.current >= holdMs) {
          // Only clear once the hold window since the last good reading has passed.
          recentFreqRef.current = [];
          setNote(null);
        }
        // Within the hold window we leave the previous note in place (no setNote),
        // so its object identity is unchanged and dependent effects don't re-run.
      },
    })
      .then((listener) => {
        listenerRef.current = listener;
        setStatus('listening');
      })
      .catch((err: unknown) => {
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access was denied. Allow mic access in your browser to use this feature.'
            : err instanceof Error
              ? err.message
              : 'Could not start the microphone.';
        setError(message);
        setStatus('error');
      });
  }, [minClarity, minFreq, maxFreq, holdMs]);

  // Apply gain changes live (e.g. from a slider) without restarting the mic.
  useEffect(() => {
    listenerRef.current?.setGain(gain);
  }, [gain]);

  // Clean up on unmount.
  useEffect(() => () => listenerRef.current?.stop(), []);

  return { status, error, note, clarity, start, stop };
}
