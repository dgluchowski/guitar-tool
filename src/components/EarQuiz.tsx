import { useEffect, useState } from 'react';
import type { EarQuestion } from '../utils/earExercises';
import { playChord, playSequence, stopAll } from '../utils/audio';

interface Props {
  /** Generates a fresh question. Its identity changes when settings change. */
  make: () => EarQuestion;
  /** localStorage key for the best-streak record (per exercise + difficulty). */
  storageKey: string;
}

function readBest(key: string): number {
  const n = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
  const [best, setBest] = useState(() => readBest(storageKey));

  // The parent remounts this quiz (via key) when the exercise or settings change.
  if (streak > best) setBest(streak);

  // Stop any audio when leaving the screen.
  useEffect(() => () => stopAll(), []);

  useEffect(() => {
    localStorage.setItem(storageKey, String(best));
  }, [best, storageKey]);

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
    <div className="stack">
      <div className="stat-grid">
        <Stat label="Score" value={score} />
        <Stat label="Streak" value={streak} />
        <Stat label="Best" value={best} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
      </div>

      <div className="panel center">
        <button type="button" onClick={() => playQuestion(question)} className="btn btn-primary">
          ▶ Play
        </button>
        <p className="muted">Listen, then pick your answer.</p>

        <div className="chip-row" style={{ justifyContent: 'center', width: '100%' }}>
          {question.choices.map((c, i) => {
            const isAnswer = i === question.answerIndex;
            const isPicked = picked === i;
            let cls = 'chip';
            if (picked != null) {
              if (isAnswer) cls = 'chip choice is-correct';
              else if (isPicked) cls = 'chip choice is-wrong';
              else cls = 'chip choice is-dim';
            }
            return (
              <button key={c} type="button" disabled={picked != null} onClick={() => answer(i)} className={cls}>
                {c}
              </button>
            );
          })}
        </div>

        <div style={{ minHeight: '1.5rem' }} aria-live="polite">
          {picked != null && (
            <span className={correct ? 'ok-text' : undefined}>
              {correct ? 'Correct! ' : 'Not quite — '}
              {question.reveal}
            </span>
          )}
        </div>

        {picked != null && (
          <button type="button" onClick={next} className="btn">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default EarQuiz;
