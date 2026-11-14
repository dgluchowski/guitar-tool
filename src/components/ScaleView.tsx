import { useMemo, useState } from 'react';
import Fretboard, { type HighlightMap } from './Fretboard';
import { notesForScale, voicePitchClasses } from '../utils/engine';
import { colorForDegree } from '../utils/colors';
import { playSequence } from '../utils/audio';

interface Props {
  root: string;
  scaleType: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

/** Practical "position" windows (a pragmatic stand-in for CAGED boxes). */
const POSITIONS: { label: string; range: [number, number] }[] = [
  { label: 'Whole neck', range: [0, 15] },
  { label: 'Open (0–4)', range: [0, 4] },
  { label: 'Pos. III (2–6)', range: [2, 6] },
  { label: 'Pos. V (4–8)', range: [4, 8] },
  { label: 'Pos. VII (6–10)', range: [6, 10] },
  { label: 'Pos. IX (8–12)', range: [8, 12] },
];

export function ScaleView({ root, scaleType, tuning, leftHanded, numFrets }: Props) {
  const [posIdx, setPosIdx] = useState(0);

  const noteSet = useMemo(() => notesForScale(root, scaleType), [root, scaleType]);

  const highlightedNotes: HighlightMap = useMemo(() => {
    const map: HighlightMap = {};
    for (const p of noteSet.pitches) map[p.pc] = { color: colorForDegree(p.degree), label: p.degree };
    return map;
  }, [noteSet]);

  const range = POSITIONS[posIdx].range;
  const fretRange: [number, number] = [range[0], Math.min(range[1], numFrets)];

  const playScale = () => {
    const asc = voicePitchClasses(noteSet.pitches.map((p) => p.pc), 3);
    // add the octave root on top for a complete run
    const octaveRoot = noteSet.pitches[0] ? voicePitchClasses([noteSet.pitches[0].pc], 4)[0] : null;
    playSequence(octaveRoot ? [...asc, octaveRoot] : asc);
  };

  if (!noteSet.pitches.length) {
    return (
      <div className="alert">
        Unknown scale: {root} {scaleType}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="title capitalize">
          {noteSet.name}
        </span>
        <span className="muted">{noteSet.pitches.map((p) => p.pc).join(' · ')}</span>
        <button type="button" onClick={playScale} className="btn btn-primary">
          ▶ Play scale
        </button>
        <label className="field-inline ml-auto">
          Position
          <select value={posIdx} onChange={(e) => setPosIdx(Number(e.target.value))} className="control">
            {POSITIONS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel">
        <Fretboard
          tuning={tuning}
          numFrets={numFrets}
          fretRange={fretRange}
          leftHanded={leftHanded}
          highlightedNotes={highlightedNotes}
          showAllNotes
        />
        <div className="legend">
          {noteSet.pitches.map((p) => (
            <span key={p.pc} className="legend-item">
              <span className="swatch" style={{ background: colorForDegree(p.degree) }} />
              {p.pc} <span className="faint">({p.degree})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScaleView;
