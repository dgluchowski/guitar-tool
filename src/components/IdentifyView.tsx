import { useState } from 'react';
import { Chord } from 'tonal';
import Fretboard, { type CellMarker } from './Fretboard';
import { CHORD_QUALITIES, splitChordSymbol } from '../utils/catalog';
import { degreeLabel } from '../utils/engine';
import { noteAtFret, spellChordSymbol, spellPitchClass, tuningUsesFlats } from '../utils/notes';
import { playChord, stopAll } from '../utils/audio';

interface Props {
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
  onOpenChord: (root: string, quality: string) => void;
}

const KNOWN_SUFFIXES = new Set(CHORD_QUALITIES.map((q) => q.suffix));

/** Tonal sometimes spells a major chord as "CM" or "A#M". Map those onto catalog suffixes. */
function catalogSymbol(symbol: string): { root: string; quality: string; display: string } {
  const split = splitChordSymbol(symbol);
  const aliases: Record<string, string> = { M: '', maj: '', M7: 'maj7', M9: 'maj9' };
  const quality = aliases[split.quality] ?? split.quality;
  return { root: split.root, quality, display: `${split.root}${quality}` };
}

export function IdentifyView({ tuning, leftHanded, numFrets, onOpenChord }: Props) {
  const tuningKey = tuning.join(',');
  const [trackedKey, setTrackedKey] = useState(tuningKey);
  const [frets, setFrets] = useState<(number | null)[]>(() => tuning.map(() => null));
  if (trackedKey !== tuningKey) {
    setTrackedKey(tuningKey);
    setFrets(tuning.map(() => null));
  }

  const flats = tuningUsesFlats(tuning);
  const sounding = frets.flatMap((fret, stringIndex) =>
    fret == null ? [] : [{ stringIndex, fret, note: noteAtFret(tuning[stringIndex], fret) }],
  );
  const detected = sounding.length >= 2 ? Chord.detect(sounding.map((n) => n.note)).slice(0, 4) : [];

  const positions: CellMarker[] = sounding.map((n) => {
    const pc = spellPitchClass(n.note, flats);
    return { string: n.stringIndex, fret: n.fret, color: '#D55E00', label: pc };
  });
  const mutedStrings = frets.flatMap((fret, index) => (fret == null ? [index] : []));

  const toggle = (stringIndex: number, fret: number) => {
    const selecting = frets[stringIndex] !== fret;
    setFrets((current) => {
      const next = current.length === tuning.length ? [...current] : tuning.map(() => null);
      next[stringIndex] = next[stringIndex] === fret ? null : fret;
      return next;
    });
    if (selecting) {
      stopAll();
      void playChord([noteAtFret(tuning[stringIndex], fret)], '8n');
    }
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="title">Identify</span>
        <span className="muted">Click a fret on each string. Click it again to mute that string.</span>
        <button type="button" className="btn" onClick={() => setFrets(tuning.map(() => null))} disabled={!sounding.length}>
          Clear
        </button>
      </div>

      <div className="panel">
        <Fretboard
          tuning={tuning}
          numFrets={numFrets}
          fretRange={[0, numFrets]}
          leftHanded={leftHanded}
          showAllNotes
          spellFlats={flats}
          positions={positions}
          mutedStrings={mutedStrings}
          onCellClick={(stringIndex, fret) => toggle(stringIndex, fret)}
        />
      </div>

      <div className="panel stack-sm">
        <div className="panel-title">Detected chords</div>
        {detected.length === 0 ? (
          <p className="hint hint-flush">Select at least two notes. The lowest sounding string is the bass.</p>
        ) : (
          <div className="stack-sm">
            {detected.map((symbol) => {
              const chord = Chord.get(symbol);
              const catalog = catalogSymbol(symbol);
              const formula = (chord.intervals ?? []).map((interval) => degreeLabel(interval)).join(' · ');
              const canOpen = KNOWN_SUFFIXES.has(catalog.quality);
              return (
                <div key={symbol} className="toolbar">
                  <span className="strong">{spellChordSymbol(catalog.display, flats)}</span>
                  <span className="mono faint">{formula || chord.intervals?.join(' ')}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!canOpen}
                    onClick={() => onOpenChord(catalog.root, catalog.quality)}
                  >
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default IdentifyView;
