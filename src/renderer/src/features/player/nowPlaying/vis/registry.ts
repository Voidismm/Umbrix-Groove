import { alchemyPresets } from "./presets/alchemy";
import { ambiencePresets } from "./presets/ambience";
import { batteryPresets } from "./presets/battery";
import { musicalColorsPresets } from "./presets/musicalColors";
import { plenopticPresets } from "./presets/plenoptic";
import { voltagePresets } from "./presets/voltage";
import { createBarsAndWaves } from "./scenes/barsAndWaves";
import { createFeedbackVis } from "./scenes/feedbackVis";
import { createMilkdrop } from "./scenes/milkdrop";
import { createParticle } from "./scenes/particle";
import { createReactive } from "./scenes/reactive";
import { createSpikes } from "./scenes/spikes";
import type { Visualization } from "./types";

export function createCatalog(): Visualization[] {
  return [
    createFeedbackVis({
      id: "alchemy",
      name: "Alchemy",
      family: "ambience",
      era: "WMP 9–12",
      presets: alchemyPresets,
    }),
    createFeedbackVis({
      id: "battery",
      name: "Battery",
      family: "ambience",
      era: "WMP 8–12",
      presets: batteryPresets,
    }),
    createFeedbackVis({
      id: "ambience",
      name: "Ambience",
      family: "ambience",
      era: "WMP 7–10",
      presets: ambiencePresets,
    }),
    createFeedbackVis({
      id: "voltage",
      name: "Voltage",
      family: "reactive",
      era: "Groove",
      presets: voltagePresets,
    }),
    createReactive(),
    createBarsAndWaves(),
    createSpikes(),
    createParticle(),
    createFeedbackVis({
      id: "plenoptic",
      name: "Plenoptic",
      family: "musical-colors",
      era: "WMP 7–10",
      presets: plenopticPresets,
    }),
    createFeedbackVis({
      id: "musical-colors",
      name: "Musical Colors",
      family: "musical-colors",
      era: "WMP 7–8",
      presets: musicalColorsPresets,
    }),
    createMilkdrop(),
  ];
}

export function familyLabel(id: Visualization["family"]): string {
  if (id === "ambience") return "Ambience family";
  if (id === "bars-and-waves") return "Bars and Waves family";
  if (id === "reactive") return "Reactive family";
  if (id === "milkdrop") return "Milkdrop family";
  return "Musical Colors family";
}

export function findVis(list: Visualization[], id: string): Visualization {
  return list.find((v) => v.id === id) ?? list[0]!;
}

export function findPreset(vis: Visualization, id: string) {
  return vis.presets.find((p) => p.id === id) ?? vis.presets[0]!;
}

export function stepIndex(len: number, index: number, dir: number): number {
  return (index + dir + len) % len;
}
