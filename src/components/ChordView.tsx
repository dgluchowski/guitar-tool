import { useMemo, useState } from 'react';
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

export function ChordView({ chordSymbol, tuning, leftHanded, numFrets }: Props) {
  const [selected, setSelected] = useState<number | null>(0);

  const noteSet = useMemo(() => notesForChord(chordSymbol), [chordSymbol]);
  const shapes = useMemo(
    () => findChordShapes(chordSymbol, tuning, { maxFrets: numFrets }),
    [chordSymbol, tuning, numFrets],
  );

  // Reset to the first voicing when the chord or tuning changes, without an effect.
  const shapeKey = `${chordSymbol}|${tuning.join(',')}|${shapes.length}`;
  const [trackedShapeKey, setTrackedShapeKey] = useState(shapeKey);
  if (trackedShapeKey !== shapeKey) {
    setTrackedShapeKey(shapeKey);
    setSelected(shapes.length ? 0 : null);
  }

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
    return <div className="alert">Unknown chord: {chordSymbol}</div>;
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="title">{noteSet.name}</span>
        <span className="muted">{noteSet.pitches.map((p) => p.pc).join(' · ')}</span>
        <button type="button" onClick={playSelectedShape} className="btn btn-primary">
          ▶ Play
        </button>
      </div>

      <div className="panel">
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
        <div className="legend">
          {noteSet.pitches.map((p) => (
            <span key={p.pc} className="legend-item">
              <span className="swatch" style={{ background: colorForDegree(p.degree) }} />
              {p.pc} <span className="faint">({p.degree})</span>
            </span>
          ))}
        </div>
      </div>

      {shapes.length > 0 && (
        <div className="panel">
          <div className="panel-title">Playable voicings (best first)</div>
          <div className="voicing-list">
            {shapes.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                className="voicing"
                title={`${s.fingers} finger(s), base fret ${s.baseFret}`}
              >
                <span className="voicing-frets">
                  {s.frets.map((f, si) => (
                    <span key={si} className={f === null ? 'voicing-cell is-mute' : 'voicing-cell'}>
                      {f === null ? 'x' : f}
                    </span>
                  ))}
                </span>
                <span className="voicing-meta">{s.fingers}f</span>
              </button>
            ))}
          </div>
          <p className="hint">Strings low → high; x = muted. Click to show on the board.</p>
        </div>
      )}
    </div>
  );
}

export default ChordView;
