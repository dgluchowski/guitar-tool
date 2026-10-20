import { PitchDetector } from 'pitchy';

export interface PitchReading {
  /** Detected fundamental frequency in Hz. */
  frequency: number;
  /** Confidence 0..1 from the McLeod pitch method; low = noise/unclear. */
  clarity: number;
}

export interface PitchListenerOptions {
  /** Called on every analysis frame with the latest reading. */
  onReading: (reading: PitchReading) => void;
  /** FFT/analysis window size (power of two). Larger = better low-note accuracy, more latency. */
  bufferSize?: number;
  /** Minimum input level (RMS) required before attempting detection. */
  minVolume?: number;
  /** Linear gain applied to the mic signal before analysis (helps quiet sources like an unplugged electric). */
  gain?: number;
}

export interface PitchListener {
  /** Stop analysis, release the mic, and close the audio context. */
  stop: () => void;
  /** Adjust the input gain live (without restarting the mic). */
  setGain: (value: number) => void;
}

/**
 * Start monophonic pitch detection from the microphone.
 *
 * Requests mic access via getUserMedia, runs pitchy's McLeod pitch method on an
 * AnalyserNode each animation frame, and reports {frequency, clarity}. This is
 * intentionally monophonic — single sustained notes, not strummed chords.
 *
 * Rejects if mic permission is denied or the Web Audio API is unavailable.
 */
export async function startPitchListener(options: PitchListenerOptions): Promise<PitchListener> {
  const { onReading, bufferSize = 2048, minVolume = 0.004, gain = 1 } = options;

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone input is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    },
  });

  const AudioCtx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx();
  if (audioContext.state === 'suspended') await audioContext.resume();

  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = bufferSize;
  const gainNode = audioContext.createGain();
  gainNode.gain.value = gain;
  source.connect(gainNode);
  gainNode.connect(analyser);

  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const input = new Float32Array(detector.inputLength);

  let rafId = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(input);

    // Gate on input level so background noise doesn't produce phantom pitches.
    let sumSquares = 0;
    for (let i = 0; i < input.length; i++) sumSquares += input[i] * input[i];
    const rms = Math.sqrt(sumSquares / input.length);

    if (rms >= minVolume) {
      const [frequency, clarity] = detector.findPitch(input, audioContext.sampleRate);
      onReading({ frequency, clarity });
    } else {
      onReading({ frequency: 0, clarity: 0 });
    }

    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    },
    setGain: (value: number) => {
      gainNode.gain.value = value;
    },
  };
}
