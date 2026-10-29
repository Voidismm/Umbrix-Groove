import * as THREE from "three";
import { logSpectrum } from "../../audio/features";
import type { AudioFrame } from "../../audio/features";
import { resolveHex, type ColorSettings } from "../color";
import type { AnyPreset, SpikesPreset, VisContext, Visualization } from "../types";

const COUNT = 72;

export function createSpikes(): Visualization {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let lines: THREE.LineSegments | null = null;
  let amoeba: THREE.LineLoop | null = null;
  let linePos: THREE.BufferAttribute | null = null;
  let amoebaPos: THREE.BufferAttribute | null = null;
  let lineColor: THREE.BufferAttribute | null = null;
  let amoebaMat: THREE.LineBasicMaterial | null = null;
  const smooth = new Float32Array(COUNT);
  let spin = 0;

  const presets: SpikesPreset[] = [
    { id: "spike", name: "Spike", kind: "spikes", mode: "spike", hue: 0.13 },
    { id: "amoeba", name: "Amoeba", kind: "spikes", mode: "amoeba", hue: 0.16 },
  ];

  return {
    id: "spikes",
    name: "Spikes",
    family: "bars-and-waves",
    era: "WMP 7–10",
    presets,
    mount(ctx: VisContext) {
      renderer = ctx.renderer;
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 2;

      const lg = new THREE.BufferGeometry();
      linePos = new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3);
      lineColor = new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3);
      lg.setAttribute("position", linePos);
      lg.setAttribute("color", lineColor);
      lines = new THREE.LineSegments(
        lg,
        new THREE.LineBasicMaterial({ vertexColors: true }),
      );
      scene.add(lines);

      const ag = new THREE.BufferGeometry();
      amoebaPos = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
      ag.setAttribute("position", amoebaPos);
      amoebaMat = new THREE.LineBasicMaterial({ color: 0xd4e04a });
      amoeba = new THREE.LineLoop(ag, amoebaMat);
      scene.add(amoeba);
    },
    frame(audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) {
      if (!renderer || !scene || !camera || preset.kind !== "spikes") return;
      const spike = preset.mode === "spike";
      const alive = audio.activity;
      const beatKick = audio.playing ? 1 + audio.pulse * 0.65 + (audio.beat.isBeat ? 0.4 : 0) : 1;
      if (lines) lines.visible = spike;
      if (amoeba) amoeba.visible = !spike;
      spin += dt * (0.1 + audio.bassAtt * 0.35 + audio.pulse * 0.2) * (audio.playing ? beatKick : alive);

      const fall = audio.playing ? (alive < 0.1 ? 8.5 : 5.2) : 1.5;
      for (let i = 0; i < COUNT; i++) {
        const t = i / COUNT;
        const raw = Math.min(1, logSpectrum(audio.freq, t) * 1.25 * beatKick);
        const prev = smooth[i] ?? 0;
        smooth[i] = raw > prev ? raw : prev * Math.exp(-fall * dt);
      }

      const accent = resolveHex("#e8c04a", color);
      const c = new THREE.Color(accent);
      const c2 = c.clone().offsetHSL(0.04, -0.1, 0.18);
      amoebaMat?.color.copy(c);

      if (spike && linePos && lineColor) {
        const pos = linePos.array as Float32Array;
        const col = lineColor.array as Float32Array;
        for (let i = 0; i < COUNT; i++) {
          const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2 + spin;
          const inner = 0.1;
          const outer = 0.12 + (smooth[i] ?? 0) * 0.95 * Math.max(0.02, alive);
          const i2 = i * 6;
          pos[i2] = Math.cos(a) * inner;
          pos[i2 + 1] = Math.sin(a) * inner;
          pos[i2 + 2] = 0;
          pos[i2 + 3] = Math.cos(a) * outer;
          pos[i2 + 4] = Math.sin(a) * outer;
          pos[i2 + 5] = 0;
          col[i2] = c.r;
          col[i2 + 1] = c.g;
          col[i2 + 2] = c.b;
          col[i2 + 3] = c2.r;
          col[i2 + 4] = c2.g;
          col[i2 + 5] = c2.b;
        }
        linePos.needsUpdate = true;
        lineColor.needsUpdate = true;
      }

      if (!spike && amoebaPos) {
        const pos = amoebaPos.array as Float32Array;
        for (let i = 0; i < COUNT; i++) {
          const a = (i / COUNT) * Math.PI * 2 + spin * 0.6;
          const i0 = (i + COUNT - 1) % COUNT;
          const i1 = (i + 1) % COUNT;
          const sm = ((smooth[i0] ?? 0) + (smooth[i] ?? 0) + (smooth[i1] ?? 0)) / 3;
          const wobble = 0.05 * Math.sin(a * 3.0 + spin * 4.0) * alive * beatKick;
          const r =
            (0.18 + sm * 0.7 + audio.bassAtt * 0.14 + audio.pulse * 0.1 + wobble) *
            Math.max(0.04, alive);
          pos[i * 3] = Math.cos(a) * r;
          pos[i * 3 + 1] = Math.sin(a) * r;
          pos[i * 3 + 2] = 0;
        }
        amoebaPos.needsUpdate = true;
      }

      renderer.render(scene, camera);
    },
    resize() {},
    dispose() {
      lines?.geometry.dispose();
      (lines?.material as THREE.Material | undefined)?.dispose();
      amoeba?.geometry.dispose();
      (amoeba?.material as THREE.Material | undefined)?.dispose();
      scene?.clear();
      lines = null;
      amoeba = null;
      scene = null;
      camera = null;
      renderer = null;
    },
  };
}
