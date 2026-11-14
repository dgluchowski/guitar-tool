import { useMemo, useState } from 'react';
import Fretboard, { type CellMarker, type HighlightMap } from './Fretboard';
import {
  notesForChord,
  findChordShapesByPosition,
  voicePitchClasses,
  type InversionName,
  type StringGroup,
  type VoicingStyle,
} from '../utils/engine';
import { noteAtFret, prefersFlatKey, spellChordSymbol, spellPitchClass, tuningUsesFlats } from '../utils/notes';
import { colorForDegree } from '../utils/colors';
import { playChord, stopAll } from '../utils/audio';

interface Props {
  chordSymbol: string;
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

type MarkerMode = 'degree' | 'note' | 'finger';

const ZONE_CHIP: Record<string, string> = {
  open: 'Open 0–4',
  iii: 'Pos III 2–6',
  v: 'Pos V 4–8',
  vii: 'Pos VII 6–10',
  ix: 'Pos IX 8–12',
  xii: 'Pos XII 11–15',
  upper14: 'Upper 14–19',
  upper18: 'Upper 18–24',
};

const STYLES: { id: VoicingStyle; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'full', label: 'Full' },
  { id: 'triad', label: 'Triad (3-str)' },
  { id: 'drop2', label: '4-String' },
  { id: 'shell', label: 'Shell (1-3-7)' },
];

const GROUPS: { id: StringGroup; label: string }[] = [
  { id: 'all', label: 'All strings' },
  { id: 'low', label: 'Low strings' },
  { id: 'mid', label: 'Mid strings' },
  { id: 'high', label: 'High strings' },
];

function inversionBadge(name: InversionName): string {
  if (name === '1st Inv') return '1st inv';
  if (name === '2nd Inv') return '2nd inv';
  if (name === '3rd Inv') return '3rd inv';
  if (name === 'Ext Bass') return 'ext bass';
  return 'Root';
}

export function ChordView({ chordSymbol, tuning, leftHanded, numFrets }: Props) {
  const [selected, setSelected] = useState<number | null>(0);
  const [zoneId, setZoneId] = useState('all');
  const [voicingStyle, setVoicingStyle] = useState<VoicingStyle>('all');
  const [stringGroup, setStringGroup] = useState<StringGroup>('all');
  const [marker, setMarker] = useState<MarkerMode>('degree');

  const noteSet = useMemo(() => notesForChord(chordSymbol), [chordSymbol]);
  const flats = prefersFlatKey(noteSet.root) || tuningUsesFlats(tuning);
  const spell = (pc: string) => spellPitchClass(pc, flats);
  const buckets = useMemo(
    () => findChordShapesByPosition(chordSymbol, tuning, { maxFrets: numFrets, voicingStyle, stringGroup }),
    [chordSymbol, tuning, numFrets, voicingStyle, stringGroup],
  );

  const zoneOk = zoneId === 'all' || buckets.some((b) => b.zone.id === zoneId);
  if (!zoneOk) setZoneId('all');

  const shapes = useMemo(() => {
    if (!zoneOk || zoneId === 'all') {
      const seen = new Set<string>();
      const mixed = [];
      for (const bucket of buckets) {
        let kept = 0;
        for (const shape of bucket.shapes) {
          const key = shape.frets.map((f) => (f == null ? 'x' : f)).join('-');
          if (seen.has(key)) continue;
          seen.add(key);
          mixed.push(shape);
          kept += 1;
          if (kept >= 3) break;
        }
      }
      return mixed;
    }
    return buckets.find((b) => b.zone.id === zoneId)?.shapes ?? [];
  }, [buckets, zoneId, zoneOk]);

  // Reset to the first voicing when the chord, tuning, or filters change, without an effect.
  const shapeKey = `${chordSymbol}|${tuning.join(',')}|${numFrets}|${voicingStyle}|${stringGroup}|${zoneId}|${shapes.length}`;
  const [trackedShapeKey, setTrackedShapeKey] = useState(shapeKey);
  if (trackedShapeKey !== shapeKey) {
    setTrackedShapeKey(shapeKey);
    setSelected(shapes.length ? 0 : null);
  }

  const highlightedNotes: HighlightMap = {};
  for (const p of noteSet.pitches) {
    highlightedNotes[p.pc] = {
      color: colorForDegree(p.degree),
      label: marker === 'note' ? spell(p.pc) : p.degree,
    };
  }

  const showing = selected != null && shapes[selected];

  const positions: CellMarker[] | undefined = showing
    ? shapes[selected].positions.map((p) => {
        const finger = shapes[selected].fingerMap[p.string];
        const label =
          marker === 'note' ? spell(p.pc) : marker === 'finger' ? (finger == null ? '0' : String(finger)) : p.degree;
        return {
          string: p.string,
          fret: p.fret,
          color: colorForDegree(p.degree),
          label,
        };
      })
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
        <span className="title">{spellChordSymbol(noteSet.name, flats)}</span>
        <span className="muted">{noteSet.pitches.map((p) => spell(p.pc)).join(' · ')}</span>
        <button type="button" onClick={playSelectedShape} className="btn btn-primary">
          ▶ Play
        </button>
        <div className="seg ml-auto" role="group" aria-label="Fretboard marker text">
          {(
            [
              ['degree', 'Degrees'],
              ['note', 'Notes'],
              ['finger', 'Fingers'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMarker(id)} aria-pressed={marker === id}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <Fretboard
          tuning={tuning}
          numFrets={numFrets}
          fretRange={[0, numFrets]}
          leftHanded={leftHanded}
          spellFlats={flats}
          onCellClick={(_stringIndex, _fret, note) => {
            stopAll();
            void playChord([note], '8n');
          }}
          highlightedNotes={showing ? undefined : highlightedNotes}
          positions={positions}
          mutedStrings={mutedStrings}
          showAllNotes={!showing}
        />
        <div className="legend">
          {noteSet.pitches.map((p) => (
            <span key={p.pc} className="legend-item">
              <span className="swatch" style={{ background: colorForDegree(p.degree) }} />
              {spell(p.pc)} <span className="faint">({p.degree})</span>
            </span>
          ))}
        </div>
      </div>

      <div className="panel stack-sm">
        <div className="panel-title">Playable voicings</div>
        <div className="chip-row" role="group" aria-label="Neck position">
          <button type="button" className="chip" aria-pressed={zoneId === 'all'} onClick={() => setZoneId('all')}>
            All zones
          </button>
          {buckets.map((bucket) => (
            <button
              key={bucket.zone.id}
              type="button"
              className="chip"
              aria-pressed={zoneId === bucket.zone.id}
              onClick={() => setZoneId(bucket.zone.id)}
            >
              <span>{ZONE_CHIP[bucket.zone.id] ?? bucket.zone.label}</span>
              <span className="faint small">{bucket.count}</span>
            </button>
          ))}
        </div>
        <div className="control-row">
          <label className="field">
            Voicing
            <select
              value={voicingStyle}
              onChange={(e) => setVoicingStyle(e.target.value as VoicingStyle)}
              className="control"
            >
              {STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Strings
            <select
              value={stringGroup}
              onChange={(e) => setStringGroup(e.target.value as StringGroup)}
              className="control"
            >
              {GROUPS.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {shapes.length > 0 ? (
          <div className="voicing-list">
            {shapes.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                className="voicing"
                title={`${s.positionLabel}, ${inversionBadge(s.inversion)}, ${s.fingers} finger(s), base fret ${s.baseFret}`}
              >
                <span className="voicing-frets">
                  {s.frets.map((f, si) => (
                    <span key={si} className={f === null ? 'voicing-cell is-mute' : 'voicing-cell'}>
                      {f === null ? 'x' : f}
                    </span>
                  ))}
                </span>
                <span className="voicing-meta">
                  {s.baseFret === 0 ? 'Open' : `fr. ${s.baseFret}`}
                  {' · '}
                  {inversionBadge(s.inversion)}
                  {' · '}
                  {s.fingers}f
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="hint hint-flush">No playable voicings in this zone with these filters.</p>
        )}
        <p className="hint">Strings low → high; x = muted. Click a voicing to show it on the board.</p>
      </div>
    </div>
  );
}

export default ChordView;
