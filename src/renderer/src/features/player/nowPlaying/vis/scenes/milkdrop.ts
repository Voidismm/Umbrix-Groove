import type { AudioFrame } from "../../audio/features";
import { cloneMilkdropPreset, getMilkdropPresetMap } from "../butterchurnApi";
import type { ColorSettings } from "../color";
import type { AnyPreset, MilkdropPreset, VisContext, Visualization } from "../types";

function buildPresets(): MilkdropPreset[] {
  const keys = Object.keys(getMilkdropPresetMap()).sort((a, b) => a.localeCompare(b));
  return keys.map((key, index) => ({
    id: `md-${index}`,
    name: key.length > 52 ? `${key.slice(0, 49)}…` : key,
    kind: "milkdrop",
    key,
  }));
}

/** Catalog stub — Butterchurn renders on its own canvas in VisualizerStage. */
export function createMilkdrop(): Visualization {
  const presets = buildPresets();
  return {
    id: "milkdrop",
    name: "Milkdrop",
    family: "milkdrop",
    era: "Butterchurn",
    engine: "butterchurn",
    presets:
      presets.length > 0
        ? presets
        : [
            {
              id: "md-empty",
              name: "No presets loaded",
              kind: "milkdrop",
              key: "",
            },
          ],
    mount(_ctx: VisContext) {
      /* Butterchurn path owns GL */
    },
    frame(_audio: AudioFrame, _preset: AnyPreset, _dt: number, _color: ColorSettings) {
      /* no-op */
    },
    resize() {},
    dispose() {},
  };
}

export function resolveMilkdropPresetData(preset: AnyPreset): unknown | null {
  if (preset.kind !== "milkdrop" || !preset.key) return null;
  const raw = getMilkdropPresetMap()[preset.key];
  if (!raw) return null;
  return cloneMilkdropPreset(raw);
}
