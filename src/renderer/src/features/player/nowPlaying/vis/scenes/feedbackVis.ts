import type { AudioFrame } from "../../audio/features";
import type { ColorSettings } from "../color";
import type {
  AnyPreset,
  FeedbackPreset,
  VisContext,
  VisFamily,
  Visualization,
} from "../types";
import { FeedbackEngine } from "../renderer/feedback";

export function createFeedbackVis(meta: {
  id: string;
  name: string;
  family: VisFamily;
  era: string;
  presets: FeedbackPreset[];
}): Visualization {
  let engine: FeedbackEngine | null = null;
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    id: meta.id,
    name: meta.name,
    family: meta.family,
    era: meta.era,
    presets: meta.presets,
    mount(ctx: VisContext) {
      engine = new FeedbackEngine(ctx.renderer, ctx.audioTextures);
      engine.setReducedMotion(reduced);
    },
    frame(audio: AudioFrame, preset: AnyPreset, dt: number, color: ColorSettings) {
      if (!engine || preset.kind !== "feedback") return;
      engine.frame(audio, preset, meta.presets, dt, color);
    },
    resize(w: number, h: number) {
      engine?.resize(w, h);
    },
    dispose() {
      engine?.dispose();
      engine = null;
    },
  };
}
