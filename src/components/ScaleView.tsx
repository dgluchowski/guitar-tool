import { useMemo, useState } from 'react';
import Fretboard, { type HighlightMap } from './Fretboard';
import { notesForScale, voicePitchClasses } from '../utils/engine';
import { colorForDegree } from '../utils/colors';
import { playChord, playSequence, stopAll } from '../utils/audio';
import { prefersFlatKey, spellChordSymbol, spellPitchClass, tuningUsesFlats } from '../utils/notes';
import { chordsInScale, scalePositions } from '../utils/scalePositions';

interface Props {
  root: string;
  scaleType: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

/** Scale tones that are not part of the highlighted chord. */
const MUTED_TONE = '#c4bfb4';

export function ScaleView({ root, scaleType, tuning, leftHanded, numFrets }: Props) {
  const [posIdx, setPosIdx] = useState(0);
  const [chordIdx, setChordIdx] = useState(0);

  const noteSet = useMemo(() => notesForScale(root, scaleType), [root, scaleType]);
  const positions = useMemo(
    () => scalePositions(root, scaleType, tuning, numFrets),
    [root, scaleType, tuning, numFrets],
  );
  const chords = useMemo(() => chordsInScale(root, scaleType), [root, scaleType]);
  const flats = prefersFlatKey(root) || tuningUsesFlats(tuning);
  const safePos = positions.length ? Math.min(posIdx, positions.length - 1) : 0;
  const safeChord = chordIdx === 0 || chordIdx > chords.length ? 0 : chordIdx;

  const highlightedNotes: HighlightMap = useMemo(() => {
    const emphasized = safeChord > 0 ? new Set(chords[safeChord - 1]?.chromas ?? []) : null;
    const map: HighlightMap = {};
    for (const p of noteSet.pitches) {
      const inChord = !emphasized || emphasized.has(p.chroma);
      map[p.pc] = {
        color: inChord ? colorForDegree(p.degree) : MUTED_TONE,
        label: p.degree,
      };
    }
    return map;
  }, [chords, noteSet, safeChord]);

  const range = positions[safePos]?.range ?? [0, numFrets];
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
        <span className="muted">{noteSet.pitches.map((p) => spellPitchClass(p.pc, flats)).join(' · ')}</span>
        <button type="button" onClick={playScale} className="btn btn-primary">
          ▶ Play scale
        </button>
        <label className="field-inline ml-auto">
          Position
          <select value={safePos} onChange={(e) => setPosIdx(Number(e.target.value))} className="control">
            {positions.map((p, i) => (
              <option key={p.id} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          Chord
          <select value={safeChord} onChange={(e) => setChordIdx(Number(e.target.value))} className="control">
            <option value={0}>All scale tones</option>
            {chords.map((chord, i) => (
              <option key={`${chord.degree}-${chord.symbol}`} value={i + 1}>
                {chord.degree} · {spellChordSymbol(chord.symbol, flats)}
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
          spellFlats={flats}
          onCellClick={(_stringIndex, _fret, note) => {
            stopAll();
            void playChord([note], '8n');
          }}
        />
        <div className="legend">
          {noteSet.pitches.map((p) => (
            <span key={p.pc} className="legend-item">
              <span className="swatch" style={{ background: colorForDegree(p.degree) }} />
              {spellPitchClass(p.pc, flats)} <span className="faint">({p.degree})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScaleView;
