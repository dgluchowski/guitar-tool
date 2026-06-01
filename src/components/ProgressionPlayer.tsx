import { useEffect, useMemo, useState } from 'react';
import { resolveProgression, type KeyMode } from '../music/keys';
import { notesForChord, voicePitchClasses } from '../music/engine';
import { playProgression, stopAll } from '../music/audio';

interface Props {
  numerals: string[];
  keyTonic: string;
  keyMode: KeyMode;
  /** Called when the user clicks a chord chip (or playback advances). */
  onSelectChord?: (symbol: string) => void;
  beatsPerChord?: number;
}

/**
 * Compact, self-contained progression player: resolves Roman numerals to chords
 * in a key, shows clickable chord chips, and plays them with a tempo control.
 * Reused by the Progressions tab presets and by genre lessons.
 */
export function ProgressionPlayer({
  numerals,
  keyTonic,
  keyMode,
  onSelectChord,
  beatsPerChord = 4,
}: Props) {
  const [bpm, setBpm] = useState(90);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const chords = useMemo(
    () => resolveProgression(numerals, keyTonic, keyMode),
    [numerals, keyTonic, keyMode],
  );

  // Stop audio if the progression changes or the component unmounts.
  useEffect(() => {
    return () => stopAll();
  }, []);
  useEffect(() => {
    stopAll();
    setIsPlaying(false);
    setPlayingIndex(-1);
  }, [numerals, keyTonic, keyMode]);

  const play = async () => {
    const steps = chords.map((c) => {
      const set = notesForChord(c);
      return { notes: set.pitches.length ? voicePitchClasses(set.pitches.map((p) => p.pc)) : [] };
    });
    setIsPlaying(true);
    await playProgression(steps, {
      bpm,
      beatsPerChord,
      onStep: (i) => {
        setPlayingIndex(i);
        if (i === -1) setIsPlaying(false);
        else onSelectChord?.(chords[i]);
      },
    });
  };

  const stop = () => {
    stopAll();
    setIsPlaying(false);
    setPlayingIndex(-1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {isPlaying ? (
          <button onClick={stop} className="rounded-lg shadow-sm transition-colors bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700">
            ■ Stop
          </button>
        ) : (
          <button onClick={play} className="rounded-lg shadow-sm transition-colors bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700">
            ▶ Play
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          Tempo
          <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <span className="w-12 tabular-nums">{bpm} bpm</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {numerals.map((rn, i) => (
          <button
            key={i}
            onClick={() => onSelectChord?.(chords[i])}
            className={`flex flex-col items-center rounded-lg border px-3 py-2 ${
              playingIndex === i
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <span className="font-mono text-xs text-stone-400">{rn}</span>
            <span className="font-medium text-violet-600 dark:text-violet-400">{chords[i] || '?'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProgressionPlayer;
