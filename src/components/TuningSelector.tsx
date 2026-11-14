import { useState } from 'react';
import { Note } from 'tonal';
import { findTuningPreset, standardTuningForCount, STRING_COUNTS, TUNINGS } from '../utils/notes';
import { parseTuningText, tuningToText } from '../utils/tuningIO';

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface Props {
  tuning: string[];
  onChange: (tuning: string[]) => void;
  custom: boolean;
  onCustomChange: (custom: boolean) => void;
}

/** Does the current tuning match a named preset? */
function matchingPresetId(tuning: string[]): string {
  return findTuningPreset(tuning)?.id ?? 'custom';
}

export function TuningSelector({ tuning, onChange, custom, onCustomChange }: Props) {
  const selected = custom ? 'custom' : matchingPresetId(tuning);

  const [showIO, setShowIO] = useState(false);
  const [importText, setImportText] = useState('');
  const [ioError, setIoError] = useState('');
  const [copied, setCopied] = useState(false);

  const handlePreset = (id: string) => {
    if (id === 'custom') {
      onCustomChange(true);
      return;
    }
    const preset = TUNINGS.find((t) => t.id === id);
    if (preset) {
      onCustomChange(false);
      onChange([...preset.strings]);
    }
  };

  const handleStringCount = (count: number) => {
    if (count === tuning.length) return;
    const preset = standardTuningForCount(count);
    if (!preset) return;
    onCustomChange(false);
    onChange([...preset.strings]);
  };

  const setStringPitch = (i: number, pc: string) => {
    const oct = Note.octave(tuning[i]) ?? 3;
    const next = [...tuning];
    next[i] = `${pc}${oct}`;
    onChange(next);
  };

  const setStringOctave = (i: number, oct: number) => {
    const pc = Note.pitchClass(tuning[i]);
    const next = [...tuning];
    next[i] = `${pc}${oct}`;
    onChange(next);
  };

  // A perfect fourth (5 semitones) keeps the new string in the same pitch neighborhood.
  const fourthFrom = (note: string, direction: -1 | 1): string => {
    const midi = Note.midi(note);
    if (midi == null) return note;
    return Note.fromMidi(Math.min(127, Math.max(0, midi + direction * 5)));
  };
  const addLowString = () => onChange([fourthFrom(tuning[0], -1), ...tuning]);
  const addHighString = () => onChange([...tuning, fourthFrom(tuning[tuning.length - 1], 1)]);
  const removeAt = (index: number) => {
    if (tuning.length <= 2) return;
    onChange(tuning.filter((_, i) => i !== index));
  };

  const tuningText = tuningToText(tuning);

  const copyTuning = async () => {
    try {
      await navigator.clipboard.writeText(tuningText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); the text stays
      // selectable in the box so the user can copy it manually.
      setIoError('Copy failed — select the text and copy it manually.');
    }
  };

  const importTuning = () => {
    const parsed = parseTuningText(importText);
    if (!parsed) {
      setIoError('Enter at least two notes with octaves, e.g. "D2 G2 C3 F3 A3 D4".');
      return;
    }
    setIoError('');
    setImportText('');
    // Let preset auto-detection decide whether this is a named tuning or custom.
    onCustomChange(false);
    onChange(parsed);
  };

  const presetsForCount = TUNINGS.filter((t) => t.strings.length === tuning.length);
  const selectedPreset = selected === 'custom' ? undefined : TUNINGS.find((t) => t.id === selected);
  const stringCountOptions = (STRING_COUNTS as readonly number[]).includes(tuning.length)
    ? STRING_COUNTS
    : [...STRING_COUNTS, tuning.length].sort((a, b) => a - b);

  return (
    <div className="stack-sm">
      <div className="control-row">
        <label className="field">
          Strings
          <select
            value={tuning.length}
            onChange={(e) => handleStringCount(Number(e.target.value))}
            className="control"
          >
            {stringCountOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Tuning
          <select value={selected} onChange={(e) => handlePreset(e.target.value)} className="control">
            {presetsForCount.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setShowIO((v) => !v);
            setIoError('');
          }}
          aria-expanded={showIO}
          className="btn"
        >
          {showIO ? 'Hide import/export' : 'Import / Export'}
        </button>
      </div>

      {selectedPreset?.sources && selectedPreset.sources.length > 0 && (
        <p className="hint">
          Source:{' '}
          {selectedPreset.sources.map((source, i) => (
            <span key={source.url}>
              {i > 0 && '; '}
              <a href={source.url} target="_blank" rel="noreferrer" className="link">
                {source.title}
              </a>
            </span>
          ))}
        </p>
      )}

      {showIO && (
        <div className="inset">
          <div className="hint hint-flush">
            Export this tuning (low → high), or paste one to import:
          </div>
          <div className="toolbar">
            <input
              readOnly
              value={tuningText}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Current tuning as text"
              className="control mono grow"
            />
            <button type="button" onClick={copyTuning} className="btn btn-sm">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="toolbar">
            <input
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && importTuning()}
              placeholder="Paste tuning, e.g. D2 G2 C3 F3 A3 D4"
              aria-label="Tuning text to import"
              className="control grow"
            />
            <button type="button" onClick={importTuning} disabled={!importText.trim()} className="btn btn-primary btn-sm">
              Import
            </button>
          </div>
          {ioError && (
            <div role="alert" className="alert">
              {ioError}
            </div>
          )}
        </div>
      )}

      {selected === 'custom' && (
        <div className="inset">
          <div className="hint hint-flush">
            Set each open string (low → high):
          </div>
          <div className="string-pills">
            {tuning.map((open, i) => (
              <div key={i} className="string-pill">
                <span className="string-index">
                  {i + 1}
                </span>
                <select
                  value={Note.pitchClass(open)}
                  onChange={(e) => setStringPitch(i, e.target.value)}
                  className="control"
                  aria-label={`String ${i + 1} pitch`}
                >
                  {PITCH_CLASSES.map((pc) => (
                    <option key={pc} value={pc}>
                      {pc}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={Note.octave(open) ?? 3}
                  onChange={(e) => setStringOctave(i, Number(e.target.value))}
                  className="control octave"
                  aria-label={`String ${i + 1} octave`}
                />
                {tuning.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="btn btn-sm"
                    aria-label={`Remove string ${i + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="toolbar">
            <button type="button" onClick={addLowString} className="btn btn-sm">
              + Low string
            </button>
            <button type="button" onClick={addHighString} className="btn btn-sm">
              + High string
            </button>
            <button type="button" onClick={() => removeAt(0)} disabled={tuning.length <= 2} className="btn btn-sm">
              − Low string
            </button>
            <button
              type="button"
              onClick={() => removeAt(tuning.length - 1)}
              disabled={tuning.length <= 2}
              className="btn btn-sm"
            >
              − High string
            </button>
          </div>
          <p className="hint hint-flush">
            Low adds a fourth under the lowest string. High adds a fourth over the highest.
          </p>
        </div>
      )}
    </div>
  );
}

export default TuningSelector;
