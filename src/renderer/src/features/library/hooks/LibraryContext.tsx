import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type {
  AlbumRow,
  ArtistRow,
  LibraryFolder,
  LibrarySummary,
  LocalMix,
  NavId,
  ScanProgress,
  TrackQuery,
  TrackRow,
  TrackSort
} from '@shared/types'
import { useSettings } from '@renderer/features/settings'
import { readSession, SESSION_KEYS, writeSession } from '@renderer/lib/session'

type LibraryContextValue = {
  ready: boolean
  error: string | null
  summary: LibrarySummary
  folders: LibraryFolder[]
  tracks: TrackRow[]
  trackTotal: number
  albums: AlbumRow[]
  artists: ArtistRow[]
  genres: Array<{ genre: string; trackCount: number }>
  recentTracks: TrackRow[]
  scanProgress: ScanProgress | null
  scanning: boolean
  searchQuery: string
  setSearchQuery: (value: string) => void
  sort: TrackSort
  setSort: (value: TrackSort) => void
  activeNav: NavId
  setActiveNav: (value: NavId) => void
  selectedAlbumId: string | null
  selectedArtistId: string | null
  selectedGenre: string | null
  selectAlbum: (id: string | null) => void
  selectArtist: (id: string | null) => void
  selectGenre: (genre: string | null) => void
  selectedDailyMix: LocalMix | null
  openDailyMix: (mix: LocalMix) => void
  clearDailyMix: () => void
  refresh: () => Promise<void>
  addFolder: () => Promise<void>
  loadDemoLibrary: () => Promise<void>
  importFiles: () => Promise<void>
  removeFolder: (folderId: string) => Promise<void>
  openFolder: (folderId: string) => Promise<void>
  rescanAll: () => Promise<void>
  rescanFolder: (folderId: string) => Promise<void>
}

const emptySummary: LibrarySummary = {
  trackCount: 0,
  albumCount: 0,
  artistCount: 0,
  folderCount: 0,
  missingCount: 0,
  incompleteCount: 0
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

const NAV_IDS: NavId[] = [
  'home',
  'songs',
  'albums',
  'artists',
  'genres',
  'folders',
  'playlists',
  'lyrics',
  'browse',
  'recent-added',
  'daily-mix'
]

const SORTS: TrackSort[] = [
  'title',
  'artist',
  'album',
  'duration',
  'date_added',
  'track_number'
]

type LibrarySession = {
  activeNav: NavId
  selectedAlbumId: string | null
  selectedArtistId: string | null
  selectedGenre: string | null
  searchQuery: string
  sort: TrackSort
}

function loadLibrarySession(): LibrarySession {
  const raw = readSession<Partial<LibrarySession>>(SESSION_KEYS.library)
  const savedNav =
    raw?.activeNav && NAV_IDS.includes(raw.activeNav) ? raw.activeNav : 'home'
  // Mix detail is ephemeral — do not restore into an empty mix page.
  const activeNav = savedNav === 'daily-mix' ? 'home' : savedNav
  const sort = raw?.sort && SORTS.includes(raw.sort) ? raw.sort : 'date_added'
  return {
    activeNav,
    selectedAlbumId: typeof raw?.selectedAlbumId === 'string' ? raw.selectedAlbumId : null,
    selectedArtistId: typeof raw?.selectedArtistId === 'string' ? raw.selectedArtistId : null,
    selectedGenre: typeof raw?.selectedGenre === 'string' ? raw.selectedGenre : null,
    searchQuery: typeof raw?.searchQuery === 'string' ? raw.searchQuery : '',
    sort
  }
}

function hasLibraryApi(): boolean {
  return typeof window !== 'undefined' && !!window.api?.library
}

export function LibraryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { settings } = useSettings()
  const autoRescanAttemptedRef = useRef(false)
  const [initialSession] = useState(loadLibrarySession)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<LibrarySummary>(emptySummary)
  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [trackTotal, setTrackTotal] = useState(0)
  const [albums, setAlbums] = useState<AlbumRow[]>([])
  const [artists, setArtists] = useState<ArtistRow[]>([])
  const [genres, setGenres] = useState<Array<{ genre: string; trackCount: number }>>([])
  const [recentTracks, setRecentTracks] = useState<TrackRow[]>([])
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scanning, setScanning] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialSession.searchQuery)
  const [sort, setSort] = useState<TrackSort>(initialSession.sort)
  const [activeNav, setActiveNav] = useState<NavId>(initialSession.activeNav)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(
    initialSession.selectedAlbumId
  )
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(
    initialSession.selectedArtistId
  )
  const [selectedGenre, setSelectedGenre] = useState<string | null>(initialSession.selectedGenre)
  const [selectedDailyMix, setSelectedDailyMix] = useState<LocalMix | null>(null)

  useEffect(() => {
    writeSession(SESSION_KEYS.library, {
      activeNav: activeNav === 'daily-mix' ? 'home' : activeNav,
      selectedAlbumId,
      selectedArtistId,
      selectedGenre,
      searchQuery,
      sort
    } satisfies LibrarySession)
  }, [activeNav, searchQuery, selectedAlbumId, selectedArtistId, selectedGenre, sort])

  const setActiveNavSafe = useCallback((value: NavId): void => {
    if (value !== 'daily-mix') setSelectedDailyMix(null)
    setActiveNav(value)
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    if (!hasLibraryApi()) {
      setError(
        'Not in the desktop app. Close this browser tab and use the Umbrix Groove window (dark framed app) — not localhost in Chrome or a Cursor preview.'
      )
      setReady(true)
      return
    }

    try {
      const resolvedSort: TrackSort = selectedAlbumId ? 'track_number' : sort
      const query: TrackQuery = {
        query: searchQuery,
        sort: resolvedSort,
        // Newest library adds first; other sorts stay A→Z / low→high.
        ascending: resolvedSort !== 'date_added',
        limit: 2000,
        albumId: selectedAlbumId ?? undefined,
        artistId: selectedArtistId ?? undefined,
        genre: selectedGenre ?? undefined
      }

      const [nextSummary, nextFolders, trackResult, nextAlbums, nextArtists, nextGenres, recent] =
        await Promise.all([
          window.api.library.getSummary(),
          window.api.library.listFolders(),
          window.api.library.queryTracks(query),
          window.api.library.listAlbums(searchQuery || undefined),
          window.api.library.listArtists(searchQuery || undefined),
          window.api.library.listGenres(),
          window.api.library.getRecentTracks(18)
        ])

      setSummary(nextSummary)
      setFolders(nextFolders)
      setTracks(trackResult.tracks)
      setTrackTotal(trackResult.total)
      setAlbums(nextAlbums)
      setArtists(nextArtists)
      setGenres(nextGenres)
      setRecentTracks(recent)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReady(true)
    }
  }, [searchQuery, selectedAlbumId, selectedArtistId, selectedGenre, sort])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!hasLibraryApi()) return
    const unsubscribe = window.api.library.onScanProgress((progress) => {
      setScanProgress(progress)
      setScanning(progress.phase !== 'done' && progress.phase !== 'error')
      if (progress.phase === 'done' || progress.phase === 'error') {
        void refresh()
      }
    })
    return unsubscribe
  }, [refresh])

  const addFolder = useCallback(async (): Promise<void> => {
    if (!hasLibraryApi()) {
      setError(
        'Not in the desktop app. Close this browser tab and use the Umbrix Groove window (dark framed app) — not localhost in Chrome or a Cursor preview.'
      )
      return
    }
    setScanning(true)
    setError(null)
    try {
      const result = await window.api.library.addFolder()
      if (!result.cancelled) {
        await refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [refresh])

  const loadDemoLibrary = useCallback(async (): Promise<void> => {
    if (!hasLibraryApi()) {
      setError(
        'Not in the desktop app. Close this browser tab and use the Umbrix Groove window (dark framed app) — not localhost in Chrome or a Cursor preview.'
      )
      return
    }
    setScanning(true)
    setError(null)
    try {
      await window.api.library.loadDemoLibrary()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [refresh])

  const importFiles = useCallback(async (): Promise<void> => {
    if (!hasLibraryApi()) {
      setError(
        'Not in the desktop app. Close this browser tab and use the Umbrix Groove window (dark framed app) — not localhost in Chrome or a Cursor preview.'
      )
      return
    }
    setScanning(true)
    setError(null)
    try {
      await window.api.library.importFiles()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [refresh])

  const removeFolder = useCallback(
    async (folderId: string): Promise<void> => {
      if (!hasLibraryApi()) return
      const folder = folders.find((item) => item.id === folderId)
      const confirmed = window.confirm(
        `Remove "${folder?.path ?? 'this folder'}" from Umbrix Groove?\n\nYour music files on disk will not be deleted. Playlist support arrives later; only library index rows for this folder are removed.`
      )
      if (!confirmed) return
      await window.api.library.removeFolder(folderId)
      await refresh()
    },
    [folders, refresh]
  )

  const openFolder = useCallback(async (folderId: string): Promise<void> => {
    if (!hasLibraryApi()) return
    try {
      await window.api.library.openFolder(folderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const rescanAll = useCallback(async (): Promise<void> => {
    if (!hasLibraryApi()) return
    setScanning(true)
    try {
      await window.api.library.rescanAll()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }, [refresh])

  useEffect(() => {
    if (!ready || autoRescanAttemptedRef.current) return
    // Snapshot the launch preference once the library is ready — do not rescan mid-session
    // just because the user flipped the toggle later.
    if (!settings.library.autoRescanOnLaunch || folders.length === 0) {
      autoRescanAttemptedRef.current = true
      return
    }
    if (scanning) return
    autoRescanAttemptedRef.current = true
    void rescanAll()
  }, [ready, settings.library.autoRescanOnLaunch, folders.length, scanning, rescanAll])

  /** Keep main-process folder watchers in sync with Settings. */
  useEffect(() => {
    if (!hasLibraryApi() || !window.api.library.setFolderWatchEnabled) return
    void window.api.library.setFolderWatchEnabled(settings.library.watchFolders).catch(() => {
      // Older main builds without watch IPC — ignore
    })
  }, [settings.library.watchFolders])

  const rescanFolder = useCallback(
    async (folderId: string): Promise<void> => {
      if (!hasLibraryApi()) return
      setScanning(true)
      try {
        await window.api.library.rescanFolder(folderId)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setScanning(false)
      }
    },
    [refresh]
  )

  const selectAlbum = useCallback(
    (id: string | null): void => {
      setSelectedAlbumId(id)
      setSelectedArtistId(null)
      setSelectedGenre(null)
      if (id) setActiveNavSafe('albums')
    },
    [setActiveNavSafe]
  )

  const selectArtist = useCallback(
    (id: string | null): void => {
      setSelectedArtistId(id)
      setSelectedAlbumId(null)
      setSelectedGenre(null)
      if (id) setActiveNavSafe('artists')
    },
    [setActiveNavSafe]
  )

  const selectGenre = useCallback(
    (genre: string | null): void => {
      setSelectedGenre(genre)
      setSelectedAlbumId(null)
      setSelectedArtistId(null)
      if (genre) setActiveNavSafe('genres')
    },
    [setActiveNavSafe]
  )

  const openDailyMix = useCallback((mix: LocalMix): void => {
    setSelectedDailyMix(mix)
    setActiveNav('daily-mix')
  }, [])

  const clearDailyMix = useCallback((): void => {
    setSelectedDailyMix(null)
    setActiveNav('home')
  }, [])

  const value = useMemo<LibraryContextValue>(
    () => ({
      ready,
      error,
      summary,
      folders,
      tracks,
      trackTotal,
      albums,
      artists,
      genres,
      recentTracks,
      scanProgress,
      scanning,
      searchQuery,
      setSearchQuery,
      sort,
      setSort,
      activeNav,
      setActiveNav: setActiveNavSafe,
      selectedAlbumId,
      selectedArtistId,
      selectedGenre,
      selectAlbum,
      selectArtist,
      selectGenre,
      selectedDailyMix,
      openDailyMix,
      clearDailyMix,
      refresh,
      addFolder,
      loadDemoLibrary,
      importFiles,
      removeFolder,
      openFolder,
      rescanAll,
      rescanFolder
    }),
    [
      ready,
      error,
      summary,
      folders,
      tracks,
      trackTotal,
      albums,
      artists,
      genres,
      recentTracks,
      scanProgress,
      scanning,
      searchQuery,
      sort,
      activeNav,
      setActiveNavSafe,
      selectedAlbumId,
      selectedArtistId,
      selectedGenre,
      selectAlbum,
      selectArtist,
      selectGenre,
      selectedDailyMix,
      openDailyMix,
      clearDailyMix,
      refresh,
      addFolder,
      loadDemoLibrary,
      importFiles,
      removeFolder,
      openFolder,
      rescanAll,
      rescanFolder
    ]
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) {
    throw new Error('useLibrary must be used within LibraryProvider')
  }
  return ctx
}
