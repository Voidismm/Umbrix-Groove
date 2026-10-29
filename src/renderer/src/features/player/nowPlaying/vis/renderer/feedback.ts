import * as THREE from "three";
import type { AudioFrame } from "../../audio/features";
import { resolvePalette, type ColorSettings } from "../color";
import type { FeedbackPreset } from "../types";
import type { AudioTextures } from "./audioTextures";
import { makePaletteTexture, writePalette } from "./palette";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FEEDBACK_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tPrev;
uniform sampler2D tFreq;
uniform sampler2D tWave;
uniform sampler2D tPalette;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uRms;
uniform float uPeak;
uniform float uBeat;
uniform float uFlux;
uniform float uShift;
uniform float uDraw;
uniform float uDecay;
uniform float uHueShift;
uniform float uShiftStrength;
uniform float uInk;
uniform float uFlash;
uniform float uKaleidoSlices;
uniform float uSeed;
uniform float uPaletteLocked;
uniform float uAlive;
uniform float uIdle;
uniform float uDrift;
uniform float uPlaying;
varying vec2 vUv;

float freqAt(float t) {
  return texture2D(tFreq, vec2(clamp(t, 0.001, 0.999), 0.5)).r;
}
float waveAt(float t) {
  return texture2D(tWave, vec2(clamp(t, 0.001, 0.999), 0.5)).r * 2.0 - 1.0;
}

vec2 rotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec2 applyShift(vec2 uv) {
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  float s = uShiftStrength * 0.55;
  float r = length(p);
  float a = atan(p.y, p.x);
  a += uTime * 0.04 * uDrift;
  r *= 0.996;

  if (uShift < 0.5) {
    a += r * (0.55 + uBass * 0.35) * s + uTime * 0.05;
    r *= 0.994;
    p = vec2(cos(a), sin(a)) * r;
  } else if (uShift < 1.5) {
    float slices = max(uKaleidoSlices, 3.0);
    float seg = 6.2831853 / slices;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    r *= 0.995;
    p = vec2(cos(a), sin(a)) * r;
    p = rotate(p, uTime * 0.03);
  } else if (uShift < 2.5) {
    p += normalize(p + 0.0001) * (0.012 * s * (0.6 + uBass * 0.3)) * sin(a * 3.0 + uTime * 0.4);
    p *= 0.995;
  } else if (uShift < 3.5) {
    p *= 0.988 - uBass * 0.01 * s;
  } else if (uShift < 4.5) {
    float tiles = 3.0 + floor(uSeed * 2.0);
    p = (fract(p * tiles + 0.5) - 0.5) / tiles;
    p *= 0.995;
    p = rotate(p, uTime * 0.025);
  } else if (uShift < 5.5) {
    a += sin(r * 3.0 - uTime * 0.35) * 0.18 * s;
    r *= 0.994;
    p = vec2(cos(a), sin(a)) * r;
  } else if (uShift < 6.5) {
    p = rotate(p, 0.22 * s * (0.35 - r) + uTime * 0.03);
    p *= 0.995;
  } else if (uShift < 7.5) {
    p.y += 0.008 * s;
  } else if (uShift < 8.5) {
    p.y -= 0.008 * s;
  } else if (uShift < 9.5) {
    p.x -= 0.008 * s;
  } else if (uShift < 10.5) {
    p.x += 0.008 * s;
  } else if (uShift < 11.5) {
    float t = a + r * 1.8 + uTime * 0.08 + uSeed;
    r = pow(max(r, 0.0001), 0.94);
    p = vec2(cos(t), sin(t)) * r * 0.995;
  } else if (uShift < 12.5) {
    p *= 0.99 - uBass * 0.008;
  } else if (uShift < 13.5) {
    p.x += sin(p.y * 3.5 + uTime * 0.35) * 0.006 * s;
    p.y += cos(p.x * 3.0 - uTime * 0.25) * 0.006 * s;
    p *= 0.995;
  } else if (uShift < 14.5) {
    p += 0.004 * s * vec2(sin(uv.y * 6.0 + uTime * 0.3), cos(uv.x * 5.0 - uTime * 0.25));
    p *= 0.995;
  } else if (uShift < 15.5) {
    p.y += 0.01 * s * smoothstep(0.15, 0.7, r);
    p *= 0.994;
  } else if (uShift < 16.5) {
    p *= 0.99 + 0.006 * sin(a * 2.0 + uTime * 0.3);
  } else {
    a += uTime * 0.06 * s;
    r *= 0.995;
    p = vec2(cos(a), sin(a)) * r;
  }

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  p.x /= aspect;
  return clamp(p + 0.5, 0.002, 0.998);
}

float inject(vec2 uv) {
  if (uPlaying < 0.5) return 0.0;
  vec2 p = uv - 0.5;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float ink = 0.0;
  float energy = uRms * 0.55 + uBass * 0.35;

  if (uDraw < 0.5) {
    float blob = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float ang = fi * 1.2566 + uTime * 0.08 + uSeed;
      float rad = 0.14 + 0.05 * sin(uTime * 0.12 + fi) + uBass * 0.08;
      vec2 c = vec2(cos(ang), sin(ang)) * rad;
      float d = length(p - c);
      float w = 0.11 + uRms * 0.05;
      blob += smoothstep(w, 0.0, d);
    }
    ink = blob * 0.45;
  } else if (uDraw < 1.5) {
    float ring = abs(r - (0.24 + uBass * 0.08));
    ink = smoothstep(0.07, 0.0, ring) * (0.35 + energy);
  } else if (uDraw < 2.5) {
    float sweep = abs(fract(a / 6.28318 - uTime * 0.04) - 0.5);
    ink = smoothstep(0.08, 0.0, sweep - 0.42) * (0.3 + energy);
    ink += smoothstep(0.05, 0.0, abs(r - 0.32)) * 0.2;
  } else if (uDraw < 3.5) {
    vec2 g = fract(p * 10.0) - 0.5;
    ink = smoothstep(0.16, 0.02, length(g)) * (0.12 + uBass * 0.25);
  } else if (uDraw < 4.5) {
    float burst = 0.0;
    for (int i = 0; i < 5; i++) {
      float ang = float(i) * 1.2566 + uTime * 0.12;
      vec2 dir = vec2(cos(ang), sin(ang));
      float proj = clamp(dot(p, dir), 0.0, 0.5);
      burst += smoothstep(0.035, 0.0, length(p - dir * proj));
    }
    ink = burst * (0.2 + energy * 0.35);
  } else if (uDraw < 5.5) {
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    ink = smoothstep(0.08, 0.0, edge) * (0.2 + energy * 0.4);
  } else if (uDraw < 6.5) {
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    ink = smoothstep(0.07, 0.0, edge) * (0.18 + uMid * 0.35);
  } else if (uDraw < 7.5) {
    vec2 gp = p * 6.0;
    vec2 f = fract(gp) - 0.5;
    float n = fract(sin(dot(floor(gp), vec2(12.7, 78.2)) + uSeed) * 43758.5);
    ink = smoothstep(0.12, 0.0, length(f)) * n * (0.12 + uTreble * 0.3);
  } else if (uDraw < 8.5) {
    float h = 0.15 + uBass * 0.35 + uRms * 0.2;
    ink = smoothstep(h + 0.08, h, 1.0 - uv.y) * h * 0.35;
  } else if (uDraw < 9.5) {
    float smoke = 0.5 + 0.5 * sin(r * 4.0 - uTime * 0.2 + a);
    ink = smoke * smoothstep(0.65, 0.12, r) * (0.18 + energy * 0.3);
  } else if (uDraw < 10.5) {
    float ribbon = sin(p.x * 2.4 + uTime * 0.2) * (0.08 + uMid * 0.06);
    ink = smoothstep(0.05, 0.0, abs(p.y - ribbon)) * (0.28 + energy * 0.25);
  } else if (uDraw < 11.5) {
    float w = waveAt(uv.x) * (0.12 + uRms * 0.1);
    ink = smoothstep(0.04, 0.0, abs(p.y - w)) * 0.3;
  } else if (uDraw < 12.5) {
    float h = 0.12 + uBass * 0.4;
    ink = (1.0 - uv.y < h) ? 0.22 * h : 0.0;
  } else if (uDraw < 13.5) {
    float wobble = 0.24 + uBass * 0.1;
    ink = smoothstep(0.04, 0.0, abs(r - wobble)) * 0.4;
  } else if (uDraw < 14.5) {
    vec2 q = rotate(p, 0.5);
    float facet = abs(sin(q.x * 6.0) * sin(q.y * 5.0));
    ink = pow(facet, 4.0) * (0.15 + uTreble * 0.2);
  } else {
    float lane = abs(p.y + 0.08 * sin(p.x * 2.0 + uTime * 0.15));
    ink = smoothstep(0.05, 0.0, lane) * (0.22 + energy * 0.25);
  }

  return ink;
}

void main() {
  vec2 uvShift = applyShift(vUv);
  vec3 prev = texture2D(tPrev, uvShift).rgb * uDecay;
  float ink = inject(vUv) * uInk;
  float look = clamp(0.22 + uHueShift * 0.12 + uBass * 0.08, 0.02, 0.98);
  vec3 inkCol = texture2D(tPalette, vec2(look, 0.5)).rgb;
  vec3 col = prev + inkCol * ink;
  col = max(col, vec3(0.0));
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}
`;

const COPY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tMap, vUv);
}
`;

function makeTarget(w: number, h: number): THREE.WebGLRenderTarget {
  const t = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  t.texture.colorSpace = THREE.NoColorSpace;
  return t;
}

export class FeedbackEngine {
  private renderer: THREE.WebGLRenderer;
  private ping: THREE.WebGLRenderTarget;
  private pong: THREE.WebGLRenderTarget;
  private scene: THREE.Scene;
  private copyScene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private copyMaterial: THREE.ShaderMaterial;
  private palette: THREE.DataTexture;
  private paletteKey = "";
  private lastRandomAt = -10;
  private inner: FeedbackPreset | null = null;
  private reduced = false;
  private time = 0;
  private flash = 0;
  private hue = 0;

  constructor(renderer: THREE.WebGLRenderer, audioTextures: AudioTextures) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.ping = makeTarget(size.x, size.y);
    this.pong = makeTarget(size.x, size.y);
    this.palette = makePaletteTexture(["#041018", "#1a6a8a", "#e8a04a", "#ff4d2a"]);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FEEDBACK_FRAG,
      uniforms: {
        tPrev: { value: this.pong.texture },
        tFreq: { value: audioTextures.freq },
        tWave: { value: audioTextures.wave },
        tPalette: { value: this.palette },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uRms: { value: 0 },
        uPeak: { value: 0 },
        uBeat: { value: 0 },
        uFlux: { value: 0 },
        uShift: { value: 0 },
        uDraw: { value: 0 },
        uDecay: { value: 0.96 },
        uHueShift: { value: 0 },
        uShiftStrength: { value: 1 },
        uInk: { value: 1 },
        uFlash: { value: 0 },
        uKaleidoSlices: { value: 6 },
        uSeed: { value: 0.3 },
        uPaletteLocked: { value: 1 },
        uAlive: { value: 0 },
        uIdle: { value: 0 },
        uDrift: { value: 0.2 },
        uPlaying: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COPY_FRAG,
      uniforms: { tMap: { value: this.ping.texture } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.PlaneGeometry(2, 2);
    this.scene = new THREE.Scene();
    this.copyScene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(quad, this.material));
    this.copyScene.add(new THREE.Mesh(quad.clone(), this.copyMaterial));
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  resize(w: number, h: number): void {
    this.ping.setSize(w, h);
    this.pong.setSize(w, h);
    (this.material.uniforms.uResolution!.value as THREE.Vector2).set(w, h);
  }

  private pickInner(preset: FeedbackPreset, all: FeedbackPreset[], dt: number): FeedbackPreset {
    const isRandom = preset.id === "random" || preset.id === "randomization";
    if (!isRandom) {
      this.inner = preset;
      return preset;
    }
    if (this.reduced) {
      const first = all.find((p) => p.id !== "random" && p.id !== "randomization");
      this.inner = first ?? preset;
      return this.inner;
    }
    this.lastRandomAt += dt;
    const should = !this.inner || this.lastRandomAt > 14;
    if (should) {
      const pool = all.filter((p) => p.id !== "random" && p.id !== "randomization");
      if (pool.length > 0) {
        this.inner = pool[Math.floor(Math.random() * pool.length)] ?? preset;
        this.lastRandomAt = 0;
      }
    }
    return this.inner ?? preset;
  }

  frame(
    audio: AudioFrame,
    preset: FeedbackPreset,
    catalog: FeedbackPreset[],
    dt: number,
    color: ColorSettings,
  ): void {
    const inner = this.pickInner(preset, catalog, audio.playing ? dt : 0);
    // Follow real activity — no 0.85 floor (that kept quiet sections half-lit).
    const alive = audio.playing ? audio.activity : audio.activity * 0.35;
    this.time += dt * (this.reduced ? 0.2 : audio.playing ? 1 : 0.15);
    if (audio.beat.isBeat && audio.playing) {
      this.flash = Math.min(1, this.flash * 0.4 + 0.85);
    } else {
      this.flash *= Math.exp(-6 * dt);
      if (this.flash < 0.01) this.flash = 0;
    }
    if (audio.playing) {
      const hueRate = inner.paletteLocked ? inner.hueSpeed * 0.08 : inner.hueSpeed * 0.35;
      this.hue += hueRate * dt * (0.55 + alive * 0.9);
    }

    const resolved = resolvePalette(inner.palette, color);
    const key = `${color.theme}:${color.hue.toFixed(3)}:${resolved.join(",")}`;
    if (this.paletteKey !== key) {
      writePalette(this.palette, resolved);
      this.paletteKey = key;
    }

    let decay = inner.decay;
    let ink = inner.ink;
    let shift = inner.shiftStrength;
    if (!audio.playing) {
      decay = 0.88;
      ink = 0;
      shift = inner.shiftStrength * 0.08;
    } else {
      // Quiet → trails die; loud / beat → ink and warp punch hard.
      const gate = Math.pow(Math.max(0, alive), 1.2);
      decay = Math.min(0.972, inner.decay) * (0.9 + gate * 0.08);
      if (gate < 0.08) decay = Math.min(decay, 0.9);
      ink =
        inner.ink *
        gate *
        (0.35 + audio.rmsAtt * 0.45 + audio.bassAtt * 0.55 + audio.pulse * 0.65 + this.flash * 0.5);
      shift =
        inner.shiftStrength *
        (0.2 + gate * 0.55 + audio.bassAtt * 0.35 + audio.pulse * 0.4 + this.flash * 0.25);
    }
    if (this.reduced) {
      decay = Math.min(0.9, decay);
      shift *= 0.3;
      ink *= audio.playing ? 0.55 : 0;
    }

    const u = this.material.uniforms;
    u.tPrev!.value = this.pong.texture;
    u.uTime!.value = this.time;
    u.uBass!.value = audio.bassAtt;
    u.uMid!.value = audio.midAtt;
    u.uTreble!.value = audio.trebleAtt;
    u.uRms!.value = audio.rmsAtt;
    u.uPeak!.value = audio.peak * 0.55;
    u.uBeat!.value = Math.min(1, audio.pulse + this.flash * 0.5);
    u.uFlux!.value = audio.beat.flux * 0.55;
    u.uShift!.value = inner.shift;
    u.uDraw!.value = inner.draw;
    u.uDecay!.value = decay;
    u.uHueShift!.value = this.hue + color.hue;
    u.uShiftStrength!.value = shift;
    u.uInk!.value = ink;
    u.uFlash!.value = this.flash;
    u.uKaleidoSlices!.value = inner.kaleidoSlices;
    u.uSeed!.value = inner.seed;
    u.uPaletteLocked!.value = inner.paletteLocked ? 1 : 0;
    u.uAlive!.value = audio.playing ? alive : 0;
    u.uIdle!.value = 0;
    u.uDrift!.value = audio.playing ? (this.reduced ? 0.08 : 0.1 + alive * 0.14) : 0.03;
    u.uPlaying!.value = audio.playing ? 1 : 0;

    const prevAuto = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.renderer.setRenderTarget(this.ping);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.copyMaterial.uniforms.tMap!.value = this.ping.texture;
    this.renderer.render(this.copyScene, this.camera);
    this.renderer.autoClear = prevAuto;

    const swap = this.ping;
    this.ping = this.pong;
    this.pong = swap;
  }

  dispose(): void {
    this.ping.dispose();
    this.pong.dispose();
    this.palette.dispose();
    this.material.dispose();
    this.copyMaterial.dispose();
    this.scene.clear();
    this.copyScene.clear();
  }
}
