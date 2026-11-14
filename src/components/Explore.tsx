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
    <div className="stack">
      <div className="panel control-row">
        <div className="seg">
          {(['chord', 'scale'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ mode: m })} aria-pressed={mode === m}>
              {m}
            </button>
          ))}
        </div>

        <label className="field">
          Root
          <select value={root} onChange={(e) => onChange({ root: e.target.value })} className="control">
            {ROOTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {mode === 'chord' ? (
          <label className="field">
            Quality
            <select value={quality} onChange={(e) => onChange({ quality: e.target.value })} className="control">
              {CHORD_QUALITIES.map((q) => (
                <option key={q.label} value={q.suffix}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            Scale
            <select
              value={scaleType}
              onChange={(e) => onChange({ scaleType: e.target.value })}
              className="control capitalize"
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
