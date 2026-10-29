import * as THREE from "three";
import { logSpectrum } from "../../audio/features";
import type { AudioFrame } from "../../audio/features";
import { resolveHex, resolvePalette, type ColorSettings } from "../color";
import type { AnyPreset, BarsPreset, VisContext, Visualization } from "../types";

const BAR_COUNT = 48;

const SPECTRUM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SPECTRUM_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tFreq;
uniform float uMode;
uniform float uTime;
uniform float uBass;
uniform float uAlive;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHot;
varying vec2 vUv;

float spec(float x) {
  float t = pow(clamp(x, 0.0, 1.0), 1.15);
  return texture2D(tFreq, vec2(t, 0.5)).r * uAlive;
}

void main() {
  float scroll = vUv.x + uTime * 0.03 * uAlive;
  float h1 = spec(fract(scroll));
  float h2 = spec(fract(scroll + 0.02)) * 0.72 + spec(fract(scroll)) * 0.28;
  float h3 = spec(fract(scroll * 0.85 + 0.05)) * 0.5;
  float y = vUv.y;
  vec3 col = uDeep * 0.35;

  if (uMode < 0.5) {
    float m1 = smoothstep(h1 + 0.02, h1 - 0.02, y);
    float m2 = smoothstep(h2 + 0.03, h2, y) * 0.65;
    float m3 = smoothstep(h3 + 0.04, h3, y) * 0.4;
    col = mix(uDeep, uMid, m3);
    col = mix(col, uMid, m2);
    col = mix(col, uHot, m1 * (0.55 + uBass * 0.18));
    col += uMid * (1.0 - y) * 0.15;
  } else {
    float m1 = smoothstep(h1 + 0.02, h1 - 0.015, y);
    float m2 = smoothstep(h2 + 0.04, h2, y);
    col = mix(uDeep, uMid, m2);
    col = mix(col, uHot, m1);
    col = mix(col, vec3(1.0, 0.92, 0.72), m1 * h1 * h1 * 0.65);
  }
  col *= max(0.04, uAlive);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createBarsAndWaves(): Visualization {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let bars: THREE.InstancedMesh | null = null;
  let caps: THREE.InstancedMesh | null = null;
  let scope: THREE.Line | null = null;
  let scopePos: THREE.BufferAttribute | null = null;
  let mountains: THREE.Mesh | null = null;
  let mountainMat: THREE.ShaderMaterial | null = null;
  const dummy = new THREE.Object3D();
  const peaks = new Float32Array(BAR_COUNT);
  const levels = new Float32Array(BAR_COUNT);
  let freqTex: THREE.DataTexture | null = null;
  let barMat: THREE.MeshBasicMaterial | null = null;
  let capMat: THREE.MeshBasicMaterial | null = null;
  let scopeMat: THREE.LineBasicMaterial | null = null;

  const presets: BarsPreset[] = [
    { id: "bars", name: "Bars", kind: "bars", mode: "bars" },
    { id: "ocean-mist", name: "Ocean Mist", kind: "bars", mode: "ocean" },
    { id: "fire-storm", name: "Fire Storm", kind: "bars", mode: "fire" },
    { id: "scope", name: "Scope", kind: "bars", mode: "scope" },
  ];

  return {
    id: "bars-and-waves",
    name: "Bars and Waves",
    family: "bars-and-waves",
    era: "WMP 7–12",
    presets,
    mount(ctx: VisContext) {
      renderer = ctx.renderer;
      freqTex = ctx.audioTextures.freq;
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 0.62, -0.62, 0.1, 10);
      camera.position.z = 2;

      const barGeo = new THREE.BoxGeometry(1, 1, 1);
      barGeo.translate(0, 0.5, 0);
      barMat = new THREE.MeshBasicMaterial({ color: 0x3aa0c8 });
      bars = new THREE.InstancedMesh(barGeo, barMat, BAR_COUNT);
      bars.frustumCulled = false;
      scene.add(bars);

      const capGeo = new THREE.BoxGeometry(1, 1, 1);
      capMat = new THREE.MeshBasicMaterial({ color: 0xe8a04a });
      caps = new THREE.InstancedMesh(capGeo, capMat, BAR_COUNT);
      caps.frustumCulled = false;
      scene.add(caps);

      const scopeGeo = new THREE.BufferGeometry();
      const pts = new Float32Array(256 * 3);
      scopePos = new THREE.BufferAttribute(pts, 3);
      scopeGeo.setAttribute("position", scopePos);
      scopeMat = new THREE.LineBasicMaterial({ color: 0x9ad4e8 });
      scope = new THREE.Line(scopeGeo, scopeMat);
      scope.visible = false;
      scene.add(scope);

      mountainMat = new THREE.ShaderMaterial({
        vertexShader: SPECTRUM_VERT,
        fragmentShader: SPECTRUM_FRAG,
        uniforms: {
          tFreq: { value: freqTex },
          uMode: { value: 0 },
          uTime: { value: 0 },
          uBass: { value: 0 },
          uAlive: { value: 0 },
          uDeep: { value: new THREE.Color("#041018") },
          uMid: { value: new THREE.Color("#1a6a8a") },
          uHot: { value: new THREE.Color("#d5f4f2") },
        },
        depthTest: false,
      });
      mountains = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mountainMat);
      mountains.visible = false;
      scene.add(mountains);
    },
    frame(audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) {
      if (!renderer || !scene || !camera || preset.kind !== "bars") return;
      const mode = preset.mode;
      const alive = audio.activity;
      const beatKick = audio.playing ? 1 + audio.pulse * 0.55 + (audio.beat.isBeat ? 0.35 : 0) : 1;
      if (bars) bars.visible = mode === "bars";
      if (caps) caps.visible = mode === "bars";
      if (scope) scope.visible = mode === "scope";
      if (mountains) mountains.visible = mode === "ocean" || mode === "fire";

      const barHex = resolveHex("#3aa0c8", color);
      const capHex = resolveHex("#e8a04a", color);
      barMat?.color.set(barHex);
      capMat?.color.set(capHex);
      scopeMat?.color.set(resolveHex("#9ad4e8", color));

      if (mode === "bars" && bars && caps) {
        const fall = audio.playing ? (alive < 0.1 ? 9.5 : 6.2) : 1.6;
        for (let i = 0; i < BAR_COUNT; i++) {
          const t = i / (BAR_COUNT - 1);
          const raw = Math.min(1, logSpectrum(audio.freq, t) * 1.35);
          const target = Math.pow(raw, 1.15) * beatKick;
          const prev = levels[i] ?? 0;
          const next = target > prev ? target : prev * Math.exp(-fall * dt);
          levels[i] = next;
          const pk = peaks[i] ?? 0;
          peaks[i] = target > pk ? target : pk - dt * (audio.playing ? 0.35 : 0.12);
          const h = Math.max(0.002, next * 1.25) * Math.max(0.01, alive);
          const x = (i / (BAR_COUNT - 1)) * 1.86 - 0.93;
          const w = 1.72 / BAR_COUNT;
          dummy.position.set(x, -0.55, 0);
          dummy.scale.set(w * 0.78, h, 0.2);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          bars.setMatrixAt(i, dummy.matrix);
          dummy.position.set(x, -0.55 + (peaks[i] ?? 0) * 1.25 * alive + 0.01, 0);
          dummy.scale.set(w * 0.78, 0.01, 0.2);
          dummy.updateMatrix();
          caps.setMatrixAt(i, dummy.matrix);
        }
        bars.instanceMatrix.needsUpdate = true;
        caps.instanceMatrix.needsUpdate = true;
      }

      if (mode === "scope" && scope && scopePos) {
        const arr = scopePos.array as Float32Array;
        const n = 256;
        const amp = 0.55 * Math.max(0.02, alive) * beatKick;
        for (let i = 0; i < n; i++) {
          const src = Math.floor((i / n) * audio.time.length);
          const v = audio.time[src] ?? 0;
          arr[i * 3] = (i / (n - 1)) * 1.9 - 0.95;
          arr[i * 3 + 1] = v * amp;
          arr[i * 3 + 2] = 0;
        }
        scopePos.needsUpdate = true;
      }

      if ((mode === "ocean" || mode === "fire") && mountainMat) {
        const pal = resolvePalette(
          mode === "fire"
            ? ["#100404", "#e05018", "#ffd080"]
            : ["#041018", "#1a6a8a", "#d5f4f2"],
          color,
        );
        mountainMat.uniforms.uMode!.value = mode === "fire" ? 1 : 0;
        mountainMat.uniforms.uTime!.value += audio.playing ? dt : 0;
        mountainMat.uniforms.uBass!.value = audio.bassAtt;
        mountainMat.uniforms.uAlive!.value = alive;
        (mountainMat.uniforms.uDeep!.value as THREE.Color).set(pal[0] ?? "#041018");
        (mountainMat.uniforms.uMid!.value as THREE.Color).set(pal[1] ?? "#1a6a8a");
        (mountainMat.uniforms.uHot!.value as THREE.Color).set(pal[2] ?? "#d5f4f2");
      }

      renderer.render(scene, camera);
    },
    resize() {
      /* ortho scene is NDC-sized */
    },
    dispose() {
      bars?.geometry.dispose();
      (bars?.material as THREE.Material | undefined)?.dispose();
      caps?.geometry.dispose();
      (caps?.material as THREE.Material | undefined)?.dispose();
      scope?.geometry.dispose();
      (scope?.material as THREE.Material | undefined)?.dispose();
      mountains?.geometry.dispose();
      mountainMat?.dispose();
      scene?.clear();
      bars = null;
      caps = null;
      scope = null;
      mountains = null;
      scene = null;
      camera = null;
      renderer = null;
    },
  };
}
