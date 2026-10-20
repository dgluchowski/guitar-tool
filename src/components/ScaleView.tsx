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
    return <div className="text-sm text-red-500">Unknown scale: {root} {scaleType}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold capitalize">{noteSet.name}</span>
        <span className="text-sm text-stone-500">{noteSet.pitches.map((p) => p.pc).join(' · ')}</span>
        <button
          onClick={playScale}
          className="rounded-lg shadow-sm transition-colors bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700"
        >
          ▶ Play scale
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          Position
          <select
            value={posIdx}
            onChange={(e) => setPosIdx(Number(e.target.value))}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
            {POSITIONS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <Fretboard
          tuning={tuning}
          numFrets={numFrets}
          fretRange={fretRange}
          leftHanded={leftHanded}
          highlightedNotes={highlightedNotes}
          showAllNotes
        />
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {noteSet.pitches.map((p) => (
            <span key={p.pc} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: colorForDegree(p.degree) }} />
              {p.pc} <span className="text-stone-400">({p.degree})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScaleView;
