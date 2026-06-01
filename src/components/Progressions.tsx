import { useEffect, useMemo, useState } from 'react';
import ChordView from './ChordView';
import { ROOTS } from '../music/catalog';
import { resolveProgression, type KeyMode } from '../music/keys';
import { notesForChord, voicePitchClasses } from '../music/engine';
import { playProgression, stopAll } from '../music/audio';

interface Props {
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  keyTonic: string;
  keyMode: KeyMode;
  progression: string[];
  selectedChord: string;
  onSelectChord: (symbol: string) => void;
  onKeyChange: (patch: { keyTonic?: string; keyMode?: KeyMode }) => void;
  onProgressionChange: (numerals: string[]) => void;
}

const PRESETS: { label: string; numerals: string[] }[] = [
  { label: 'I–V–vi–IV (pop)', numerals: ['I', 'V', 'vi', 'IV'] },
  { label: 'I–IV–V (rock/blues)', numerals: ['I', 'IV', 'V'] },
  { label: 'ii–V–I (jazz)', numerals: ['ii', 'V7', 'I'] },
  { label: 'I–vi–IV–V (50s)', numerals: ['I', 'vi', 'IV', 'V'] },
  { label: 'i–bVII–bVI–V (minor)', numerals: ['i', 'bVII', 'bVI', 'V'] },
  { label: '12-bar blues', numerals: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'] },
];

export function Progressions({
  tuning,
  leftHanded,
  numFrets,
  keyTonic,
  keyMode,
  progression,
  selectedChord,
  onSelectChord,
  onKeyChange,
  onProgressionChange,
}: Props) {
  const [bpm, setBpm] = useState(90);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const chords = useMemo(
    () => resolveProgression(progression, keyTonic, keyMode),
    [progression, keyTonic, keyMode],
  );

  // Which preset (if any) the current numerals match, so the dropdown shows it.
  const currentPreset = useMemo(
    () =>
      PRESETS.find(
        (p) => p.numerals.length === progression.length && p.numerals.every((n, i) => n === progression[i]),
      )?.label ?? '',
    [progression],
  );

  useEffect(() => () => stopAll(), []);

  const play = async () => {
    const steps = chords.map((c) => {
      const set = notesForChord(c);
      return { notes: set.pitches.length ? voicePitchClasses(set.pitches.map((p) => p.pc)) : [] };
    });
    setIsPlaying(true);
    await playProgression(steps, {
      bpm,
      beatsPerChord: 4,
      onStep: (i) => {
        setPlayingIndex(i);
        if (i === -1) setIsPlaying(false);
        else onSelectChord(chords[i]);
      },
    });
  };

  const stop = () => {
    stopAll();
    setIsPlaying(false);
    setPlayingIndex(-1);
  };

  const editNumeral = (i: number, value: string) => {
    const next = [...progression];
    next[i] = value;
    onProgressionChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          Key
          <select
            value={keyTonic}
            onChange={(e) => onKeyChange({ keyTonic: e.target.value })}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
            {ROOTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={keyMode}
            onChange={(e) => onKeyChange({ keyMode: e.target.value as KeyMode })}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
            <option value="major">major</option>
            <option value="minor">minor</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          Preset
          <select
            value={currentPreset}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.label === e.target.value);
              if (p) onProgressionChange(p.numerals);
            }}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
            <option value="">Choose…</option>
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          Tempo
          <input
            type="range"
            min={40}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <span className="w-12 tabular-nums">{bpm} bpm</span>
        </label>

        {isPlaying ? (
          <button onClick={stop} className="rounded-lg shadow-sm transition-colors bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700">
            ■ Stop
          </button>
        ) : (
          <button onClick={play} className="rounded-lg shadow-sm transition-colors bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700">
            ▶ Play progression
          </button>
        )}
      </div>

      <div className="rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <div className="mb-2 text-sm font-medium">Progression (Roman numerals)</div>
        <div className="flex flex-wrap items-center gap-2">
          {progression.map((rn, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border p-2 ${
                playingIndex === i ? 'border-violet-500 bg-violet-50 dark:bg-violet-950' : 'border-stone-200 dark:border-stone-700'
              }`}
            >
              <input
                value={rn}
                onChange={(e) => editNumeral(i, e.target.value)}
                className="w-16 rounded bg-stone-100 dark:bg-stone-800 px-2 py-1 text-center font-mono text-sm"
                aria-label={`Chord ${i + 1} numeral`}
              />
              <button
                onClick={() => onSelectChord(chords[i])}
                className="mt-1 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                {chords[i] || '?'}
              </button>
            </div>
          ))}
          <button
            onClick={() => onProgressionChange([...progression, 'I'])}
            className="rounded-lg border border-dashed border-stone-300 dark:border-stone-600 px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            + Add
          </button>
          {progression.length > 1 && (
            <button
              onClick={() => onProgressionChange(progression.slice(0, -1))}
              className="rounded-lg border border-stone-300 dark:border-stone-600 px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              − Remove
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Edit numerals (e.g. I, ii, V7, vii°, bVII). Click a chord name to show it on the fretboard.
        </p>
      </div>

      <ChordView chordSymbol={selectedChord} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />
    </div>
  );
}

export default Progressions;
