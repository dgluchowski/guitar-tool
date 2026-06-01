import { useState } from 'react';
import Tuner from './Tuner';
import NoteTrainer from './NoteTrainer';

interface Props {
  tuning: string[];
}

type Tool = 'tuner' | 'trainer';

export function Practice({ tuning }: Props) {
  const [tool, setTool] = useState<Tool>('tuner');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 self-start rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
        <button
          onClick={() => setTool('tuner')}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            tool === 'tuner' ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'
          }`}
        >
          Tuner
        </button>
        <button
          onClick={() => setTool('trainer')}
          className={`rounded px-4 py-1.5 text-sm font-medium ${
            tool === 'trainer' ? 'bg-white shadow dark:bg-stone-700' : 'text-stone-500'
          }`}
        >
          Note Trainer
        </button>
      </div>

      {tool === 'tuner' ? <Tuner tuning={tuning} /> : <NoteTrainer tuning={tuning} />}
    </div>
  );
}

export default Practice;
