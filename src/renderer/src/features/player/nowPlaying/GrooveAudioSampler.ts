import type { AnalyserFrame } from '../PlaybackContext'
import {
  analyzeFrame,
  applyEnvelopes,
  compress,
  createAudioFrame,
  createBeatState,
  createEnvelopeState,
  type AudioFrame
} from './audio/features'

/**
 * Mild lift for quieter local files — kept close to stock now-playing.
 * Over-gain flattens motion (everything pegs at 1 and never “dances”).
 */
const FREQ_GAIN = 1.35
const TIME_GAIN = 1.2

/** Feeds now-playing WebGL scenes from Groove's MediaElementSource analyser. */
export class GrooveAudioSampler {
  private readonly frame: AudioFrame
  private readonly beat
  private readonly envelope
  private readonly freqHold: Uint8Array
  private readonly timeHold: Float32Array
  private lastSample = 0
  private activity = 0
  private engaged = false

  constructor() {
    this.frame = createAudioFrame(2048)
    this.beat = createBeatState(1024)
    this.envelope = createEnvelopeState()
    this.freqHold = new Uint8Array(1024)
    this.timeHold = new Float32Array(2048)
  }

  sample(raw: AnalyserFrame | null, playing: boolean): AudioFrame {
    if (playing) this.engaged = true

    if (raw && playing) {
      const nFreq = Math.min(this.frame.freq.length, raw.frequency.length)
      for (let i = 0; i < nFreq; i += 1) {
        const v = (raw.frequency[i] ?? 0) * FREQ_GAIN
        this.frame.freq[i] = v > 255 ? 255 : v
      }
      const nTime = Math.min(this.frame.time.length, raw.timeDomain.length)
      let floatRms = 0
      for (let i = 0; i < nTime; i += 1) {
        const v = (raw.timeDomain[i] ?? 0) * TIME_GAIN
        const clipped = v > 1 ? 1 : v < -1 ? -1 : v
        this.frame.time[i] = clipped
        floatRms += clipped * clipped
      }
      floatRms = Math.sqrt(floatRms / Math.max(1, nTime))

      if (floatRms < 0.004) {
        let byteEnergy = 0
        for (let i = 0; i < nFreq; i += 1) byteEnergy += this.frame.freq[i] ?? 0
        if (byteEnergy > 80) {
          const wave = raw.waveform
          const step = Math.max(1, Math.floor(wave.length / nTime))
          for (let i = 0; i < nTime; i += 1) {
            const b = wave[i * step] ?? 128
            this.frame.time[i] = ((b - 128) / 128) * TIME_GAIN
          }
        }
      }

      this.freqHold.set(this.frame.freq)
      this.timeHold.set(this.frame.time)
    } else {
      for (let i = 0; i < this.freqHold.length; i += 1) {
        this.freqHold[i] = Math.floor((this.freqHold[i] ?? 0) * 0.973)
      }
      for (let i = 0; i < this.timeHold.length; i += 1) {
        this.timeHold[i] = (this.timeHold[i] ?? 0) * 0.92
      }
      this.frame.freq.set(this.freqHold)
      this.frame.time.set(this.timeHold)
    }

    analyzeFrame(this.frame, this.beat, raw?.sampleRate ?? 44100)
    const now = performance.now()
    const dt = this.lastSample === 0 ? 1 / 60 : Math.min(0.05, (now - this.lastSample) / 1000)
    this.lastSample = now
    applyEnvelopes(this.frame, this.envelope, dt)
    this.frame.playing = playing
    this.frame.engaged = this.engaged

    // High-contrast activity: quiet nearly dies, kicks / beats punch up.
    let target = compress(this.frame.rms * 3.4 + this.frame.bass * 1.15)
    target = Math.pow(Math.max(0, target), 1.45)
    if (target < 0.04) target = 0
    if (this.frame.beat.isBeat) {
      target = Math.min(1, Math.max(target, 0.55) + this.frame.pulse * 0.35)
    }
    if (playing) {
      // Asymmetric: climb on hits, drop fast in quiet so the stage can go dark.
      if (target >= this.activity) {
        this.activity = this.activity * 0.72 + target * 0.28
      } else {
        this.activity = this.activity * 0.82 + target * 0.18
      }
    } else {
      this.activity *= this.engaged ? 0.96 : 0.9
      if (this.activity < 0.008) this.activity = 0
    }
    if (this.activity < 0.012) this.activity = 0
    this.frame.activity = this.activity
    return this.frame
  }
}
