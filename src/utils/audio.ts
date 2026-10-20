// Tone.js is large (~300kB). Import it lazily on first playback so it lands in
// its own chunk and never weighs down the initial page load.
import type * as ToneNS from 'tone';

let Tone: typeof ToneNS | null = null;
let synth: ToneNS.PolySynth | null = null;
let click: ToneNS.MembraneSynth | null = null;
let started = false;

/** Lazily load + start the audio context (must be called from a user gesture) and build instruments. */
export async function ensureAudio(): Promise<void> {
  if (!Tone) {
    Tone = await import('tone');
  }
  if (!started) {
    await Tone.start();
    started = true;
  }
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.8 },
      volume: -8,
    }).toDestination();
  }
  if (!click) {
    click = new Tone.MembraneSynth({ volume: -14 }).toDestination();
  }
}

/**
 * Pending playback timers. We trigger each note from a setTimeout (rather than
 * pre-scheduling far ahead on Tone's clock) so that stopAll can cancel anything
 * that hasn't sounded yet — otherwise notes scheduled ahead keep playing after
 * "stop" and rapid presses stack on top of each other.
 */
let timers: ReturnType<typeof setTimeout>[] = [];
// Bumped by stopAll so a play call that is still awaiting the audio context
// does not sound after the user has already stopped.
let playbackEpoch = 0;

function later(ms: number, fn: () => void): void {
  timers.push(setTimeout(fn, Math.max(0, ms)));
}

/** Stop all sound and cancel any not-yet-sounded notes / callbacks. */
export function stopAll(): void {
  playbackEpoch++;
  timers.forEach(clearTimeout);
  timers = [];
  synth?.releaseAll();
}

/** Play a block chord. `notes` are note names with octave, e.g. ["C3","E3","G3"]. Layers on top of anything already ringing — call stopAll first if you don't want that. */
export async function playChord(notes: string[], duration = '1n'): Promise<void> {
  if (!notes.length) return;
  const epoch = playbackEpoch;
  await ensureAudio();
  if (epoch !== playbackEpoch) return;
  synth!.triggerAttackRelease(notes, duration, Tone!.now() + 0.02);
}

/** Play notes one after another (scale / arpeggio). Cancels any current playback first. */
export async function playSequence(notes: string[], noteSeconds = 0.32): Promise<void> {
  if (!notes.length) return;
  await ensureAudio();
  stopAll();
  const epoch = playbackEpoch;
  const ms = noteSeconds * 1000;
  notes.forEach((n, i) => {
    later(i * ms, () => {
      if (epoch !== playbackEpoch) return;
      synth!.triggerAttackRelease(n, noteSeconds * 0.9, Tone!.now() + 0.01);
    });
  });
}

export interface ProgressionStep {
  /** Notes with octave for this chord. */
  notes: string[];
}

export interface PlayProgressionOptions {
  bpm?: number;
  beatsPerChord?: number;
  /** Called with the current chord index as it plays, then -1 when finished. */
  onStep?: (index: number) => void;
}

/**
 * Play a chord progression with a metronome click on every beat.
 * stopAll() cancels anything that has not sounded yet.
 */
export async function playProgression(
  steps: ProgressionStep[],
  { bpm = 90, beatsPerChord = 4, onStep }: PlayProgressionOptions = {},
): Promise<void> {
  if (!steps.length) return;
  await ensureAudio();
  stopAll();
  const epoch = playbackEpoch;

  const secPerBeat = 60 / bpm;
  const chordMs = beatsPerChord * secPerBeat * 1000;
  const beatMs = secPerBeat * 1000;

  const current = () => epoch === playbackEpoch;

  steps.forEach((step, i) => {
    later(i * chordMs, () => {
      if (!current()) return;
      if (step.notes.length) {
        synth!.triggerAttackRelease(step.notes, beatsPerChord * secPerBeat * 0.95, Tone!.now() + 0.01);
      }
      onStep?.(i);
    });
    for (let b = 0; b < beatsPerChord; b++) {
      later(i * chordMs + b * beatMs, () => {
        if (!current()) return;
        click!.triggerAttackRelease(b === 0 ? 'C2' : 'G1', '32n', Tone!.now() + 0.01);
      });
    }
  });

  later(steps.length * chordMs + 100, () => {
    if (current()) onStep?.(-1);
  });
}
