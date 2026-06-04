import { useState } from 'react';
import Tuner from './Tuner';
import NoteTrainer from './NoteTrainer';
import EarTraining from './EarTraining';

interface Props {
  tuning: string[];
}

type Tool = 'tuner' | 'trainer' | 'ear';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'tuner', label: 'Tuner' },
  { id: 'trainer', label: 'Note Trainer' },
  { id: 'ear', label: 'Ear Training' },
];

export function Practice({ tuning }: Props) {
  const [tool, setTool] = useState<Tool>('tuner');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`rounded px-4 py-1.5 text-sm font-medium ${
              tool === t.id ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool === 'tuner' && <Tuner tuning={tuning} />}
      {tool === 'trainer' && <NoteTrainer tuning={tuning} />}
      {tool === 'ear' && <EarTraining />}
    </div>
  );
}

export default Practice;
