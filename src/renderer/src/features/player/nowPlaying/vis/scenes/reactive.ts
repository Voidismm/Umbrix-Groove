import * as THREE from "three";
import { logSpectrum } from "../../audio/features";
import type { AudioFrame } from "../../audio/features";
import { resolveHex, resolvePalette, type ColorSettings } from "../color";
import type { AnyPreset, ReactivePreset, VisContext, Visualization } from "../types";

const RING_COUNT = 8;
const RADIAL_COUNT = 64;
const MIRROR_N = 192;
const ORB_N = 96;
const LATTICE = 14;
const SHOCK_MAX = 6;

export function createReactive(): Visualization {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;

  let ringsGroup: THREE.Group | null = null;
  const ringMeshes: THREE.LineLoop[] = [];
  const ringMats: THREE.LineBasicMaterial[] = [];

  let radial: THREE.LineSegments | null = null;
  let radialPos: THREE.BufferAttribute | null = null;
  let radialCol: THREE.BufferAttribute | null = null;

  let mirror: THREE.Line | null = null;
  let mirrorPos: THREE.BufferAttribute | null = null;
  let mirrorMat: THREE.LineBasicMaterial | null = null;

  let orb: THREE.LineLoop | null = null;
  let orbPos: THREE.BufferAttribute | null = null;
  let orbMat: THREE.LineBasicMaterial | null = null;

  let lattice: THREE.InstancedMesh | null = null;
  let latticeMat: THREE.MeshBasicMaterial | null = null;
  const latticeDummy = new THREE.Object3D();
  const latticeH = new Float32Array(LATTICE * LATTICE);

  let shocks: THREE.LineLoop[] = [];
  let shockMats: THREE.LineBasicMaterial[] = [];
  const shockAge = new Float32Array(SHOCK_MAX);
  const shockRad = new Float32Array(SHOCK_MAX);
  let shockCursor = 0;
  let wasBeat = false;
  let spin = 0;
  let time = 0;

  const presets: ReactivePreset[] = [
    { id: "pulse-rings", name: "Pulse Rings", kind: "reactive", mode: "rings" },
    { id: "radial-burst", name: "Radial Burst", kind: "reactive", mode: "radial" },
    { id: "mirror-wave", name: "Mirror Wave", kind: "reactive", mode: "mirror" },
    { id: "bass-orb", name: "Bass Orb", kind: "reactive", mode: "orb" },
    { id: "beat-lattice", name: "Beat Lattice", kind: "reactive", mode: "lattice" },
    { id: "shockwave", name: "Shockwave", kind: "reactive", mode: "shockwave" },
  ];

  function setMode(mode: ReactivePreset["mode"]): void {
    if (ringsGroup) ringsGroup.visible = mode === "rings";
    if (radial) radial.visible = mode === "radial";
    if (mirror) mirror.visible = mode === "mirror";
    if (orb) orb.visible = mode === "orb";
    if (lattice) lattice.visible = mode === "lattice";
    for (const s of shocks) s.visible = mode === "shockwave";
  }

  return {
    id: "reactive",
    name: "Reactive",
    family: "reactive",
    era: "Groove",
    presets,
    mount(ctx: VisContext) {
      renderer = ctx.renderer;
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 0.62, -0.62, 0.1, 10);
      camera.position.z = 2;

      ringsGroup = new THREE.Group();
      for (let i = 0; i < RING_COUNT; i++) {
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array(64 * 3);
        for (let k = 0; k < 64; k++) {
          const a = (k / 64) * Math.PI * 2;
          pts[k * 3] = Math.cos(a);
          pts[k * 3 + 1] = Math.sin(a);
          pts[k * 3 + 2] = 0;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0x3aa0c8,
          transparent: true,
          opacity: 0.85,
        });
        const loop = new THREE.LineLoop(geo, mat);
        ringMeshes.push(loop);
        ringMats.push(mat);
        ringsGroup.add(loop);
      }
      scene.add(ringsGroup);

      {
        const geo = new THREE.BufferGeometry();
        radialPos = new THREE.BufferAttribute(new Float32Array(RADIAL_COUNT * 2 * 3), 3);
        radialCol = new THREE.BufferAttribute(new Float32Array(RADIAL_COUNT * 2 * 3), 3);
        geo.setAttribute("position", radialPos);
        geo.setAttribute("color", radialCol);
        const mat = new THREE.LineBasicMaterial({ vertexColors: true });
        radial = new THREE.LineSegments(geo, mat);
        radial.visible = false;
        scene.add(radial);
      }

      {
        const geo = new THREE.BufferGeometry();
        mirrorPos = new THREE.BufferAttribute(new Float32Array(MIRROR_N * 3), 3);
        geo.setAttribute("position", mirrorPos);
        mirrorMat = new THREE.LineBasicMaterial({ color: 0x9ad4e8 });
        mirror = new THREE.Line(geo, mirrorMat);
        mirror.visible = false;
        scene.add(mirror);
      }

      {
        const geo = new THREE.BufferGeometry();
        orbPos = new THREE.BufferAttribute(new Float32Array(ORB_N * 3), 3);
        geo.setAttribute("position", orbPos);
        orbMat = new THREE.LineBasicMaterial({ color: 0xe8a04a });
        orb = new THREE.LineLoop(geo, orbMat);
        orb.visible = false;
        scene.add(orb);
      }

      {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0);
        latticeMat = new THREE.MeshBasicMaterial({ color: 0x2ec4c8 });
        lattice = new THREE.InstancedMesh(geo, latticeMat, LATTICE * LATTICE);
        lattice.frustumCulled = false;
        lattice.visible = false;
        scene.add(lattice);
      }

      shocks = [];
      shockMats = [];
      for (let i = 0; i < SHOCK_MAX; i++) {
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array(72 * 3);
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          pts[k * 3] = Math.cos(a);
          pts[k * 3 + 1] = Math.sin(a);
          pts[k * 3 + 2] = 0;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0xff6a2a,
          transparent: true,
          opacity: 0,
        });
        const loop = new THREE.LineLoop(geo, mat);
        loop.visible = false;
        shocks.push(loop);
        shockMats.push(mat);
        scene.add(loop);
        shockAge[i] = 0;
        shockRad[i] = 0;
      }
    },
    frame(audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) {
      if (!renderer || !scene || !camera || preset.kind !== "reactive") return;
      setMode(preset.mode);
      time += dt;
      const alive = audio.activity;
      const beatKick = audio.playing
        ? 1 + audio.pulse * 0.75 + (audio.beat.isBeat ? 0.55 : 0)
        : 1;
      const pal = resolvePalette(
        ["#041018", "#1a6a8a", "#3aa0c8", "#e8a04a", "#ff6a2a", "#f4e4c4"],
        color,
      );
      const accent = new THREE.Color(resolveHex("#3aa0c8", color));
      const hot = new THREE.Color(pal[3] ?? "#e8a04a");
      const deep = new THREE.Color(pal[0] ?? "#041018");

      if (audio.beat.isBeat && !wasBeat && audio.playing) {
        shockAge[shockCursor] = 1;
        shockRad[shockCursor] = 0.08 + audio.bassAtt * 0.06;
        shockCursor = (shockCursor + 1) % SHOCK_MAX;
      }
      wasBeat = audio.beat.isBeat;

      if (preset.mode === "rings" && ringsGroup) {
        spin += dt * (0.35 + audio.bassAtt * 1.2 + audio.pulse * 0.8) * beatKick;
        ringsGroup.rotation.z = spin * 0.15;
        for (let i = 0; i < RING_COUNT; i++) {
          const t = i / (RING_COUNT - 1);
          const spec = logSpectrum(audio.freq, t);
          const base = 0.08 + t * 0.42;
          const pulse =
            base *
            (0.55 + alive * 0.35) *
            (1 + audio.bassAtt * 0.55 * (1 - t) + audio.pulse * 0.4 + spec * 0.85);
          const mesh = ringMeshes[i];
          const mat = ringMats[i];
          if (!mesh || !mat) continue;
          mesh.scale.set(pulse, pulse * 0.72, 1);
          const c = deep.clone().lerp(accent, t * 0.55).lerp(hot, audio.pulse * 0.45 + spec * 0.35);
          mat.color.copy(c);
          mat.opacity = Math.max(0.02, alive * (0.35 + (1 - t) * 0.55 + audio.pulse * 0.35));
        }
      }

      if (preset.mode === "radial" && radial && radialPos && radialCol) {
        spin += dt * (0.2 + audio.bassAtt * 0.5) * beatKick;
        const pos = radialPos.array as Float32Array;
        const col = radialCol.array as Float32Array;
        for (let i = 0; i < RADIAL_COUNT; i++) {
          const t = i / RADIAL_COUNT;
          const a = t * Math.PI * 2 - Math.PI / 2 + spin * 0.4;
          const raw = Math.min(1, logSpectrum(audio.freq, t) * 1.35 * beatKick);
          const inner = 0.06;
          const outer = 0.1 + raw * 0.72 * Math.max(0.02, alive);
          const i2 = i * 6;
          pos[i2] = Math.cos(a) * inner;
          pos[i2 + 1] = Math.sin(a) * inner * 0.72;
          pos[i2 + 2] = 0;
          pos[i2 + 3] = Math.cos(a) * outer;
          pos[i2 + 4] = Math.sin(a) * outer * 0.72;
          pos[i2 + 5] = 0;
          const c = accent.clone().lerp(hot, raw * 0.7 + audio.pulse * 0.3);
          col[i2] = deep.r;
          col[i2 + 1] = deep.g;
          col[i2 + 2] = deep.b;
          col[i2 + 3] = c.r;
          col[i2 + 4] = c.g;
          col[i2 + 5] = c.b;
        }
        radialPos.needsUpdate = true;
        radialCol.needsUpdate = true;
      }

      if (preset.mode === "mirror" && mirror && mirrorPos && mirrorMat) {
        const arr = mirrorPos.array as Float32Array;
        const amp = 0.38 * Math.max(0.02, alive) * beatKick;
        const n = MIRROR_N;
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 1.9 - 0.95;
          const src = Math.floor((i / n) * audio.time.length);
          const v = audio.time[src] ?? 0;
          const wobble = Math.sin(x * 6 + time * 4 + audio.bassAtt * 3) * audio.pulse * 0.04;
          arr[i * 3] = x;
          arr[i * 3 + 1] = v * amp + wobble;
          arr[i * 3 + 2] = 0;
        }
        mirrorPos.needsUpdate = true;
        mirrorMat.color.copy(accent.clone().lerp(hot, audio.pulse));
        mirrorMat.opacity = Math.max(0.05, alive);
        mirrorMat.transparent = true;
      }

      if (preset.mode === "orb" && orb && orbPos && orbMat) {
        const arr = orbPos.array as Float32Array;
        const baseR =
          (0.18 + audio.rmsAtt * 0.22 + audio.bassAtt * 0.28 + audio.pulse * 0.2) *
          Math.max(0.08, alive) *
          beatKick;
        for (let i = 0; i < ORB_N; i++) {
          const t = i / ORB_N;
          const a = t * Math.PI * 2 + time * (0.4 + audio.midAtt);
          const spec = logSpectrum(audio.freq, t);
          const r = baseR * (0.75 + spec * 0.9 + Math.sin(a * 3 + time * 5) * audio.trebleAtt * 0.12);
          arr[i * 3] = Math.cos(a) * r;
          arr[i * 3 + 1] = Math.sin(a) * r * 0.78;
          arr[i * 3 + 2] = 0;
        }
        orbPos.needsUpdate = true;
        orbMat.color.copy(hot.clone().lerp(accent, 1 - audio.bassAtt));
      }

      if (preset.mode === "lattice" && lattice && latticeMat) {
        const fall = audio.playing ? (alive < 0.1 ? 11 : 7.5) : 2;
        let i = 0;
        for (let y = 0; y < LATTICE; y++) {
          for (let x = 0; x < LATTICE; x++) {
            const t = (x + y) / (2 * (LATTICE - 1));
            const raw = Math.min(1, logSpectrum(audio.freq, t) * 1.4 * beatKick);
            const prev = latticeH[i] ?? 0;
            const target = raw * Math.max(0.01, alive);
            latticeH[i] = target > prev ? target : prev * Math.exp(-fall * dt);
            const h = Math.max(0.01, (latticeH[i] ?? 0) * 0.9);
            const px = (x / (LATTICE - 1) - 0.5) * 1.7;
            const pz = (y / (LATTICE - 1) - 0.5) * 1.05;
            latticeDummy.position.set(px, -0.45, pz);
            latticeDummy.scale.set(0.08, h, 0.08);
            latticeDummy.rotation.set(0, 0, 0);
            latticeDummy.updateMatrix();
            lattice.setMatrixAt(i, latticeDummy.matrix);
            i++;
          }
        }
        lattice.instanceMatrix.needsUpdate = true;
        latticeMat.color.copy(accent.clone().lerp(hot, audio.pulse * 0.6 + audio.bassAtt * 0.3));
      }

      if (preset.mode === "shockwave") {
        for (let i = 0; i < SHOCK_MAX; i++) {
          const loop = shocks[i];
          const mat = shockMats[i];
          if (!loop || !mat) continue;
          if (shockAge[i]! <= 0) {
            loop.visible = false;
            continue;
          }
          loop.visible = true;
          shockAge[i]! -= dt * (1.1 + (1 - alive) * 0.8);
          shockRad[i]! += dt * (0.55 + audio.rmsAtt * 0.8 + audio.pulse * 0.5);
          const r = shockRad[i]!;
          const age = Math.max(0, shockAge[i]!);
          loop.scale.set(r, r * 0.72, 1);
          mat.opacity = age * Math.max(0.05, alive) * (0.5 + audio.pulse * 0.5);
          mat.color.copy(hot.clone().lerp(accent, 1 - age));
        }
        // Soft radial fill under shocks so quiet does not look empty mid-phrase.
        if (radial && radialPos && radialCol) {
          radial.visible = true;
          const pos = radialPos.array as Float32Array;
          const col = radialCol.array as Float32Array;
          for (let i = 0; i < RADIAL_COUNT; i++) {
            const t = i / RADIAL_COUNT;
            const a = t * Math.PI * 2 - Math.PI / 2;
            const raw = Math.min(1, logSpectrum(audio.freq, t) * 1.2 * beatKick);
            const outer = 0.08 + raw * 0.45 * Math.max(0.02, alive);
            const i2 = i * 6;
            pos[i2] = 0;
            pos[i2 + 1] = 0;
            pos[i2 + 2] = 0;
            pos[i2 + 3] = Math.cos(a) * outer;
            pos[i2 + 4] = Math.sin(a) * outer * 0.72;
            pos[i2 + 5] = 0;
            const c = accent.clone().lerp(hot, raw);
            col[i2] = deep.r * 0.4;
            col[i2 + 1] = deep.g * 0.4;
            col[i2 + 2] = deep.b * 0.4;
            col[i2 + 3] = c.r;
            col[i2 + 4] = c.g;
            col[i2 + 5] = c.b;
          }
          radialPos.needsUpdate = true;
          radialCol.needsUpdate = true;
        }
      } else if (radial && preset.mode !== "radial") {
        radial.visible = false;
      }

      renderer.render(scene, camera);
    },
    resize() {},
    dispose() {
      for (const m of ringMeshes) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      ringMeshes.length = 0;
      ringMats.length = 0;
      radial?.geometry.dispose();
      (radial?.material as THREE.Material | undefined)?.dispose();
      mirror?.geometry.dispose();
      mirrorMat?.dispose();
      orb?.geometry.dispose();
      orbMat?.dispose();
      lattice?.geometry.dispose();
      latticeMat?.dispose();
      for (const s of shocks) {
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      }
      shocks = [];
      shockMats = [];
      scene?.clear();
      ringsGroup = null;
      radial = null;
      mirror = null;
      orb = null;
      lattice = null;
      scene = null;
      camera = null;
      renderer = null;
    },
  };
}
