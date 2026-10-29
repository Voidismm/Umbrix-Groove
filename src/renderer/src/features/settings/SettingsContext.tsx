import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  loadSettings,
  patchSettings,
  saveSettings,
  type AppSettings
} from './settingsStore'

type SettingsContextValue = {
  settings: AppSettings
  setAppearance: (patch: Partial<AppSettings['appearance']>) => void
  setPlayback: (patch: Partial<AppSettings['playback']>) => void
  setLibrary: (patch: Partial<AppSettings['library']>) => void
  setLyrics: (patch: Partial<AppSettings['lyrics']>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function applyDocumentPrefs(settings: AppSettings): void {
  const root = document.documentElement
  root.dataset.reduceMotion = settings.appearance.reduceMotion ? 'true' : 'false'
  root.dataset.density = settings.appearance.compactDensity ? 'compact' : 'comfortable'
}

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  useEffect(() => {
    applyDocumentPrefs(settings)
    saveSettings(settings)
  }, [settings])

  const setAppearance = useCallback((patch: Partial<AppSettings['appearance']>): void => {
    setSettings((prev) => patchSettings(prev, { appearance: patch }))
  }, [])

  const setPlayback = useCallback((patch: Partial<AppSettings['playback']>): void => {
    setSettings((prev) => patchSettings(prev, { playback: patch }))
  }, [])

  const setLibrary = useCallback((patch: Partial<AppSettings['library']>): void => {
    setSettings((prev) => patchSettings(prev, { library: patch }))
  }, [])

  const setLyrics = useCallback((patch: Partial<AppSettings['lyrics']>): void => {
    setSettings((prev) => patchSettings(prev, { lyrics: patch }))
  }, [])

  const value = useMemo(
    () => ({
      settings,
      setAppearance,
      setPlayback,
      setLibrary,
      setLyrics
    }),
    [settings, setAppearance, setPlayback, setLibrary, setLyrics]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
