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
    <div className="stack">
      <div className="panel toolbar">
        <label className="check">
          <input type="checkbox" checked={filterByKey} onChange={(e) => setFilterByKey(e.target.checked)} />
          Filter by key
        </label>
        {filterByKey && (
          <div className="toolbar">
            <select
              value={keyTonic}
              onChange={(e) => onKeyChange({ keyTonic: e.target.value })}
              className="control"
              aria-label="Key tonic"
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
              className="control"
              aria-label="Key mode"
            >
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </div>
        )}
        {!filterByKey && (
          <label className="check">
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
            Show advanced qualities
          </label>
        )}
        <label className="check" title="When on, each chord stops the previous one. Turn off to layer chords and hear them together.">
          <input type="checkbox" checked={oneAtATime} onChange={(e) => setOneAtATime(e.target.checked)} />
          One chord at a time
        </label>
      </div>

      {filterByKey ? (
        <div className="panel">
          <div className="panel-title">
            Diatonic chords of {keyTonic} {keyMode}
          </div>
          <div className="chip-row">
            {diatonic.map((d) => (
              <button
                key={d.roman}
                type="button"
                onClick={() => select(d.symbol)}
                aria-pressed={d.symbol === currentSymbol}
                className="chip"
              >
                <span className="faint small">{d.roman}</span>
                <span>{d.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel table-scroll">
          <table className="dict-table">
            <thead>
              <tr>
                <th className="corner"></th>
                {qualities.map((q) => (
                  <th key={q.label}>{q.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOTS.map((r) => (
                <tr key={r}>
                  <th className="root">{r}</th>
                  {qualities.map((q) => {
                    const symbol = `${r}${q.suffix}`;
                    return (
                      <td key={q.label}>
                        <button
                          type="button"
                          onClick={() => select(symbol)}
                          aria-pressed={symbol === currentSymbol}
                          className="dict-cell"
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
