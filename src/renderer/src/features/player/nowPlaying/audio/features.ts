export interface AudioFrame {
  time: Float32Array;
  freq: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  rms: number;
  peak: number;
  beat: { flux: number; isBeat: boolean };
  playing: boolean;
  engaged: boolean;
  activity: number;
  bassAtt: number;
  midAtt: number;
  trebleAtt: number;
  rmsAtt: number;
  pulse: number;
}

export interface BeatState {
  prev: Float32Array;
  avg: number;
  hold: number;
}

export interface EnvelopeState {
  bassAtt: number;
  midAtt: number;
  trebleAtt: number;
  rmsAtt: number;
  pulse: number;
}

export function createAudioFrame(fftSize = 2048): AudioFrame {
  const bins = fftSize / 2;
  return {
    time: new Float32Array(fftSize),
    freq: new Uint8Array(bins),
    bass: 0,
    mid: 0,
    treble: 0,
    rms: 0,
    peak: 0,
    beat: { flux: 0, isBeat: false },
    playing: false,
    engaged: false,
    activity: 0,
    bassAtt: 0,
    midAtt: 0,
    trebleAtt: 0,
    rmsAtt: 0,
    pulse: 0,
  };
}

export function createEnvelopeState(): EnvelopeState {
  return { bassAtt: 0, midAtt: 0, trebleAtt: 0, rmsAtt: 0, pulse: 0 };
}

/** Soft-knee compressor — CAVA autosens / keep peaks from slamming the field. */
export function compress(value: number): number {
  const x = value < 0 ? 0 : value;
  return x / (0.62 + x);
}

/** MilkDrop-style lag: snappy rise, slower fall so hits punch then linger. */
export function attenuate(current: number, next: number): number {
  return next > current ? current * 0.55 + next * 0.45 : current * 0.88 + next * 0.12;
}

export function createBeatState(bins: number): BeatState {
  return { prev: new Float32Array(bins), avg: 0.02, hold: 0 };
}

export function analyzeFrame(
  frame: AudioFrame,
  beat: BeatState,
  sampleRate: number,
): void {
  const { time, freq } = frame;
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < time.length; i++) {
    const v = time[i] ?? 0;
    sum += v * v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  frame.rms = Math.sqrt(sum / time.length);
  frame.peak = peak;

  const nyquist = sampleRate * 0.5;
  const binHz = nyquist / freq.length;
  let bass = 0;
  let bassN = 0;
  let mid = 0;
  let midN = 0;
  let treble = 0;
  let trebleN = 0;
  let flux = 0;

  for (let i = 1; i < freq.length; i++) {
    const hz = i * binHz;
    const v = (freq[i] ?? 0) / 255;
    const prev = beat.prev[i] ?? 0;
    const d = v - prev;
    if (d > 0) flux += d;
    beat.prev[i] = v;
    if (hz < 150) {
      bass += v;
      bassN++;
    } else if (hz < 2000) {
      mid += v;
      midN++;
    } else if (hz < 12000) {
      treble += v;
      trebleN++;
    }
  }

  frame.bass = bassN ? bass / bassN : 0;
  frame.mid = midN ? mid / midN : 0;
  frame.treble = trebleN ? treble / trebleN : 0;
  frame.beat.flux = flux;

  beat.avg = beat.avg * 0.9 + flux * 0.1;
  if (beat.hold > 0) beat.hold -= 1;
  // Slightly hungrier than stock so kicks register without constant false triggers.
  const threshold = beat.avg * 1.35 + 0.055;
  const isBeat = beat.hold <= 0 && flux > threshold && frame.rms > 0.015;
  if (isBeat) beat.hold = 7;
  frame.beat.isBeat = isBeat;
}

export function applyEnvelopes(frame: AudioFrame, env: EnvelopeState, dt: number): void {
  // Contrast curve: quiet bands collapse, loud ones stay hot.
  const contrast = (v: number, p = 1.35) => compress(Math.pow(Math.max(0, v), p));
  const bass = contrast(frame.bass, 1.25);
  const mid = contrast(frame.mid, 1.35);
  const treble = contrast(frame.treble, 1.4);
  const rms = contrast(frame.rms * 2.8, 1.3);
  env.bassAtt = attenuate(env.bassAtt, bass);
  env.midAtt = attenuate(env.midAtt, mid);
  env.trebleAtt = attenuate(env.trebleAtt, treble);
  env.rmsAtt = attenuate(env.rmsAtt, rms);
  frame.bassAtt = env.bassAtt;
  frame.midAtt = env.midAtt;
  frame.trebleAtt = env.trebleAtt;
  frame.rmsAtt = env.rmsAtt;

  const energy = compress(frame.rms * 2.4 + frame.bass * 0.85 + frame.beat.flux * 0.12);
  if (frame.beat.isBeat) {
    env.pulse = Math.min(1, Math.max(env.pulse, 0.72) + energy * 0.45);
  } else if (energy > env.pulse) {
    env.pulse = env.pulse * 0.7 + energy * 0.3;
  } else {
    env.pulse *= Math.exp(-2.4 * dt);
  }
  if (env.pulse < 0.002) env.pulse = 0;
  frame.pulse = env.pulse;
}

/** Log-spaced spectrum sample in 0..1, matching final WMP Bars (linear bass, log above). */
export function logSpectrum(freq: Uint8Array, t: number): number {
  const x = Math.min(1, Math.max(0, t));
  const warped = x < 0.18 ? x * (0.18 / 0.18) * 0.12 : 0.12 + Math.pow((x - 0.18) / 0.82, 1.6) * 0.88;
  const idx = warped * (freq.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  const a = (freq[i] ?? 0) / 255;
  const b = (freq[Math.min(freq.length - 1, i + 1)] ?? 0) / 255;
  return a * (1 - f) + b * f;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
