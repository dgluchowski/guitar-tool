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

  const addString = () => onChange([...tuning, 'B1']);
  const removeString = () => tuning.length > 2 && onChange(tuning.slice(0, -1));

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          Strings
          <select
            value={tuning.length}
            onChange={(e) => handleStringCount(Number(e.target.value))}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
            {stringCountOptions.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          Tuning
          <select
            value={selected}
            onChange={(e) => handlePreset(e.target.value)}
            className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1"
          >
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
          className="rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-sm hover:bg-stone-50 dark:hover:bg-stone-700"
        >
          {showIO ? 'Hide import/export' : 'Import / Export'}
        </button>
      </div>

      {selectedPreset?.sources && selectedPreset.sources.length > 0 && (
        <p className="text-xs text-stone-500">
          Source:{' '}
          {selectedPreset.sources.map((source, i) => (
            <span key={source.url}>
              {i > 0 && '; '}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-violet-600 hover:underline dark:text-violet-400"
              >
                {source.title}
              </a>
            </span>
          ))}
        </p>
      )}

      {showIO && (
        <div className="flex flex-col gap-2 rounded border border-stone-200 dark:border-stone-700 p-3">
          <div className="text-xs text-stone-500">Export this tuning (low → high), or paste one to import:</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={tuningText}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Current tuning as text"
              className="min-w-0 flex-1 rounded bg-stone-100 dark:bg-stone-800 px-2 py-1 font-mono text-sm"
            />
            <button
              type="button"
              onClick={copyTuning}
              className="rounded bg-stone-200 dark:bg-stone-700 px-2 py-1 text-sm hover:bg-stone-300 dark:hover:bg-stone-600"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && importTuning()}
              placeholder="Paste tuning, e.g. D2 G2 C3 F3 A3 D4"
              aria-label="Tuning text to import"
              className="min-w-0 flex-1 rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={importTuning}
              disabled={!importText.trim()}
              className="rounded bg-violet-600 px-2 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Import
            </button>
          </div>
          {ioError && (
            <div role="alert" className="text-xs text-red-600 dark:text-red-400">
              {ioError}
            </div>
          )}
        </div>
      )}

      {selected === 'custom' && (
        <div className="flex flex-col gap-2 rounded border border-stone-200 dark:border-stone-700 p-3">
          <div className="text-xs text-stone-500">Set each open string (low → high):</div>
          <div className="flex flex-wrap gap-2">
            {tuning.map((open, i) => (
              <div key={i} className="flex items-center gap-1 rounded bg-stone-100 dark:bg-stone-800 px-2 py-1">
                <span className="text-xs text-stone-500 w-4">{i + 1}</span>
                <select
                  value={Note.pitchClass(open)}
                  onChange={(e) => setStringPitch(i, e.target.value)}
                  className="rounded bg-white dark:bg-stone-700 px-1 py-0.5 text-sm"
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
                  className="w-12 rounded bg-white dark:bg-stone-700 px-1 py-0.5 text-sm"
                  aria-label={`String ${i + 1} octave`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={addString}
              className="rounded bg-stone-200 dark:bg-stone-700 px-2 py-1 text-sm hover:bg-stone-300 dark:hover:bg-stone-600"
            >
              + String
            </button>
            <button
              onClick={removeString}
              disabled={tuning.length <= 2}
              className="rounded bg-stone-200 dark:bg-stone-700 px-2 py-1 text-sm hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40"
            >
              − String
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TuningSelector;
