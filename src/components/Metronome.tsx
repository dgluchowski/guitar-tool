import { useEffect, useRef, useState } from 'react';
import { playMetronomeClick } from '../utils/audio';

const SIGNATURES = [
  { id: '4/4', beats: 4, accents: [0] },
  { id: '3/4', beats: 3, accents: [0] },
  { id: '6/8', beats: 6, accents: [0, 3] },
  { id: '5/4', beats: 5, accents: [0] },
  { id: '7/8', beats: 7, accents: [0] },
] as const;

type SignatureId = (typeof SIGNATURES)[number]['id'];

function signatureById(id: SignatureId) {
  return SIGNATURES.find((s) => s.id === id) ?? SIGNATURES[0];
}

export function Metronome() {
  const [bpm, setBpm] = useState(90);
  const [signature, setSignature] = useState<SignatureId>('4/4');
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const taps = useRef<number[]>([]);

  const spec = signatureById(signature);

  useEffect(() => {
    if (!running) return;
    let current = 0;
    let timer = 0;
    let cancelled = false;
    const pulse = signatureById(signature);

    const tick = () => {
      if (cancelled) return;
      const accent = (pulse.accents as readonly number[]).includes(current);
      void playMetronomeClick(accent);
      setBeat(current);
      current = (current + 1) % pulse.beats;
      timer = window.setTimeout(tick, (60 / bpm) * 1000);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setBeat(-1);
    };
  }, [bpm, running, signature]);

  const tapTempo = () => {
    const now = performance.now();
    const recent = taps.current.filter((t) => now - t < 2500);
    recent.push(now);
    taps.current = recent.slice(-5);
    if (recent.length < 2) return;
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    const next = Math.round(60000 / (total / (recent.length - 1)));
    setBpm(Math.min(240, Math.max(40, next)));
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <button type="button" className={running ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => setRunning((v) => !v)}>
          {running ? '■ Stop' : '▶ Start'}
        </button>
        <button type="button" className="btn" onClick={tapTempo}>
          Tap tempo
        </button>
        <label className="field-inline">
          Tempo
          <input
            type="range"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            aria-label="Tempo in beats per minute"
          />
          <span className="mono bpm">{bpm} bpm</span>
        </label>
        <label className="field-inline">
          Meter
          <select
            value={signature}
            onChange={(e) => setSignature(e.target.value as SignatureId)}
            className="control"
            aria-label="Time signature"
          >
            {SIGNATURES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel">
        <div className="chip-row" aria-live="polite" aria-label="Current beat">
          {Array.from({ length: spec.beats }, (_, i) => (
            <span key={i} className={beat === i ? 'chip is-correct' : 'chip'} aria-current={beat === i ? 'true' : undefined}>
              {i + 1}
            </span>
          ))}
        </div>
        <p className="hint">
          The click is a quarter note in 4/4, 3/4, and 5/4, and an eighth note in 6/8 and 7/8. Beat 1 is accented,
          and so is beat 4 in 6/8.
        </p>
      </div>
    </div>
  );
}

export default Metronome;
