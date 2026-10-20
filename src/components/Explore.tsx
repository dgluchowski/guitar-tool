import { useEffect } from 'react';
import ChordView from './ChordView';
import ScaleView from './ScaleView';
import { CHORD_QUALITIES, ROOTS, SCALE_TYPES } from '../utils/catalog';
import { stopAll } from '../utils/audio';
import type { SelectionMode } from '../utils/appState';

interface Props {
  mode: SelectionMode;
  root: string;
  quality: string;
  scaleType: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  onChange: (patch: { mode?: SelectionMode; root?: string; quality?: string; scaleType?: string }) => void;
}

export function Explore({ mode, root, quality, scaleType, tuning, leftHanded, numFrets, onChange }: Props) {
  // Changing the selected chord/scale should silence anything still ringing.
  useEffect(() => {
    stopAll();
  }, [mode, root, quality, scaleType]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <div className="flex gap-1 rounded-lg bg-stone-100 dark:bg-stone-800 p-1">
          {(['chord', 'scale'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ mode: m })}
              className={`rounded px-3 py-1 text-sm capitalize ${
                mode === m ? 'bg-white dark:bg-stone-700 shadow font-medium' : 'text-stone-500'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-500">
          Root
          <select
            value={root}
            onChange={(e) => onChange({ root: e.target.value })}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-sm text-stone-900 dark:text-stone-100"
          >
            {ROOTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {mode === 'chord' ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-500">
            Quality
            <select
              value={quality}
              onChange={(e) => onChange({ quality: e.target.value })}
              className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-sm text-stone-900 dark:text-stone-100"
            >
              {CHORD_QUALITIES.map((q) => (
                <option key={q.label} value={q.suffix}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs font-medium text-stone-500">
            Scale
            <select
              value={scaleType}
              onChange={(e) => onChange({ scaleType: e.target.value })}
              className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-sm capitalize text-stone-900 dark:text-stone-100"
            >
              {SCALE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {mode === 'chord' ? (
        <ChordView chordSymbol={`${root}${quality}`} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />
      ) : (
        <ScaleView root={root} scaleType={scaleType} tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />
      )}
    </div>
  );
}

export default Explore;
