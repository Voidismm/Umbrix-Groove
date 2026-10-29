import type { FeedbackPreset } from "../types";

export const alchemyPresets: FeedbackPreset[] = [
  {
    id: "random",
    name: "Random",
    kind: "feedback",
    shift: 0,
    draw: 0,
    decay: 0.968,
    paletteLocked: false,
    palette: ["#081018", "#12304a", "#1f7a6b", "#c45c7a", "#e8a04a", "#f4e4c4"],
    hueSpeed: 0.045,
    shiftStrength: 1.05,
    ink: 1.15,
    flashOnBeat: true,
    kaleidoSlices: 6,
    seed: 0.21,
  },
];
