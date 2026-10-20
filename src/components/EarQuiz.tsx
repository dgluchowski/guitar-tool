import { useEffect, useState } from 'react';
import type { EarQuestion } from '../utils/earExercises';
import { playChord, playSequence, stopAll } from '../utils/audio';

interface Props {
  /** Generates a fresh question. Its identity changes when settings change. */
  make: () => EarQuestion;
  /** localStorage key for the best-streak record (per exercise + difficulty). */
  storageKey: string;
}

/**
 * Generic listen-and-answer quiz: plays a prompt, offers multiple-choice
 * answers, gives instant feedback, and tracks score / streak / accuracy with a
 * persisted best streak. Each ear-training exercise plugs into it via `make`.
 */
export function EarQuiz({ make, storageKey }: Props) {
  const [question, setQuestion] = useState<EarQuestion>(make);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(storageKey) || 0));

  // New exercise / difficulty / settings → fresh question and reset the round.
  useEffect(() => {
    setQuestion(make());
    setPicked(null);
    setScore(0);
    setStreak(0);
    setTotal(0);
    setBest(Number(localStorage.getItem(storageKey) || 0));
  }, [make, storageKey]);

  // Stop any audio when leaving the screen.
  useEffect(() => () => stopAll(), []);

  // Persist the best streak.
  useEffect(() => {
    if (streak > best) {
      setBest(streak);
      localStorage.setItem(storageKey, String(streak));
    }
  }, [streak, best, storageKey]);

  const playQuestion = (q: EarQuestion) => {
    stopAll();
    if (q.play === 'chord') playChord(q.notes, '2n');
    else playSequence(q.notes, 0.6);
  };

  const answer = (i: number) => {
    if (picked != null) return;
    setPicked(i);
    setTotal((t) => t + 1);
    if (i === question.answerIndex) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const next = () => {
    const q = make();
    setQuestion(q);
    setPicked(null);
    playQuestion(q);
  };

  const correct = picked != null && picked === question.answerIndex;
  const accuracy = total ? Math.round((score / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3 text-center">
        <Stat label="Score" value={score} />
        <Stat label="Streak" value={streak} />
        <Stat label="Best" value={best} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
        <button
          onClick={() => playQuestion(question)}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
        >
          ▶ Play
        </button>
        <p className="text-sm text-stone-500">Listen, then pick your answer.</p>

        <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
          {question.choices.map((c, i) => {
            const isAnswer = i === question.answerIndex;
            const isPicked = picked === i;
            let cls =
              'border-stone-300 hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800';
            if (picked != null) {
              if (isAnswer) cls = 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300';
              else if (isPicked) cls = 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';
              else cls = 'border-stone-200 text-stone-400 dark:border-stone-700';
            }
            return (
              <button
                key={c}
                disabled={picked != null}
                onClick={() => answer(i)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${cls}`}
              >
                {c}
              </button>
            );
          })}
        </div>

        <div className="min-h-6 text-center text-sm">
          {picked != null && (
            <span className={correct ? 'font-medium text-green-600 dark:text-green-400' : 'text-stone-600 dark:text-stone-300'}>
              {correct ? 'Correct! ' : 'Not quite — '}
              {question.reveal}
            </span>
          )}
        </div>

        {picked != null && (
          <button
            onClick={next}
            className="rounded-lg border border-stone-300 px-5 py-2 text-sm font-medium transition-colors hover:bg-stone-50 dark:border-stone-600 dark:hover:bg-stone-800"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  );
}

export default EarQuiz;
