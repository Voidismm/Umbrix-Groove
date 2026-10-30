import { useEffect, useMemo, useRef } from 'react'
import type { LocalMix, NavId } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import { usePlaylists } from '@renderer/features/playlists'

type NavSnapshot = {
  activeNav: NavId
  selectedAlbumId: string | null
  selectedArtistId: string | null
  selectedGenre: string | null
  selectedPlaylistId: string | null
  dailyMixId: string | null
}

type HistoryState = { ug?: NavSnapshot }

function sameSnap(a: NavSnapshot, b: NavSnapshot): boolean {
  return (
    a.activeNav === b.activeNav &&
    a.selectedAlbumId === b.selectedAlbumId &&
    a.selectedArtistId === b.selectedArtistId &&
    a.selectedGenre === b.selectedGenre &&
    a.selectedPlaylistId === b.selectedPlaylistId &&
    a.dailyMixId === b.dailyMixId
  )
}

/**
 * Mouse back / forward (and Chromium history) for library navigation —
 * albums, artists, genres, playlists, daily mixes, and main tabs.
 */
export function NavHistoryBridge(): null {
  const {
    activeNav,
    selectedAlbumId,
    selectedArtistId,
    selectedGenre,
    selectedDailyMix,
    setActiveNav,
    selectAlbum,
    selectArtist,
    selectGenre,
    openDailyMix,
    clearDailyMix
  } = useLibrary()
  const { selectedPlaylistId, selectPlaylist } = usePlaylists()

  const applyingRef = useRef(false)
  const seededRef = useRef(false)
  const mixCacheRef = useRef(new Map<string, LocalMix>())

  const restoreRef = useRef<(snap: NavSnapshot) => void>(() => undefined)

  useEffect(() => {
    if (selectedDailyMix) {
      mixCacheRef.current.set(selectedDailyMix.id, selectedDailyMix)
    }
  }, [selectedDailyMix])

  const snapshot = useMemo<NavSnapshot>(
    () => ({
      activeNav,
      selectedAlbumId,
      selectedArtistId,
      selectedGenre,
      selectedPlaylistId,
      dailyMixId: selectedDailyMix?.id ?? null
    }),
    [
      activeNav,
      selectedAlbumId,
      selectedArtistId,
      selectedGenre,
      selectedPlaylistId,
      selectedDailyMix?.id
    ]
  )

  restoreRef.current = (snap: NavSnapshot): void => {
    applyingRef.current = true

    if (snap.dailyMixId) {
      const mix = mixCacheRef.current.get(snap.dailyMixId)
      if (mix) {
        openDailyMix(mix)
        selectPlaylist(snap.selectedPlaylistId)
        return
      }
    }

    if (snap.selectedAlbumId) {
      selectAlbum(snap.selectedAlbumId)
      selectPlaylist(snap.selectedPlaylistId)
      return
    }

    if (snap.selectedArtistId) {
      selectArtist(snap.selectedArtistId)
      selectPlaylist(snap.selectedPlaylistId)
      return
    }

    if (snap.selectedGenre) {
      selectGenre(snap.selectedGenre)
      selectPlaylist(snap.selectedPlaylistId)
      return
    }

    selectAlbum(null)
    selectArtist(null)
    selectGenre(null)
    if (selectedDailyMix) clearDailyMix()
    selectPlaylist(snap.selectedPlaylistId)
    setActiveNav(snap.activeNav === 'daily-mix' ? 'home' : snap.activeNav)
  }

  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true
      window.history.replaceState({ ug: snapshot } satisfies HistoryState, '')
      return
    }
    if (applyingRef.current) {
      applyingRef.current = false
      window.history.replaceState({ ug: snapshot } satisfies HistoryState, '')
      return
    }
    const prev = (window.history.state as HistoryState | null)?.ug
    if (prev && sameSnap(prev, snapshot)) return
    window.history.pushState({ ug: snapshot } satisfies HistoryState, '')
  }, [snapshot])

  useEffect(() => {
    const onPopState = (event: PopStateEvent): void => {
      const snap = (event.state as HistoryState | null)?.ug
      if (!snap) return
      restoreRef.current(snap)
    }

    const onMouseDown = (event: MouseEvent): void => {
      if (event.button === 3 || event.button === 4) {
        event.preventDefault()
      }
    }

    const onMouseUp = (event: MouseEvent): void => {
      if (event.button === 3) {
        event.preventDefault()
        window.history.back()
        return
      }
      if (event.button === 4) {
        event.preventDefault()
        window.history.forward()
      }
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return null
}
