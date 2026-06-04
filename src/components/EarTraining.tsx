import { useCallback, useMemo, useState } from 'react';
import EarQuiz from './EarQuiz';
import { EXERCISES } from '../ear/exercises';
import type { Difficulty, Direction, EarSettings } from '../ear/exercises';

const DIFF_LABELS: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function EarTraining() {
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [settings, setSettings] = useState<EarSettings>({
    difficulty: 'easy',
    direction: 'asc',
    arpeggio: false,
    reference: true,
  });

  const exercise = useMemo(() => EXERCISES.find((e) => e.id === exerciseId)!, [exerciseId]);
  const make = useCallback(() => exercise.make(settings), [exercise, settings]);
  const storageKey = `gt-ear-${exercise.id}-${settings.difficulty}`;

  const update = (patch: Partial<EarSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const selectClass =
    'rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-2 py-1';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {EXERCISES.map((e) => (
          <button
            key={e.id}
            onClick={() => setExerciseId(e.id)}
            aria-pressed={e.id === exerciseId}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              e.id === exerciseId
                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
                : 'border-stone-200 text-stone-500 hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-500">{exercise.blurb}</p>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-stone-200/80 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
        <label className="flex items-center gap-2 text-sm font-medium">
          Difficulty
          <select
            value={settings.difficulty}
            onChange={(e) => update({ difficulty: e.target.value as Difficulty })}
            className={selectClass}
          >
            {exercise.difficulties.map((d) => (
              <option key={d} value={d}>
                {DIFF_LABELS[d]}
              </option>
            ))}
          </select>
        </label>

        {exercise.controls.direction && (
          <label className="flex items-center gap-2 text-sm font-medium">
            Direction
            <select
              value={settings.direction}
              onChange={(e) => update({ direction: e.target.value as Direction })}
              className={selectClass}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
              <option value="harmonic">Harmonic (together)</option>
            </select>
          </label>
        )}

        {exercise.controls.arpeggio && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.arpeggio} onChange={(e) => update({ arpeggio: e.target.checked })} />
            Arpeggiate (play notes one by one)
          </label>
        )}

        {exercise.controls.reference && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.reference} onChange={(e) => update({ reference: e.target.checked })} />
            Play the tonic first (reference)
          </label>
        )}
      </div>

      <EarQuiz make={make} storageKey={storageKey} />
    </div>
  );
}

export default EarTraining;
