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
    // A short attack, a decaying sustain, and a falling harmonic series: a
    // plucked string rather than a buzzing organ.
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: [1, 0.55, 0.3, 0.16, 0.08, 0.04] },
      envelope: { attack: 0.004, decay: 0.45, sustain: 0.12, release: 1.15 },
      volume: -10,
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

/** Rough MIDI number so a strum can be ordered low to high without pulling in tonal. */
function midiOfName(note: string): number {
  const match = note.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return 0;
  const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] ?? 0;
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + pitch + accidental;
}

/** Delay between strings in a downstroke, inside the 22–30ms guitar range. */
const STRUM_MS = 26;

function strumNotes(notes: string[], duration: string | number, epoch: number): void {
  const ordered = [...notes].sort((a, b) => midiOfName(a) - midiOfName(b));
  ordered.forEach((note, i) => {
    later(i * STRUM_MS, () => {
      if (epoch !== playbackEpoch) return;
      synth!.triggerAttackRelease(note, duration, Tone!.now() + 0.01);
    });
  });
}

/** Play a chord as a low-to-high strum. Layers on top of anything already ringing — call stopAll first if you don't want that. */
export async function playChord(notes: string[], duration = '1n'): Promise<void> {
  if (!notes.length) return;
  const epoch = playbackEpoch;
  await ensureAudio();
  if (epoch !== playbackEpoch) return;
  strumNotes(notes, duration, epoch);
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
        strumNotes(step.notes, beatsPerChord * secPerBeat * 0.95, epoch);
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
