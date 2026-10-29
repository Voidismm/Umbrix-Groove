import type { CSSProperties } from 'react'

/** Default Umbrix playlist banner accent when no cover / color is set. */
export const DEFAULT_PLAYLIST_ACCENT = '#6b3aad'

type Rgb = { r: number; g: number; b: number }

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function parseHexColor(value: string | null | undefined): Rgb | null {
  if (!value) return null
  const raw = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw) && !/^[0-9a-fA-F]{3}$/.test(raw)) return null
  const hex =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  }
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  const rgb = parseHexColor(value)
  if (!rgb) return null
  const to = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`
}

function toHex({ r, g, b }: Rgb): string {
  const to = (n: number): string => clampByte(n).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  }
}

function darken(rgb: Rgb, amount: number): Rgb {
  return mix(rgb, { r: 15, g: 11, b: 24 }, amount)
}

function saturate(rgb: Rgb, amount: number): Rgb {
  const avg = (rgb.r + rgb.g + rgb.b) / 3
  return {
    r: rgb.r + (rgb.r - avg) * amount,
    g: rgb.g + (rgb.g - avg) * amount,
    b: rgb.b + (rgb.b - avg) * amount
  }
}

/** CSS custom properties for the playlist detail banner. */
export function playlistBannerStyle(accentHex: string): CSSProperties {
  const parsed = parseHexColor(accentHex) ?? parseHexColor(DEFAULT_PLAYLIST_ACCENT)!
  const rich = saturate(parsed, 0.35)
  const mid = darken(rich, 0.28)
  const deep = darken(rich, 0.62)
  const glow = `rgba(${clampByte(rich.r)}, ${clampByte(rich.g)}, ${clampByte(rich.b)}, 0.52)`
  const soft = `rgba(${clampByte(rich.r)}, ${clampByte(rich.g)}, ${clampByte(rich.b)}, 0.22)`
  return {
    ['--playlist-accent' as string]: toHex(rich),
    ['--playlist-accent-glow' as string]: glow,
    ['--playlist-accent-soft' as string]: soft,
    ['--playlist-accent-mid' as string]: toHex(mid),
    ['--playlist-accent-deep' as string]: toHex(deep)
  }
}

/**
 * Sample an artwork URL and return a banner-friendly hex.
 * Returns null if the image cannot be read.
 */
export function extractAccentFromImageUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const size = 40
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let bestScore = -1
        let best: Rgb = { r: 107, g: 58, b: 173 }
        let count = 0
        let sumR = 0
        let sumG = 0
        let sumB = 0

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 200) continue
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const sat = max === 0 ? 0 : (max - min) / max
          const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
          // Skip near-white / near-black / gray
          if (lum < 0.08 || lum > 0.88 || sat < 0.12) continue
          const score = sat * 1.4 + (1 - Math.abs(lum - 0.42)) * 0.8
          sumR += r
          sumG += g
          sumB += b
          count += 1
          if (score > bestScore) {
            bestScore = score
            best = { r, g, b }
          }
        }

        if (count === 0) {
          resolve(null)
          return
        }

        // Blend peak chroma with average of vivid pixels
        const avg = { r: sumR / count, g: sumG / count, b: sumB / count }
        const mixed = mix(best, avg, 0.35)
        resolve(toHex(saturate(mixed, 0.25)))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
