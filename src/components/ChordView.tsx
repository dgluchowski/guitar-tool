import { useEffect, useMemo, useState } from 'react';
import Fretboard, { type CellMarker, type HighlightMap } from './Fretboard';
import { notesForChord, findChordShapes, voicePitchClasses } from '../utils/engine';
import { noteAtFret } from '../utils/notes';
import { colorForDegree } from '../utils/colors';
import { playChord, stopAll } from '../utils/audio';

interface Props {
  chordSymbol: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

const fretStr = (frets: (number | null)[]) => frets.map((f) => (f === null ? 'x' : f)).join('');

export function ChordView({ chordSymbol, tuning, leftHanded, numFrets }: Props) {
  const [selected, setSelected] = useState<number | null>(0);

  const noteSet = useMemo(() => notesForChord(chordSymbol), [chordSymbol]);
  const shapes = useMemo(
    () => findChordShapes(chordSymbol, tuning, { maxFrets: numFrets }),
    [chordSymbol, tuning, numFrets],
  );

  useEffect(() => setSelected(shapes.length ? 0 : null), [chordSymbol, tuning, shapes.length]);

  const highlightedNotes: HighlightMap = useMemo(() => {
    const map: HighlightMap = {};
    for (const p of noteSet.pitches) map[p.pc] = { color: colorForDegree(p.degree), label: p.degree };
    return map;
  }, [noteSet]);

  const showing = selected != null && shapes[selected];

  const positions: CellMarker[] | undefined = showing
    ? shapes[selected].positions.map((p) => ({
        string: p.string,
        fret: p.fret,
        color: colorForDegree(p.degree),
        label: p.degree,
      }))
    : undefined;

  const mutedStrings: number[] | undefined = showing
    ? shapes[selected].frets.map((f, i) => (f === null ? i : -1)).filter((i) => i >= 0)
    : undefined;

  const playSelectedShape = () => {
    // Cut any current playback so rapid presses don't stack.
    stopAll();
    if (!showing) {
      playChord(voicePitchClasses(noteSet.pitches.map((p) => p.pc)));
      return;
    }
    // Play the actual fretted notes (with their real octaves) of the chosen voicing.
    const notes = shapes[selected].positions
      .slice()
      .sort((a, b) => a.string - b.string)
      .map((p) => noteAtFret(tuning[p.string], p.fret));
    playChord(notes);
  };

  if (!noteSet.pitches.length) {
    return <div className="text-sm text-red-500">Unknown chord: {chordSymbol}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{noteSet.name}</span>
        <span className="text-sm text-stone-500">{noteSet.pitches.map((p) => p.pc).join(' · ')}</span>
        <button
          onClick={playSelectedShape}
          className="rounded-lg shadow-sm transition-colors bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-700"
        >
          ▶ Play
        </button>
      </div>

      <div className="rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
        <Fretboard
          tuning={tuning}
          numFrets={numFrets}
          fretRange={[0, numFrets]}
          leftHanded={leftHanded}
          highlightedNotes={showing ? undefined : highlightedNotes}
          positions={positions}
          mutedStrings={mutedStrings}
          showAllNotes={!showing}
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

      {shapes.length > 0 && (
        <div className="rounded-xl border border-stone-200/80 shadow-sm dark:border-stone-700 bg-white dark:bg-stone-800/50 p-4">
          <div className="mb-2 text-sm font-medium">Playable voicings (best first)</div>
          <div className="flex flex-wrap gap-2">
            {shapes.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`rounded-lg border px-3 py-2 font-mono text-sm ${
                  selected === i
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                    : 'border-stone-300 dark:border-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
                title={`${s.fingers} finger(s), base fret ${s.baseFret}`}
              >
                {fretStr(s.frets)}
                <span className="ml-2 text-xs text-stone-400">{s.fingers}f</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-stone-400">Strings low → high; x = muted. Click to show on the board.</p>
        </div>
      )}
    </div>
  );
}

export default ChordView;
