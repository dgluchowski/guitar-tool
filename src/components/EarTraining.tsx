import { useCallback, useMemo, useState } from 'react';
import EarQuiz from './EarQuiz';
import { EXERCISES } from '../utils/earExercises';
import type { Difficulty, Direction, EarSettings } from '../utils/earExercises';

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

  return (
    <div className="stack">
      <div className="chip-row">
        {EXERCISES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setExerciseId(e.id)}
            aria-pressed={e.id === exerciseId}
            className="chip"
          >
            {e.name}
          </button>
        ))}
      </div>
      <p className="muted">{exercise.blurb}</p>

      <div className="panel toolbar">
        <label className="field-inline">
          Difficulty
          <select
            value={settings.difficulty}
            onChange={(e) => update({ difficulty: e.target.value as Difficulty })}
            className="control"
          >
            {exercise.difficulties.map((d) => (
              <option key={d} value={d}>
                {DIFF_LABELS[d]}
              </option>
            ))}
          </select>
        </label>

        {exercise.controls.direction && (
          <label className="field-inline">
            Direction
            <select
              value={settings.direction}
              onChange={(e) => update({ direction: e.target.value as Direction })}
              className="control"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
              <option value="harmonic">Harmonic (together)</option>
            </select>
          </label>
        )}

        {exercise.controls.arpeggio && (
          <label className="check">
            <input type="checkbox" checked={settings.arpeggio} onChange={(e) => update({ arpeggio: e.target.checked })} />
            Arpeggiate (play notes one by one)
          </label>
        )}

        {exercise.controls.reference && (
          <label className="check">
            <input type="checkbox" checked={settings.reference} onChange={(e) => update({ reference: e.target.checked })} />
            Play the tonic first (reference)
          </label>
        )}
      </div>

      <EarQuiz
        key={`${exercise.id}:${settings.difficulty}:${settings.direction}:${settings.arpeggio}:${settings.reference}`}
        make={make}
        storageKey={storageKey}
      />
    </div>
  );
}

export default EarTraining;
