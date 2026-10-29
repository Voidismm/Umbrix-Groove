declare module "butterchurn" {
  export interface ButterchurnVisualizer {
    connectAudio: (node: AudioNode) => void;
    disconnectAudio: (node: AudioNode) => void;
    loadPreset: (preset: unknown, blendTime?: number) => void;
    setRendererSize: (width: number, height: number) => void;
    render: () => void;
  }

  export interface ButterchurnApi {
    createVisualizer: (
      context: AudioContext,
      canvas: HTMLCanvasElement,
      opts: { width: number; height: number; pixelRatio?: number },
    ) => ButterchurnVisualizer;
  }

  const butterchurn: ButterchurnApi;
  export default butterchurn;
}

declare module "butterchurn/lib/isSupported.min" {
  function isButterchurnSupported(): boolean;
  export default isButterchurnSupported;
}

declare module "butterchurn-presets" {
  export function getPresets(): Record<string, unknown>;
  const butterchurnPresets: { getPresets: () => Record<string, unknown> };
  export default butterchurnPresets;
}
