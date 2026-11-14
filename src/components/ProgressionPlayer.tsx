import { useEffect, useMemo, useState } from 'react';
import { resolveProgression, type KeyMode } from '../utils/keys';
import { notesForChord, voicePitchClasses } from '../utils/engine';
import { playProgression, stopAll } from '../utils/audio';

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

  const progressionKey = `${keyTonic}|${keyMode}|${numerals.join('\u0001')}`;
  const [trackedKey, setTrackedKey] = useState(progressionKey);
  if (trackedKey !== progressionKey) {
    setTrackedKey(progressionKey);
    setIsPlaying(false);
    setPlayingIndex(-1);
  }

  // Stop audio when the progression changes or the player unmounts.
  useEffect(() => () => stopAll(), [progressionKey]);

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
    <div className="stack-sm">
      <div className="toolbar">
        {isPlaying ? (
          <button type="button" onClick={stop} className="btn btn-danger">
            ■ Stop
          </button>
        ) : (
          <button type="button" onClick={play} className="btn btn-primary">
            ▶ Play
          </button>
        )}
        <label className="field-inline">
          Tempo
          <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          <span className="mono bpm">{bpm} bpm</span>
        </label>
      </div>

      <div className="chip-row">
        {numerals.map((rn, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectChord?.(chords[i])}
            className="chip"
            aria-pressed={playingIndex === i}
          >
            <span className="mono faint small">{rn}</span>
            <span>{chords[i] || '?'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProgressionPlayer;
