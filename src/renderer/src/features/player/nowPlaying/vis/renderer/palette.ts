import * as THREE from "three";

export function makePaletteTexture(colors: string[]): THREE.DataTexture {
  const w = 256;
  const data = new Uint8Array(w * 4);
  const cols = colors.length > 0 ? colors : ["#000000", "#ffffff"];
  const parsed = cols.map((c) => new THREE.Color(c));
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    const x = t * (parsed.length - 1);
    const a = Math.floor(x);
    const b = Math.min(parsed.length - 1, a + 1);
    const f = x - a;
    const ca = parsed[a] ?? parsed[0]!;
    const cb = parsed[b] ?? parsed[parsed.length - 1]!;
    data[i * 4] = Math.round((ca.r * (1 - f) + cb.r * f) * 255);
    data[i * 4 + 1] = Math.round((ca.g * (1 - f) + cb.g * f) * 255);
    data[i * 4 + 2] = Math.round((ca.b * (1 - f) + cb.b * f) * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function writePalette(tex: THREE.DataTexture, colors: string[]): void {
  const image = tex.image as { data: Uint8Array; width: number };
  const data = image.data;
  const w = image.width;
  const cols = colors.length > 0 ? colors : ["#000000", "#ffffff"];
  const parsed = cols.map((c) => new THREE.Color(c));
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    const x = t * (parsed.length - 1);
    const a = Math.floor(x);
    const b = Math.min(parsed.length - 1, a + 1);
    const f = x - a;
    const ca = parsed[a] ?? parsed[0]!;
    const cb = parsed[b] ?? parsed[parsed.length - 1]!;
    data[i * 4] = Math.round((ca.r * (1 - f) + cb.r * f) * 255);
    data[i * 4 + 1] = Math.round((ca.g * (1 - f) + cb.g * f) * 255);
    data[i * 4 + 2] = Math.round((ca.b * (1 - f) + cb.b * f) * 255);
    data[i * 4 + 3] = 255;
  }
  tex.needsUpdate = true;
}
