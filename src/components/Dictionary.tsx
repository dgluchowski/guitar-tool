import { useMemo, useState } from 'react';
import ChordView from './ChordView';
import { ROOTS, CHORD_QUALITIES } from '../utils/catalog';
import { diatonicChords, type KeyMode } from '../utils/keys';
import { notesForChord, voicePitchClasses } from '../utils/engine';
import { playChord, stopAll } from '../utils/audio';

interface Props {
  root: string;
  quality: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  keyTonic: string;
  keyMode: KeyMode;
  onSelectChord: (symbol: string) => void;
  onKeyChange: (patch: { keyTonic?: string; keyMode?: KeyMode }) => void;
}

export function Dictionary({
  root,
  quality,
  tuning,
  leftHanded,
  numFrets,
  keyTonic,
  keyMode,
  onSelectChord,
  onKeyChange,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterByKey, setFilterByKey] = useState(false);
  const [oneAtATime, setOneAtATime] = useState(true);

  const qualities = useMemo(
    () => CHORD_QUALITIES.filter((q) => showAdvanced || q.beginner),
    [showAdvanced],
  );

  const diatonic = useMemo(() => diatonicChords(keyTonic, keyMode), [keyTonic, keyMode]);
  const currentSymbol = `${root}${quality}`;

  const select = (symbol: string) => {
    onSelectChord(symbol);
    const set = notesForChord(symbol);
    if (!set.pitches.length) return;
    // "One at a time" cuts the previous chord; otherwise chords layer so you can
    // hear how they sound together.
    if (oneAtATime) stopAll();
    playChord(voicePitchClasses(set.pitches.map((p) => p.pc)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={filterByKey} onChange={(e) => setFilterByKey(e.target.checked)} />
          Filter by key
        </label>
        {filterByKey && (
          <div className="flex items-center gap-2 text-sm">
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
          </div>
        )}
        {!filterByKey && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
            Show advanced qualities
          </label>
        )}
        <label className="flex items-center gap-2 text-sm" title="When on, each chord stops the previous one. Turn off to layer chords and hear them together.">
          <input type="checkbox" checked={oneAtATime} onChange={(e) => setOneAtATime(e.target.checked)} />
          One chord at a time
        </label>
      </div>

      {filterByKey ? (
        <div className="rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
          <div className="mb-3 text-sm font-medium">
            Diatonic chords of {keyTonic} {keyMode}
          </div>
          <div className="flex flex-wrap gap-2">
            {diatonic.map((d) => (
              <button
                key={d.roman}
                onClick={() => select(d.symbol)}
                className={`flex flex-col items-center rounded-lg border px-4 py-2 ${
                  d.symbol === currentSymbol
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                    : 'border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <span className="text-xs text-stone-400">{d.roman}</span>
                <span className="font-medium">{d.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-1"></th>
                {qualities.map((q) => (
                  <th key={q.label} className="p-1 text-xs font-medium text-stone-500">
                    {q.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOTS.map((r) => (
                <tr key={r}>
                  <th className="p-1 pr-2 text-right font-medium text-stone-500">{r}</th>
                  {qualities.map((q) => {
                    const symbol = `${r}${q.suffix}`;
                    return (
                      <td key={q.label} className="p-0.5">
                        <button
                          onClick={() => select(symbol)}
                          className={`w-full rounded px-2 py-1 font-mono ${
                            symbol === currentSymbol
                              ? 'bg-violet-600 text-white'
                              : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700'
                          }`}
                        >
                          {symbol}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ChordView chordSymbol={currentSymbol} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />
    </div>
  );
}

export default Dictionary;
