import butterchurnModule from "butterchurn";
import presetsModule from "butterchurn-presets";

type ButterchurnApi = {
  createVisualizer: (
    context: AudioContext,
    canvas: HTMLCanvasElement,
    opts: { width: number; height: number; pixelRatio?: number; textureRatio?: number },
  ) => {
    connectAudio: (node: AudioNode) => void;
    disconnectAudio: (node: AudioNode) => void;
    loadPreset: (preset: unknown, blendTime?: number) => void;
    setRendererSize: (
      width: number,
      height: number,
      opts?: { pixelRatio?: number; textureRatio?: number },
    ) => void;
    render: (opts?: {
      audioLevels?: {
        timeByteArray: Uint8Array;
        timeByteArrayL: Uint8Array;
        timeByteArrayR: Uint8Array;
      };
    }) => void;
  };
};

/** Vite/Rolldown can nest UMD defaults — unwrap until createVisualizer is reachable. */
function unwrapButterchurn(mod: unknown): ButterchurnApi {
  let cur: unknown = mod;
  for (let i = 0; i < 4; i += 1) {
    // UMD default is the Butterchurn class (typeof "function") with static createVisualizer.
    if (cur != null && (typeof cur === "object" || typeof cur === "function")) {
      if (typeof (cur as ButterchurnApi).createVisualizer === "function") {
        return cur as ButterchurnApi;
      }
    }
    if (cur && typeof cur === "object" && "default" in cur) {
      cur = (cur as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new Error("butterchurn.createVisualizer is not available (module interop)");
}

let butterSupportedCache: boolean | null = null;

/**
 * One-shot WebGL2 probe. Do NOT call butterchurn's isSupported.min every render —
 * it allocates a new GL context each time and blows the browser limit.
 */
export function isButterchurnSupportedCached(): boolean {
  if (butterSupportedCache != null) return butterSupportedCache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
    });
    butterSupportedCache = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    butterSupportedCache = false;
  }
  return butterSupportedCache;
}

/** Drop a canvas WebGL context so we do not leak across Milkdrop remounts. */
export function loseCanvasWebGl(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  try {
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* ignore */
  }
}

function unwrapPresets(mod: unknown): Record<string, unknown> {
  let cur: unknown = mod;
  for (let i = 0; i < 4; i += 1) {
    // UMD default is often a Function with .getPresets — typeof "function", not "object".
    if (cur != null && (typeof cur === "object" || typeof cur === "function")) {
      const pack = cur as { getPresets?: () => Record<string, unknown> };
      if (typeof pack.getPresets === "function") {
        const all = pack.getPresets();
        if (all && typeof all === "object" && Object.keys(all).length > 0) return all;
      }
      // Some Vite interops expose the preset map directly on default.
      if (typeof cur === "object" && !Array.isArray(cur)) {
        const keys = Object.keys(cur as object);
        const sample = (cur as Record<string, unknown>)[keys[0] ?? ""];
        if (
          keys.length > 0 &&
          sample &&
          typeof sample === "object" &&
          sample !== null &&
          ("baseVals" in sample || "shapes" in sample)
        ) {
          return cur as Record<string, unknown>;
        }
      }
    }
    if (cur && typeof cur === "object" && "default" in cur) {
      cur = (cur as { default: unknown }).default;
      continue;
    }
    break;
  }
  console.warn("[Milkdrop] butterchurn-presets produced an empty map", mod);
  return {};
}

let presetCache: Record<string, unknown> | null = null;

export function getButterchurn(): ButterchurnApi {
  return unwrapButterchurn(butterchurnModule);
}

export function getMilkdropPresetMap(): Record<string, unknown> {
  // Never keep an empty cache — first import can race Vite interop.
  if (presetCache && Object.keys(presetCache).length > 0) return presetCache;
  presetCache = unwrapPresets(presetsModule);
  return presetCache;
}

/** Butterchurn mutates presets (compiles eqs) — always hand it a fresh copy. */
export function cloneMilkdropPreset(preset: unknown): unknown {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(preset);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(preset)) as unknown;
}

/** Butterchurn AudioProcessor expects 1024-sample time-domain bytes (0..255). */
export const BUTTERCHURN_FFT_SIZE = 1024;

export function fillButterchurnAudioLevels(
  waveform: Uint8Array,
  out: Uint8Array,
): { timeByteArray: Uint8Array; timeByteArrayL: Uint8Array; timeByteArrayR: Uint8Array } {
  const n = out.length;
  const srcLen = waveform.length;
  if (srcLen <= 0) {
    out.fill(128);
  } else {
    for (let i = 0; i < n; i += 1) {
      const srcIndex = Math.min(srcLen - 1, Math.floor((i / n) * srcLen));
      out[i] = waveform[srcIndex] ?? 128;
    }
  }
  return { timeByteArray: out, timeByteArrayL: out, timeByteArrayR: out };
}
