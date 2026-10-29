/** Persisted app preferences (Settings modal). Separate from ephemeral session keys. */

export const SETTINGS_STORAGE_KEY = 'umbrix.settings'

export type SeekStepSeconds = 5 | 10 | 15
export type VolumeStep = 0.02 | 0.05 | 0.1

export type AppSettings = {
  appearance: {
    reduceMotion: boolean
    compactDensity: boolean
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
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: {
    reduceMotion: false,
    compactDensity: false
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
  }
}

function isSeekStep(value: unknown): value is SeekStepSeconds {
  return value === 5 || value === 10 || value === 15
}

function isVolumeStep(value: unknown): value is VolumeStep {
  return value === 0.02 || value === 0.05 || value === 0.1
}

function mergeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const appearance = raw?.appearance
  const playback = raw?.playback
  const library = raw?.library
  const lyrics = raw?.lyrics

  return {
    appearance: {
      reduceMotion: !!appearance?.reduceMotion,
      compactDensity: !!appearance?.compactDensity
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
  }
): AppSettings {
  return mergeSettings({
    appearance: { ...current.appearance, ...patch.appearance },
    playback: { ...current.playback, ...patch.playback },
    library: { ...current.library, ...patch.library },
    lyrics: { ...current.lyrics, ...patch.lyrics }
  })
}
