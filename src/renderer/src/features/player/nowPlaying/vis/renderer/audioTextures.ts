import * as THREE from "three";
import type { AudioFrame } from "../../audio/features";

const FREQ_W = 512;
const WAVE_W = 1024;

export interface AudioTextures {
  freq: THREE.DataTexture;
  wave: THREE.DataTexture;
  freqData: Uint8Array;
  waveData: Uint8Array;
  update: (audio: AudioFrame) => void;
  dispose: () => void;
}

export function createAudioTextures(): AudioTextures {
  const freqData = new Uint8Array(FREQ_W);
  const waveData = new Uint8Array(WAVE_W);
  // Explicit R8 + UnsignedByte — some GPUs treat bare RedFormat DataTextures as empty.
  const freq = new THREE.DataTexture(
    freqData,
    FREQ_W,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  const wave = new THREE.DataTexture(
    waveData,
    WAVE_W,
    1,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  for (const tex of [freq, wave]) {
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
  }

  return {
    freq,
    wave,
    freqData,
    waveData,
    update(audio: AudioFrame) {
      const srcF = audio.freq;
      const n = srcF.length;
      for (let i = 0; i < FREQ_W; i++) {
        const t = i / (FREQ_W - 1);
        const idx = t * t * (n - 1);
        const a = Math.floor(idx);
        const f = idx - a;
        const va = srcF[a] ?? 0;
        const vb = srcF[Math.min(n - 1, a + 1)] ?? 0;
        freqData[i] = Math.round(va * (1 - f) + vb * f);
      }
      const srcT = audio.time;
      const tn = srcT.length;
      for (let i = 0; i < WAVE_W; i++) {
        const srcI = Math.floor((i / WAVE_W) * tn);
        const v = srcT[srcI] ?? 0;
        waveData[i] = Math.round(Math.min(255, Math.max(0, (v * 0.5 + 0.5) * 255)));
      }
      freq.needsUpdate = true;
      wave.needsUpdate = true;
    },
    dispose() {
      freq.dispose();
      wave.dispose();
    },
  };
}
