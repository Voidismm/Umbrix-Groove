/**
 * Slider position (0..1) ↔ actual output gain.
 * Power curve stretches the quiet end so low slider values stay barely audible
 * instead of jumping from silence to "still pretty loud".
 */
const VOLUME_CURVE_EXPONENT = 2.55

export function uiVolumeToGain(ui: number): number {
  const x = Math.min(1, Math.max(0, ui))
  if (x <= 0) return 0
  return Math.pow(x, VOLUME_CURVE_EXPONENT)
}

export function gainToUiVolume(gain: number): number {
  const g = Math.min(1, Math.max(0, gain))
  if (g <= 0) return 0
  return Math.pow(g, 1 / VOLUME_CURVE_EXPONENT)
}
