/** Built-in appearance themes — per-channel hue + tone for live chrome tinting. */

export type ChannelTone = {
  hue: number
  /** 0–200, 100 = stock. Full travel maps to real HSL extremes. */
  brightness: number
  /** 0–200, 100 = stock. Full travel maps to real HSL extremes. */
  saturation: number
}

export type ThemeHues = {
  ui: ChannelTone
  button: ChannelTone
  scrollbar: ChannelTone
}

export type ThemePreset = ThemeHues & {
  id: string
  name: string
}

function channel(hue: number, brightness = 100, saturation = 100): ChannelTone {
  return { hue, brightness, saturation }
}

/** Default Umbrix Galaxy purple (~#7b4db8). */
export const DEFAULT_THEME_HUES: ThemeHues = {
  ui: channel(271),
  button: channel(271),
  scrollbar: channel(271)
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'umbrix',
    name: 'Umbrix',
    ui: channel(271),
    button: channel(271),
    scrollbar: channel(271)
  },
  {
    id: 'violet',
    name: 'Violet',
    ui: channel(285),
    button: channel(292),
    scrollbar: channel(278)
  },
  {
    id: 'ocean',
    name: 'Ocean',
    ui: channel(208),
    button: channel(198),
    scrollbar: channel(200)
  },
  {
    id: 'rose',
    name: 'Rose',
    ui: channel(328),
    button: channel(338),
    scrollbar: channel(322)
  },
  {
    id: 'ember',
    name: 'Ember',
    ui: channel(16),
    button: channel(10),
    scrollbar: channel(24)
  },
  {
    id: 'mint',
    name: 'Mint',
    ui: channel(158),
    button: channel(164),
    scrollbar: channel(152)
  },
  {
    id: 'black-noire',
    name: 'Black Noire',
    ui: channel(0, 22, 0),
    button: channel(0, 52, 0),
    scrollbar: channel(271, 91, 0)
  }
]

/** Inline vars applyAppearanceHues writes — cleared for stock Umbrix so :root tokens win. */
const APPEARANCE_COLOR_VARS = [
  '--ug-amethyst',
  '--ug-amethyst-bright',
  '--ug-amethyst-deep',
  '--ug-glow',
  '--ug-cover-top',
  '--ug-cover-bot',
  '--ug-cover-gradient',
  '--ug-panel',
  '--ug-panel-raised',
  '--ug-panel-hover',
  '--ug-chrome-wash',
  '--ug-chrome-wash-deep',
  '--ug-shell-top',
  '--ug-shell-mid',
  '--ug-shell-bot',
  '--ug-right-shell-top',
  '--ug-right-shell-bot',
  '--ug-center-top',
  '--ug-center-mid',
  '--ug-titlebar-top',
  '--ug-titlebar-bot',
  '--ug-footer-top',
  '--ug-footer-bot',
  '--ug-hero-base',
  '--ug-nebula-a',
  '--ug-nebula-b',
  '--ug-nebula-c',
  '--ug-modal-top',
  '--ug-modal-mid',
  '--ug-modal-bot',
  '--ug-modal-surface',
  '--ug-menu-top',
  '--ug-menu-bot',
  '--ug-button-fill-top',
  '--ug-button-fill-mid',
  '--ug-button-fill-bot',
  '--ug-button-glow',
  '--ug-scrollbar-fill',
  '--ug-scrollbar-thumb',
  '--ug-scrollbar-thumb-hover'
] as const

export function channelMatch(a: ChannelTone, b: ChannelTone): boolean {
  return a.hue === b.hue && a.brightness === b.brightness && a.saturation === b.saturation
}

export function huesMatch(a: ThemeHues, b: ThemeHues): boolean {
  return (
    channelMatch(a.ui, b.ui) &&
    channelMatch(a.button, b.button) &&
    channelMatch(a.scrollbar, b.scrollbar)
  )
}

export function findThemeId(hues: ThemeHues, saved: ThemePreset[] = []): string | 'custom' {
  const hit =
    THEME_PRESETS.find((preset) => huesMatch(preset, hues)) ??
    saved.find((preset) => huesMatch(preset, hues))
  return hit?.id ?? 'custom'
}

/** Stable id for a user-named theme — same name overwrites. */
export function savedThemeId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `user-${slug}` : `user-${Date.now()}`
}

export function sanitizeSavedThemes(raw: unknown): ThemePreset[] {
  if (!Array.isArray(raw)) return []
  const out: ThemePreset[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Partial<ThemePreset>
    if (typeof row.id !== 'string' || !row.id.startsWith('user-')) continue
    if (typeof row.name !== 'string' || !row.name.trim()) continue
    if (!row.ui || !row.button || !row.scrollbar) continue
    const ui = normalizeChannel(row.ui)
    const button = normalizeChannel(row.button)
    const scrollbar = normalizeChannel(row.scrollbar)
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push({
      id: row.id,
      name: row.name.trim().slice(0, 40),
      ui: { hue: ui.hue, brightness: ui.brightness, saturation: ui.saturation },
      button: { hue: button.hue, brightness: button.brightness, saturation: button.saturation },
      scrollbar: {
        hue: scrollbar.hue,
        brightness: scrollbar.brightness,
        saturation: scrollbar.saturation
      }
    })
  }
  return out
}

export function channelSwatch(tone: ChannelTone): string {
  const sat = tonePercent(55, tone.saturation, 0, 100)
  const bri = tonePercent(48, tone.brightness, 12, 78)
  return `hsl(${clampHue(tone.hue)} ${sat}% ${bri}%)`
}

/** Push live CSS variables for UI / button / scrollbar accents + per-channel tone. */
export function applyAppearanceHues(hues: ThemeHues): void {
  const root = document.documentElement
  const ui = normalizeChannel(hues.ui)
  const button = normalizeChannel(hues.button)
  const scroll = normalizeChannel(hues.scrollbar)

  root.style.setProperty('--ug-ui-hue', String(ui.hue))
  root.style.setProperty('--ug-button-hue', String(button.hue))
  root.style.setProperty('--ug-scrollbar-hue', String(scroll.hue))

  root.style.setProperty('--ug-button-hue-shift', `${button.hue - 271}deg`)
  root.style.setProperty('--ug-scrollbar-hue-shift', `${scroll.hue - 271}deg`)
  root.style.setProperty(
    '--ug-button-tone-filter',
    `hue-rotate(${button.hue - 271}deg) saturate(${button.satMul}) brightness(${button.briMul})`
  )
  root.style.setProperty(
    '--ug-scrollbar-tone-filter',
    `hue-rotate(${scroll.hue - 271}deg) saturate(${scroll.satMul}) brightness(${scroll.briMul})`
  )

  // Stock Umbrix: drop inline color overrides so stylesheet :root tokens return.
  if (huesMatch({ ui, button, scrollbar: scroll }, DEFAULT_THEME_HUES)) {
    for (const key of APPEARANCE_COLOR_VARS) {
      root.style.removeProperty(key)
    }
    return
  }

  root.style.setProperty(
    '--ug-amethyst',
    `hsl(${ui.hue} ${tonePercent(45, ui.saturation, 0, 100)}% ${tonePercent(51, ui.brightness, 18, 82)}%)`
  )
  root.style.setProperty(
    '--ug-amethyst-bright',
    `hsl(${ui.hue} ${tonePercent(68, ui.saturation, 0, 100)}% ${tonePercent(67, ui.brightness, 28, 90)}%)`
  )
  root.style.setProperty(
    '--ug-amethyst-deep',
    `hsl(${ui.hue} ${tonePercent(50, ui.saturation, 0, 100)}% ${tonePercent(31, ui.brightness, 10, 58)}%)`
  )
  root.style.setProperty(
    '--ug-glow',
    `hsla(${ui.hue}, ${tonePercent(68, ui.saturation, 0, 100)}%, ${tonePercent(67, ui.brightness, 28, 90)}%, 0.14)`
  )

  // Image-less covers / folder tiles / panel fills follow the UI channel.
  const coverTop = `hsl(${ui.hue} ${tonePercent(48, ui.saturation, 0, 100)}% ${tonePercent(22, ui.brightness, 6, 48)}%)`
  const coverBot = `hsl(${ui.hue} ${tonePercent(42, ui.saturation, 0, 100)}% ${tonePercent(10, ui.brightness, 3, 32)}%)`
  root.style.setProperty('--ug-cover-top', coverTop)
  root.style.setProperty('--ug-cover-bot', coverBot)
  root.style.setProperty('--ug-cover-gradient', `linear-gradient(145deg, ${coverTop}, ${coverBot})`)
  root.style.setProperty(
    '--ug-panel',
    `hsl(${ui.hue} ${tonePercent(28, ui.saturation, 0, 100)}% ${tonePercent(10, ui.brightness, 3, 28)}%)`
  )
  root.style.setProperty(
    '--ug-panel-raised',
    `hsl(${ui.hue} ${tonePercent(32, ui.saturation, 0, 100)}% ${tonePercent(14, ui.brightness, 4, 36)}%)`
  )
  root.style.setProperty(
    '--ug-panel-hover',
    `hsl(${ui.hue} ${tonePercent(34, ui.saturation, 0, 100)}% ${tonePercent(18, ui.brightness, 5, 42)}%)`
  )

  // Chrome / hero washes — stock softness at 100%; ends of the slider actually move.
  const wash = `hsl(${ui.hue} ${tonePercent(45, ui.saturation, 0, 100)}% ${tonePercent(51, ui.brightness, 18, 82)}%)`
  const washDeep = `hsl(${ui.hue} ${tonePercent(50, ui.saturation, 0, 100)}% ${tonePercent(31, ui.brightness, 10, 58)}%)`
  root.style.setProperty('--ug-chrome-wash', wash)
  root.style.setProperty('--ug-chrome-wash-deep', washDeep)
  const shellTop = `hsl(${ui.hue} ${tonePercent(30, ui.saturation, 0, 100)}% ${tonePercent(8, ui.brightness, 2, 24)}%)`
  const shellMid = `hsl(${ui.hue} ${tonePercent(28, ui.saturation, 0, 100)}% ${tonePercent(6, ui.brightness, 2, 20)}%)`
  const shellBot = `hsl(${ui.hue} ${tonePercent(26, ui.saturation, 0, 100)}% ${tonePercent(4, ui.brightness, 1, 16)}%)`
  root.style.setProperty('--ug-shell-top', shellTop)
  root.style.setProperty('--ug-shell-mid', shellMid)
  root.style.setProperty('--ug-shell-bot', shellBot)
  root.style.setProperty('--ug-right-shell-top', shellTop)
  root.style.setProperty('--ug-right-shell-bot', shellBot)
  root.style.setProperty('--ug-center-top', shellTop)
  root.style.setProperty('--ug-center-mid', shellMid)
  root.style.setProperty(
    '--ug-titlebar-top',
    `hsla(${ui.hue}, ${tonePercent(28, ui.saturation, 0, 100)}%, ${tonePercent(8, ui.brightness, 2, 24)}%, 0.92)`
  )
  root.style.setProperty(
    '--ug-titlebar-bot',
    `hsla(${ui.hue}, ${tonePercent(26, ui.saturation, 0, 100)}%, ${tonePercent(4, ui.brightness, 1, 16)}%, 0.96)`
  )
  root.style.setProperty(
    '--ug-footer-top',
    `hsla(${ui.hue}, ${tonePercent(30, ui.saturation, 0, 100)}%, ${tonePercent(7, ui.brightness, 2, 22)}%, 0.94)`
  )
  root.style.setProperty(
    '--ug-footer-bot',
    `hsla(${ui.hue}, ${tonePercent(26, ui.saturation, 0, 100)}%, ${tonePercent(4, ui.brightness, 1, 16)}%, 0.98)`
  )
  root.style.setProperty(
    '--ug-hero-base',
    `linear-gradient(165deg, hsl(${ui.hue} ${tonePercent(38, ui.saturation, 0, 100)}% ${tonePercent(12, ui.brightness, 3, 32)}%) 0%, hsl(${ui.hue} ${tonePercent(34, ui.saturation, 0, 100)}% ${tonePercent(8, ui.brightness, 2, 24)}%) 42%, hsl(${ui.hue} ${tonePercent(28, ui.saturation, 0, 100)}% ${tonePercent(4, ui.brightness, 1, 16)}%) 100%)`
  )
  // Nebula alphas match stock GalaxySky softness.
  root.style.setProperty(
    '--ug-nebula-a',
    `hsla(${ui.hue}, ${tonePercent(48, ui.saturation, 0, 100)}%, ${tonePercent(44, ui.brightness, 14, 72)}%, 0.22)`
  )
  root.style.setProperty(
    '--ug-nebula-b',
    `hsla(${ui.hue}, ${tonePercent(55, ui.saturation, 0, 100)}%, ${tonePercent(26, ui.brightness, 8, 52)}%, 0.2)`
  )
  root.style.setProperty(
    '--ug-nebula-c',
    `hsla(${ui.hue}, ${tonePercent(48, ui.saturation, 0, 100)}%, ${tonePercent(45, ui.brightness, 14, 72)}%, 0.12)`
  )

  const modalTop = `hsl(${ui.hue} ${tonePercent(34, ui.saturation, 8, 55)}% ${tonePercent(14, ui.brightness, 5, 36)}%)`
  const modalMid = `hsl(${ui.hue} ${tonePercent(30, ui.saturation, 6, 48)}% ${tonePercent(8, ui.brightness, 2, 24)}%)`
  const modalBot = `hsl(${ui.hue} ${tonePercent(28, ui.saturation, 4, 42)}% ${tonePercent(5, ui.brightness, 1, 18)}%)`
  root.style.setProperty('--ug-modal-top', modalTop)
  root.style.setProperty('--ug-modal-mid', modalMid)
  root.style.setProperty('--ug-modal-bot', modalBot)
  root.style.setProperty(
    '--ug-modal-surface',
    `linear-gradient(165deg, ${modalTop} 0%, ${modalMid} 48%, ${modalBot} 100%)`
  )
  root.style.setProperty(
    '--ug-menu-top',
    `hsl(${ui.hue} ${tonePercent(32, ui.saturation, 8, 52)}% ${tonePercent(12, ui.brightness, 4, 32)}%)`
  )
  root.style.setProperty('--ug-menu-bot', modalMid)

  root.style.setProperty(
    '--ug-button-fill-top',
    `hsl(${button.hue} ${tonePercent(48, button.saturation, 0, 100)}% ${tonePercent(47, button.brightness, 16, 78)}%)`
  )
  root.style.setProperty(
    '--ug-button-fill-mid',
    `hsl(${button.hue} ${tonePercent(58, button.saturation, 0, 100)}% ${tonePercent(30, button.brightness, 8, 62)}%)`
  )
  root.style.setProperty(
    '--ug-button-fill-bot',
    `hsl(${button.hue} ${tonePercent(55, button.saturation, 0, 100)}% ${tonePercent(16, button.brightness, 4, 42)}%)`
  )
  root.style.setProperty(
    '--ug-button-glow',
    `hsla(${button.hue}, ${tonePercent(45, button.saturation, 0, 100)}%, ${tonePercent(51, button.brightness, 18, 82)}%, 0.28)`
  )

  root.style.setProperty(
    '--ug-scrollbar-fill',
    `hsl(${scroll.hue} ${tonePercent(60, scroll.saturation, 0, 100)}% ${tonePercent(31, scroll.brightness, 8, 58)}%)`
  )
  root.style.setProperty(
    '--ug-scrollbar-thumb',
    `hsla(${scroll.hue}, ${tonePercent(45, scroll.saturation, 0, 100)}%, ${tonePercent(55, scroll.brightness, 20, 85)}%, 0.45)`
  )
  root.style.setProperty(
    '--ug-scrollbar-thumb-hover',
    `hsla(${scroll.hue}, ${tonePercent(50, scroll.saturation, 0, 100)}%, ${tonePercent(60, scroll.brightness, 24, 90)}%, 0.65)`
  )
}

type NormChannel = ChannelTone & { briMul: number; satMul: number }

function normalizeChannel(tone: ChannelTone): NormChannel {
  const brightness = clampTone(tone.brightness)
  const saturation = clampTone(tone.saturation)
  return {
    hue: clampHue(tone.hue),
    brightness,
    saturation,
    // PNG filters: keep a floor so 0% does not crush plates to pure black.
    briMul: Math.max(0.2, brightness / 100),
    satMul: saturation / 100
  }
}

function clampHue(value: number): number {
  if (!Number.isFinite(value)) return 271
  const n = Math.round(value) % 360
  return n < 0 ? n + 360 : n
}

function clampTone(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.min(200, Math.max(0, Math.round(value)))
}

/**
 * Map a 0–200 tone slider onto an HSL % channel.
 * 100% keeps `base`. 0% reaches `floor`. 200% reaches `ceil`.
 * That way the ends of the slider always move the color.
 */
function tonePercent(base: number, tonePct: number, floor: number, ceil: number): number {
  const tone = clampTone(tonePct)
  const t = (tone - 100) / 100
  const raw = t <= 0 ? base + (base - floor) * t : base + (ceil - base) * t
  return Math.min(100, Math.max(0, Math.round(raw)))
}

/** Migrate flat appearance fields (including old global bri/sat) into ThemeHues. */
export function appearanceToThemeHues(appearance: {
  uiHue?: number
  buttonHue?: number
  scrollbarHue?: number
  uiBrightness?: number
  uiSaturation?: number
  buttonBrightness?: number
  buttonSaturation?: number
  scrollbarBrightness?: number
  scrollbarSaturation?: number
  /** Legacy global tone — applied to all channels if per-channel missing. */
  brightness?: number
  saturation?: number
  ui?: ChannelTone
  button?: ChannelTone
  scrollbar?: ChannelTone
}): ThemeHues {
  if (appearance.ui && appearance.button && appearance.scrollbar) {
    return {
      ui: normalizeChannel(appearance.ui),
      button: normalizeChannel(appearance.button),
      scrollbar: normalizeChannel(appearance.scrollbar)
    }
  }

  const legacyBri = clampTone(
    typeof appearance.brightness === 'number' ? appearance.brightness : 100
  )
  const legacySat = clampTone(
    typeof appearance.saturation === 'number' ? appearance.saturation : 100
  )

  return {
    ui: normalizeChannel({
      hue: typeof appearance.uiHue === 'number' ? appearance.uiHue : 271,
      brightness:
        typeof appearance.uiBrightness === 'number' ? appearance.uiBrightness : legacyBri,
      saturation:
        typeof appearance.uiSaturation === 'number' ? appearance.uiSaturation : legacySat
    }),
    button: normalizeChannel({
      hue: typeof appearance.buttonHue === 'number' ? appearance.buttonHue : 271,
      brightness:
        typeof appearance.buttonBrightness === 'number'
          ? appearance.buttonBrightness
          : legacyBri,
      saturation:
        typeof appearance.buttonSaturation === 'number'
          ? appearance.buttonSaturation
          : legacySat
    }),
    scrollbar: normalizeChannel({
      hue: typeof appearance.scrollbarHue === 'number' ? appearance.scrollbarHue : 271,
      brightness:
        typeof appearance.scrollbarBrightness === 'number'
          ? appearance.scrollbarBrightness
          : legacyBri,
      saturation:
        typeof appearance.scrollbarSaturation === 'number'
          ? appearance.scrollbarSaturation
          : legacySat
    })
  }
}
