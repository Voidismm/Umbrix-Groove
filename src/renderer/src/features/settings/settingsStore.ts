/** Persisted app preferences (Settings modal). Separate from ephemeral session keys. */

import {
  appearanceToThemeHues,
  DEFAULT_THEME_HUES,
  findThemeId,
  sanitizeSavedThemes,
  type ThemeHues,
  type ThemePreset
} from './themePresets'

export const SETTINGS_STORAGE_KEY = 'umbrix.settings'

export type SeekStepSeconds = 5 | 10 | 15
export type VolumeStep = 0.02 | 0.05 | 0.1

export type AppSettings = {
  appearance: {
    reduceMotion: boolean
    compactDensity: boolean
    /** Show groove-themed hover labels on icon / chrome buttons. */
    showButtonTips: boolean
    /** Twinkling galaxy wash on titlebar, footer, and sidebars (home hero stays on). */
    galaxyChrome: boolean
    uiHue: number
    uiBrightness: number
    uiSaturation: number
    buttonHue: number
    buttonBrightness: number
    buttonSaturation: number
    scrollbarHue: number
    scrollbarBrightness: number
    scrollbarSaturation: number
    /** Preset id, or `custom` when hues were hand-tuned. */
    themeId: string
    /** User-named themes saved from Live Studio. */
    savedThemes: ThemePreset[]
  }
  playback: {
    rememberPosition: boolean
    seekStepSeconds: SeekStepSeconds
    volumeStep: VolumeStep
  }
  library: {
    autoRescanOnLaunch: boolean
    /** Watch music folders and re-index when files change (live). */
    watchFolders: boolean
  }
  lyrics: {
    preferSidecar: boolean
    autoScroll: boolean
    showInStage: boolean
  }
  warnings: {
    /** Prompt before the visualizer mounts (photosensitivity / flashing lights). */
    showVisualizerPhotosensitivity: boolean
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    reduceMotion: false,
    compactDensity: false,
    showButtonTips: true,
    galaxyChrome: true,
    ...themeToFlat(DEFAULT_THEME_HUES),
    themeId: 'umbrix',
    savedThemes: []
  },
  playback: {
    rememberPosition: true,
    seekStepSeconds: 5,
    volumeStep: 0.05
  },
  library: {
    autoRescanOnLaunch: false,
    watchFolders: true
  },
  lyrics: {
    preferSidecar: true,
    autoScroll: true,
    showInStage: true
  },
  warnings: {
    showVisualizerPhotosensitivity: true
  }
}

export function themeToFlat(theme: ThemeHues): Pick<
  AppSettings['appearance'],
  | 'uiHue'
  | 'uiBrightness'
  | 'uiSaturation'
  | 'buttonHue'
  | 'buttonBrightness'
  | 'buttonSaturation'
  | 'scrollbarHue'
  | 'scrollbarBrightness'
  | 'scrollbarSaturation'
> {
  return {
    uiHue: theme.ui.hue,
    uiBrightness: theme.ui.brightness,
    uiSaturation: theme.ui.saturation,
    buttonHue: theme.button.hue,
    buttonBrightness: theme.button.brightness,
    buttonSaturation: theme.button.saturation,
    scrollbarHue: theme.scrollbar.hue,
    scrollbarBrightness: theme.scrollbar.brightness,
    scrollbarSaturation: theme.scrollbar.saturation
  }
}

export function appearanceTheme(appearance: AppSettings['appearance']): ThemeHues {
  return appearanceToThemeHues(appearance)
}

function isSeekStep(value: unknown): value is SeekStepSeconds {
  return value === 5 || value === 10 || value === 15
}

function isVolumeStep(value: unknown): value is VolumeStep {
  return value === 0.02 || value === 0.05 || value === 0.1
}

function mergeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const appearance = raw?.appearance as Partial<AppSettings['appearance']> & {
    brightness?: number
    saturation?: number
  } | undefined
  const playback = raw?.playback
  const library = raw?.library
  const lyrics = raw?.lyrics
  const warnings = raw?.warnings

  const theme = appearanceToThemeHues(appearance ?? {})
  const flat = themeToFlat(theme)
  const savedThemes = sanitizeSavedThemes(appearance?.savedThemes)

  return {
    appearance: {
      reduceMotion: !!appearance?.reduceMotion,
      compactDensity: !!appearance?.compactDensity,
      showButtonTips:
        typeof appearance?.showButtonTips === 'boolean'
          ? appearance.showButtonTips
          : DEFAULT_SETTINGS.appearance.showButtonTips,
      galaxyChrome: appearance?.galaxyChrome !== false,
      ...flat,
      savedThemes,
      themeId:
        typeof appearance?.themeId === 'string' && appearance.themeId
          ? appearance.themeId
          : findThemeId(theme, savedThemes)
    },
    playback: {
      rememberPosition: playback?.rememberPosition !== false,
      seekStepSeconds: isSeekStep(playback?.seekStepSeconds)
        ? playback.seekStepSeconds
        : DEFAULT_SETTINGS.playback.seekStepSeconds,
      volumeStep: isVolumeStep(playback?.volumeStep)
        ? playback.volumeStep
        : DEFAULT_SETTINGS.playback.volumeStep
    },
    library: {
      autoRescanOnLaunch: !!library?.autoRescanOnLaunch,
      watchFolders: library?.watchFolders !== false
    },
    lyrics: {
      preferSidecar: lyrics?.preferSidecar !== false,
      autoScroll: lyrics?.autoScroll !== false,
      showInStage: lyrics?.showInStage !== false
    },
    warnings: {
      showVisualizerPhotosensitivity:
        typeof warnings?.showVisualizerPhotosensitivity === 'boolean'
          ? warnings.showVisualizerPhotosensitivity
          : DEFAULT_SETTINGS.warnings.showVisualizerPhotosensitivity
    }
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return mergeSettings(null)
    return mergeSettings(JSON.parse(raw) as Partial<AppSettings>)
  } catch {
    return mergeSettings(null)
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Quota or private mode — ignore
  }
}

export function patchSettings(
  current: AppSettings,
  patch: {
    appearance?: Partial<AppSettings['appearance']>
    playback?: Partial<AppSettings['playback']>
    library?: Partial<AppSettings['library']>
    lyrics?: Partial<AppSettings['lyrics']>
    warnings?: Partial<AppSettings['warnings']>
  }
): AppSettings {
  return mergeSettings({
    appearance: { ...current.appearance, ...patch.appearance },
    playback: { ...current.playback, ...patch.playback },
    library: { ...current.library, ...patch.library },
    lyrics: { ...current.lyrics, ...patch.lyrics },
    warnings: { ...current.warnings, ...patch.warnings }
  })
}
