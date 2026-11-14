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
    <div className="stack">
      <div className="seg">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTool(t.id)} aria-pressed={tool === t.id}>
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
