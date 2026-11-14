import { useState } from 'react';
import Tuner from './Tuner';
import NoteTrainer from './NoteTrainer';
import EarTraining from './EarTraining';
import Metronome from './Metronome';

interface Props {
  tuning: string[];
  leftHanded: boolean;
  numFrets: number;
}

type Tool = 'tuner' | 'trainer' | 'ear' | 'metronome';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'tuner', label: 'Tuner' },
  { id: 'trainer', label: 'Note Trainer' },
  { id: 'ear', label: 'Ear Training' },
  { id: 'metronome', label: 'Metronome' },
];

export function Practice({ tuning, leftHanded, numFrets }: Props) {
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
      {tool === 'trainer' && <NoteTrainer tuning={tuning} leftHanded={leftHanded} numFrets={numFrets} />}
      {tool === 'ear' && <EarTraining />}
      {tool === 'metronome' && <Metronome />}
    </div>
  );
}

export default Practice;
