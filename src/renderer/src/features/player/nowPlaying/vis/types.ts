import type { WebGLRenderer } from "three";
import type { AudioFrame } from "../audio/features";
import type { ColorSettings } from "./color";
import type { AudioTextures } from "./renderer/audioTextures";

export type VisFamily =
  | "ambience"
  | "bars-and-waves"
  | "musical-colors"
  | "reactive"
  | "milkdrop";

export type VisEngine = "three" | "butterchurn";

export interface Preset {
  id: string;
  name: string;
}

export interface FeedbackPreset extends Preset {
  kind: "feedback";
  shift: number;
  draw: number;
  decay: number;
  paletteLocked: boolean;
  palette: string[];
  hueSpeed: number;
  shiftStrength: number;
  ink: number;
  flashOnBeat: boolean;
  kaleidoSlices: number;
  seed: number;
}

export interface BarsPreset extends Preset {
  kind: "bars";
  mode: "bars" | "ocean" | "fire" | "scope";
}

export interface SpikesPreset extends Preset {
  kind: "spikes";
  mode: "spike" | "amoeba";
  hue: number;
}

export interface ParticlePreset extends Preset {
  kind: "particle";
  rotate: boolean;
}

export interface ReactivePreset extends Preset {
  kind: "reactive";
  mode: "rings" | "radial" | "mirror" | "orb" | "lattice" | "shockwave";
}

export interface MilkdropPreset extends Preset {
  kind: "milkdrop";
  /** Original Butterchurn / Milkdrop preset key. */
  key: string;
}

export type AnyPreset =
  | FeedbackPreset
  | BarsPreset
  | SpikesPreset
  | ParticlePreset
  | ReactivePreset
  | MilkdropPreset;

export interface VisContext {
  renderer: WebGLRenderer;
  audioTextures: AudioTextures;
}

export interface Visualization {
  id: string;
  name: string;
  family: VisFamily;
  era: string;
  /** Defaults to three (now-playing WebGL). Butterchurn uses a separate canvas. */
  engine?: VisEngine;
  presets: AnyPreset[];
  mount: (ctx: VisContext) => void;
  frame: (audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}
