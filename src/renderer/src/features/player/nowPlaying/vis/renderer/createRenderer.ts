import * as THREE from "three";

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x07080c, 1);
  renderer.autoClear = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = true;
  return renderer;
}

export function fitRenderer(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
): { w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  return { w: Math.floor(w * dpr), h: Math.floor(h * dpr) };
}
