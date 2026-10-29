import * as THREE from "three";
import type { AudioFrame } from "../../audio/features";
import { resolvePalette, type ColorSettings } from "../color";
import type { AnyPreset, ParticlePreset, VisContext, Visualization } from "../types";

const N = 22;

export function createParticle(): Visualization {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let points: THREE.Points | null = null;
  let pos: THREE.BufferAttribute | null = null;
  let group: THREE.Group | null = null;
  let colAttr: THREE.BufferAttribute | null = null;
  let pointsMat: THREE.PointsMaterial | null = null;
  let angle = 0;
  let time = 0;
  const heights = new Float32Array(N * N);

  const baseColors = ["#c43b3b", "#7a3cb8", "#2d6cdf", "#2ec4c8"];

  const presets: ParticlePreset[] = [
    { id: "particle", name: "Particle", kind: "particle", rotate: false },
    { id: "rotating-particle", name: "Rotating Particle", kind: "particle", rotate: true },
  ];

  return {
    id: "particle",
    name: "Particle",
    family: "bars-and-waves",
    era: "WMP 7–10",
    presets,
    mount(ctx: VisContext) {
      renderer = ctx.renderer;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
      camera.position.set(0, 0.9, 4.2);
      camera.lookAt(0, 0, 0);
      group = new THREE.Group();
      scene.add(group);

      const count = N * N;
      const positions = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);
      const c = new THREE.Color();
      let i = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          positions[i * 3] = (x / (N - 1) - 0.5) * 3.2;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = (y / (N - 1) - 0.5) * 3.2;
          c.set(baseColors[(x + y) % baseColors.length]!);
          cols[i * 3] = c.r;
          cols[i * 3 + 1] = c.g;
          cols[i * 3 + 2] = c.b;
          i++;
        }
      }
      const geo = new THREE.BufferGeometry();
      pos = new THREE.BufferAttribute(positions, 3);
      geo.setAttribute("position", pos);
      colAttr = new THREE.BufferAttribute(cols, 3);
      geo.setAttribute("color", colAttr);
      pointsMat = new THREE.PointsMaterial({
        size: 0.07,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
      });
      points = new THREE.Points(geo, pointsMat);
      group.add(points);
    },
    frame(audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) {
      if (!renderer || !scene || !camera || !pos || !group || preset.kind !== "particle") return;
      const arr = pos.array as Float32Array;
      const bins = audio.freq;
      const alive = audio.activity;
      const beatKick = audio.playing ? 1 + audio.pulse * 0.6 + (audio.beat.isBeat ? 0.4 : 0) : 1;
      time += dt;
      const pal = resolvePalette(baseColors, color);
      if (colAttr) {
        const cols = colAttr.array as Float32Array;
        const c = new THREE.Color();
        let k = 0;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            c.set(pal[(x + y) % pal.length] ?? "#2ec4c8");
            cols[k * 3] = c.r;
            cols[k * 3 + 1] = c.g;
            cols[k * 3 + 2] = c.b;
            k++;
          }
        }
        colAttr.needsUpdate = true;
      }
      const fall = audio.playing ? (alive < 0.1 ? 10 : 7.2) : 1.7;
      let i = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const t = (x + y) / (2 * (N - 1));
          const idx = Math.floor(t * t * (bins.length - 1));
          const v = (bins[idx] ?? 0) / 255;
          const wave =
            Math.sin(x * 0.45 + time * 1.4 + audio.bassAtt * 2.8) *
            Math.cos(y * 0.4 + time * 1.1) *
            (0.04 + audio.rmsAtt * 0.55 + audio.pulse * 0.25) *
            alive;
          const target = audio.playing
            ? (v * 1.45 + wave) * Math.max(0.01, alive) * beatKick
            : (heights[i] ?? 0) * 0.94;
          const prev = heights[i] ?? 0;
          heights[i] = target > prev ? target : prev * Math.exp(-fall * dt);
          arr[i * 3 + 1] = heights[i] ?? 0;
          i++;
        }
      }
      pos.needsUpdate = true;
      if (pointsMat) {
        pointsMat.size = 0.03 + 0.07 * alive * beatKick;
        pointsMat.opacity = Math.max(0.02, alive);
      }
      if (preset.rotate) {
        angle +=
          dt *
          (0.15 + audio.bassAtt * 0.4 + audio.pulse * 0.25) *
          (audio.playing ? beatKick : Math.max(0.08, alive));
        group.rotation.y = angle;
      } else {
        group.rotation.y += dt * 0.05 * alive * beatKick;
      }
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      camera.aspect = size.x / Math.max(1, size.y);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    resize() {},
    dispose() {
      points?.geometry.dispose();
      (points?.material as THREE.Material | undefined)?.dispose();
      scene?.clear();
      points = null;
      group = null;
      scene = null;
      camera = null;
      renderer = null;
    },
  };
}
