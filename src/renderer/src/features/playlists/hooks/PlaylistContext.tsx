import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type {
  PlaylistDetail,
  PlaylistSummary,
  PlaylistTreeItemRef,
  PlaylistTreeNode,
  TrackRow
} from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { PromptDialog } from '@renderer/components/ui/PromptDialog'
import { useLibrary } from '@renderer/features/library/hooks/useLibrary'
import { readSession, SESSION_KEYS, writeSession } from '@renderer/lib/session'
import { AddToPlaylistPicker } from '../components/AddToPlaylistPicker'

type ConfirmState = {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  run: () => Promise<void>
}

type NamePromptState = {
  title: string
  message?: string
  label?: string
  initialValue: string
  confirmLabel: string
  run: (value: string) => Promise<void>
}

type AddTracksPickerState = {
  trackIds: string[]
  anchor: { x: number; y: number }
}

type PlaylistContextValue = {
  ready: boolean
  error: string | null
  tree: PlaylistTreeNode[]
  playlists: PlaylistSummary[]
  selectedPlaylistId: string | null
  selectedPlaylist: PlaylistDetail | null
  selectedTracks: TrackRow[]
  likedIds: Set<string>
  ratings: Record<string, number>
  selectPlaylist: (id: string | null) => void
  /** Opens a playlist and asks the detail page to show Edit details. */
  openPlaylistEditor: (id: string) => void
  editRequestId: string | null
  clearEditRequest: () => void
  refresh: () => Promise<void>
  createPlaylist: (name?: string, folderId?: string | null) => Promise<void>
  createFolder: (name?: string, parentId?: string | null) => Promise<void>
  /** Opens the in-app rename dialog (Electron has no window.prompt). */
  askRenamePlaylist: (playlistId: string, currentName: string) => void
  askRenameFolder: (folderId: string, currentName: string) => void
  renamePlaylist: (playlistId: string, name: string) => Promise<void>
  setPlaylistDescription: (playlistId: string, description: string | null) => Promise<void>
  choosePlaylistCover: (playlistId: string) => Promise<void>
  setPlaylistCoverData: (playlistId: string, data: ArrayBuffer, mime: string) => Promise<void>
  clearPlaylistCover: (playlistId: string) => Promise<void>
  setPlaylistAccentColor: (playlistId: string, accentColor: string | null) => Promise<void>
  renameFolder: (folderId: string, name: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
  deleteFolder: (folderId: string) => Promise<void>
  movePlaylist: (playlistId: string, folderId: string | null) => Promise<void>
  moveFolder: (folderId: string, parentId: string | null) => Promise<void>
  /** Drag-reorder / reparent a playlist or folder among siblings. */
  placeTreeItem: (
    item: PlaylistTreeItemRef,
    parentId: string | null,
    index: number
  ) => Promise<void>
  addTracks: (playlistId: string, trackIds: string[]) => Promise<number>
  /** Open the searchable add-to-playlist picker (optional screen anchor). */
  askAddTracksToPlaylist: (trackIds: string[], anchor?: { x: number; y: number }) => void
  /** Create a playlist via name prompt, then add the given tracks into it. */
  askCreatePlaylistWithTracks: (trackIds: string[]) => void
  removeTrack: (playlistId: string, trackId: string) => Promise<void>
  reorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>
  toggleLiked: (trackId: string) => Promise<void>
  isLiked: (trackId: string) => boolean
  setRating: (trackId: string, rating: number | null) => Promise<void>
  getRating: (trackId: string) => number | null
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null)

function hasPlaylistsApi(): boolean {
  return typeof window !== 'undefined' && !!window.api?.playlists
}

export function PlaylistProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { setActiveNav } = useLibrary()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tree, setTree] = useState<PlaylistTreeNode[]>([])
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(() => {
    const saved = readSession<{ selectedPlaylistId?: string | null }>(SESSION_KEYS.playlist)
    return typeof saved?.selectedPlaylistId === 'string' ? saved.selectedPlaylistId : null
  })
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<TrackRow[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [editRequestId, setEditRequestId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [namePrompt, setNamePrompt] = useState<NamePromptState | null>(null)
  const [namePromptBusy, setNamePromptBusy] = useState(false)
  const [addTracksPicker, setAddTracksPicker] = useState<AddTracksPickerState | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!hasPlaylistsApi()) {
      setReady(true)
      return
    }
    try {
      const [nextTree, nextPlaylists, liked] = await Promise.all([
        window.api.playlists.getTree(),
        window.api.playlists.list(),
        window.api.playlists.getLikedTrackIds()
      ])
      setTree(nextTree)
      setPlaylists(nextPlaylists)
      setLikedIds(new Set(liked))
      setError(null)

      if (selectedPlaylistId) {
        try {
          const [detail, tracks] = await Promise.all([
            window.api.playlists.get(selectedPlaylistId),
            window.api.playlists.getTracks(selectedPlaylistId)
          ])
          setSelectedPlaylist(detail)
          setSelectedTracks(tracks)
          const map = await window.api.playlists.getRatingsMap(tracks.map((t) => t.id))
          setRatings((prev) => ({ ...prev, ...map }))
        } catch {
          setSelectedPlaylistId(null)
          setSelectedPlaylist(null)
          setSelectedTracks([])
        }
      } else {
        setSelectedPlaylist(null)
        setSelectedTracks([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReady(true)
    }
  }, [selectedPlaylistId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    writeSession(SESSION_KEYS.playlist, { selectedPlaylistId })
  }, [selectedPlaylistId])

  const selectPlaylist = useCallback(
    (id: string | null): void => {
      setSelectedPlaylistId(id)
      if (id) {
        setActiveNav('playlists')
      }
    },
    [setActiveNav]
  )

  const openPlaylistEditor = useCallback(
    (id: string): void => {
      setEditRequestId(id)
      setSelectedPlaylistId(id)
      setActiveNav('playlists')
    },
    [setActiveNav]
  )

  const clearEditRequest = useCallback((): void => {
    setEditRequestId(null)
  }, [])

  const createPlaylist = useCallback(
    async (name?: string, folderId?: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const finish = async (label: string): Promise<void> => {
        const created = await window.api.playlists.create(label, folderId ?? null)
        await refresh()
        selectPlaylist(created.id)
      }
      const given = name?.trim()
      if (given) {
        await finish(given)
        return
      }
      setNamePrompt({
        title: 'New playlist',
        label: 'Playlist name',
        initialValue: 'New Playlist',
        confirmLabel: 'Create',
        run: finish
      })
    },
    [refresh, selectPlaylist]
  )

  const createFolder = useCallback(
    async (name?: string, parentId?: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const finish = async (label: string): Promise<void> => {
        await window.api.playlists.createFolder(label, parentId ?? null)
        await refresh()
        setActiveNav('playlists')
      }
      const given = name?.trim()
      if (given) {
        await finish(given)
        return
      }
      setNamePrompt({
        title: 'New folder',
        label: 'Folder name',
        initialValue: 'New Folder',
        confirmLabel: 'Create',
        run: finish
      })
    },
    [refresh, setActiveNav]
  )

  const renamePlaylist = useCallback(
    async (playlistId: string, name: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.rename(playlistId, name)
      await refresh()
    },
    [refresh]
  )

  const askRenamePlaylist = useCallback(
    (playlistId: string, currentName: string): void => {
      if (!hasPlaylistsApi()) return
      setNamePrompt({
        title: 'Rename playlist',
        label: 'Playlist name',
        initialValue: currentName,
        confirmLabel: 'Save',
        run: async (next) => {
          await window.api.playlists.rename(playlistId, next)
          await refresh()
        }
      })
    },
    [refresh]
  )

  const askRenameFolder = useCallback(
    (folderId: string, currentName: string): void => {
      if (!hasPlaylistsApi()) return
      setNamePrompt({
        title: 'Rename folder',
        label: 'Folder name',
        initialValue: currentName,
        confirmLabel: 'Save',
        run: async (next) => {
          await window.api.playlists.renameFolder(folderId, next)
          await refresh()
        }
      })
    },
    [refresh]
  )

  const setPlaylistDescription = useCallback(
    async (playlistId: string, description: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.setDescription(playlistId, description)
      await refresh()
    },
    [refresh]
  )

  const choosePlaylistCover = useCallback(
    async (playlistId: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const updated = await window.api.playlists.chooseCover(playlistId)
      if (!updated) return
      await refresh()
    },
    [refresh]
  )

  const setPlaylistCoverData = useCallback(
    async (playlistId: string, data: ArrayBuffer, mime: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const api = window.api.playlists
      if (typeof api.setCoverData === 'function') {
        await api.setCoverData(playlistId, data, mime)
      } else if (typeof api.chooseCover === 'function') {
        // Stale preload fallback — native picker still writes the cover.
        const updated = await api.chooseCover(playlistId)
        if (!updated) return
      } else {
        throw new Error('Cover upload is unavailable. Fully quit and restart Umbrix Groove.')
      }
      await refresh()
    },
    [refresh]
  )

  const clearPlaylistCover = useCallback(
    async (playlistId: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.clearCover(playlistId)
      await refresh()
    },
    [refresh]
  )

  const setPlaylistAccentColor = useCallback(
    async (playlistId: string, accentColor: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.setAccentColor(playlistId, accentColor)
      await refresh()
    },
    [refresh]
  )

  const renameFolder = useCallback(
    async (folderId: string, name: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.renameFolder(folderId, name)
      await refresh()
    },
    [refresh]
  )

  const deletePlaylist = useCallback(
    async (playlistId: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const target = playlists.find((item) => item.id === playlistId)
      if (target?.isSystem) {
        setConfirm({
          title: 'Cannot delete',
          message: 'Loved Songs is a system playlist and cannot be deleted.',
          confirmLabel: 'Got it',
          danger: false,
          run: async () => undefined
        })
        return
      }
      const name = target?.name ?? 'this playlist'
      setConfirm({
        title: 'Delete playlist?',
        message: `Are you sure you want to delete “${name}”? Tracks stay on disk.`,
        confirmLabel: 'Delete',
        danger: true,
        run: async () => {
          await window.api.playlists.delete(playlistId)
          if (selectedPlaylistId === playlistId) {
            setSelectedPlaylistId(null)
            setSelectedPlaylist(null)
            setSelectedTracks([])
          }
          await refresh()
        }
      })
    },
    [playlists, refresh, selectedPlaylistId]
  )

  const deleteFolder = useCallback(async (folderId: string): Promise<void> => {
    if (!hasPlaylistsApi()) return
    setConfirm({
      title: 'Delete folder?',
      message:
        'Are you sure you want to delete this folder? Playlists inside move to the root. Nested folders are removed.',
      confirmLabel: 'Delete',
      danger: true,
      run: async () => {
        await window.api.playlists.deleteFolder(folderId)
        await refresh()
      }
    })
  }, [refresh])

  const movePlaylist = useCallback(
    async (playlistId: string, folderId: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.move(playlistId, folderId)
      await refresh()
    },
    [refresh]
  )

  const moveFolder = useCallback(
    async (folderId: string, parentId: string | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.moveFolder(folderId, parentId)
      await refresh()
    },
    [refresh]
  )

  const placeTreeItem = useCallback(
    async (
      item: PlaylistTreeItemRef,
      parentId: string | null,
      index: number
    ): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const nextTree = await window.api.playlists.placeTreeItem(item, parentId, index)
      setTree(nextTree)
      const nextPlaylists = await window.api.playlists.list()
      setPlaylists(nextPlaylists)
    },
    []
  )

  const addTracks = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<number> => {
      if (!hasPlaylistsApi()) return 0
      const result = await window.api.playlists.addTracks(playlistId, trackIds)
      await refresh()
      if (result.added === 0 && trackIds.length > 0) {
        const playlist = playlists.find((item) => item.id === playlistId)
        const label =
          playlist?.systemKey === 'liked' || playlist?.name === 'Liked Songs'
            ? 'Loved Songs'
            : (playlist?.name ?? 'this playlist')
        setConfirm({
          title: 'Already in playlist',
          message:
            trackIds.length === 1
              ? `That song is already in ${label}.`
              : `Those songs are already in ${label}.`,
          confirmLabel: 'Got it',
          danger: false,
          run: async () => undefined
        })
      }
      return result.added
    },
    [playlists, refresh]
  )

  const askCreatePlaylistWithTracks = useCallback(
    (trackIds: string[]): void => {
      if (!hasPlaylistsApi() || trackIds.length === 0) return
      setAddTracksPicker(null)
      setNamePrompt({
        title: 'New playlist',
        label: 'Playlist name',
        initialValue: 'New Playlist',
        confirmLabel: 'Create',
        run: async (label) => {
          const created = await window.api.playlists.create(label, null)
          await window.api.playlists.addTracks(created.id, trackIds)
          await refresh()
          selectPlaylist(created.id)
        }
      })
    },
    [refresh, selectPlaylist]
  )

  const askAddTracksToPlaylist = useCallback(
    (trackIds: string[], anchor?: { x: number; y: number }): void => {
      if (!hasPlaylistsApi() || trackIds.length === 0) return
      const point = anchor ?? {
        x: Math.max(16, Math.round(window.innerWidth / 2 - 130)),
        y: Math.max(16, Math.round(window.innerHeight / 2 - 160))
      }
      setAddTracksPicker({ trackIds, anchor: point })
    },
    []
  )

  const removeTrack = useCallback(
    async (playlistId: string, trackId: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.removeTrack(playlistId, trackId)
      await refresh()
    },
    [refresh]
  )

  const reorderTracks = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<void> => {
      if (!hasPlaylistsApi()) return
      await window.api.playlists.reorderTracks(playlistId, trackIds)
      await refresh()
    },
    [refresh]
  )

  const toggleLiked = useCallback(
    async (trackId: string): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const next = !likedIds.has(trackId)
      await window.api.playlists.setLiked(trackId, next)
      setLikedIds((prev) => {
        const copy = new Set(prev)
        if (next) copy.add(trackId)
        else copy.delete(trackId)
        return copy
      })
      await refresh()
    },
    [likedIds, refresh]
  )

  const isLiked = useCallback((trackId: string): boolean => likedIds.has(trackId), [likedIds])

  const setRating = useCallback(
    async (trackId: string, rating: number | null): Promise<void> => {
      if (!hasPlaylistsApi()) return
      const result = await window.api.playlists.setRating(trackId, rating)
      setRatings((prev) => {
        const copy = { ...prev }
        if (result.rating == null) delete copy[trackId]
        else copy[trackId] = result.rating
        return copy
      })
    },
    []
  )

  const getRating = useCallback(
    (trackId: string): number | null => ratings[trackId] ?? null,
    [ratings]
  )

  const value = useMemo(
    () => ({
      ready,
      error,
      tree,
      playlists,
      selectedPlaylistId,
      selectedPlaylist,
      selectedTracks,
      likedIds,
      ratings,
      selectPlaylist,
      openPlaylistEditor,
      editRequestId,
      clearEditRequest,
      refresh,
      createPlaylist,
      createFolder,
      askRenamePlaylist,
      askRenameFolder,
      renamePlaylist,
      setPlaylistDescription,
      choosePlaylistCover,
      setPlaylistCoverData,
      clearPlaylistCover,
      setPlaylistAccentColor,
      renameFolder,
      deletePlaylist,
      deleteFolder,
      movePlaylist,
      moveFolder,
      placeTreeItem,
      addTracks,
      askAddTracksToPlaylist,
      askCreatePlaylistWithTracks,
      removeTrack,
      reorderTracks,
      toggleLiked,
      isLiked,
      setRating,
      getRating
    }),
    [
      ready,
      error,
      tree,
      playlists,
      selectedPlaylistId,
      selectedPlaylist,
      selectedTracks,
      likedIds,
      ratings,
      selectPlaylist,
      openPlaylistEditor,
      editRequestId,
      clearEditRequest,
      refresh,
      createPlaylist,
      createFolder,
      askRenamePlaylist,
      askRenameFolder,
      renamePlaylist,
      setPlaylistDescription,
      choosePlaylistCover,
      setPlaylistCoverData,
      clearPlaylistCover,
      setPlaylistAccentColor,
      renameFolder,
      deletePlaylist,
      deleteFolder,
      movePlaylist,
      moveFolder,
      placeTreeItem,
      addTracks,
      askAddTracksToPlaylist,
      askCreatePlaylistWithTracks,
      removeTrack,
      reorderTracks,
      toggleLiked,
      isLiked,
      setRating,
      getRating
    ]
  )

  return (
    <PlaylistContext.Provider value={value}>
      {children}
      {addTracksPicker ? (
        <AddToPlaylistPicker
          playlists={playlists}
          anchor={addTracksPicker.anchor}
          onClose={() => setAddTracksPicker(null)}
          onSelectPlaylist={(playlistId) => {
            const trackIds = addTracksPicker.trackIds
            setAddTracksPicker(null)
            void addTracks(playlistId, trackIds)
          }}
          onNewPlaylist={() => {
            askCreatePlaylistWithTracks(addTracksPicker.trackIds)
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger !== false}
        busy={confirmBusy}
        onCancel={() => {
          if (confirmBusy) return
          setConfirm(null)
        }}
        onConfirm={() => {
          if (!confirm || confirmBusy) return
          void (async () => {
            setConfirmBusy(true)
            try {
              await confirm.run()
              setConfirm(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
              setConfirm(null)
            } finally {
              setConfirmBusy(false)
            }
          })()
        }}
      />
      <PromptDialog
        open={!!namePrompt}
        title={namePrompt?.title ?? ''}
        message={namePrompt?.message}
        label={namePrompt?.label}
        initialValue={namePrompt?.initialValue ?? ''}
        confirmLabel={namePrompt?.confirmLabel}
        busy={namePromptBusy}
        onCancel={() => {
          if (namePromptBusy) return
          setNamePrompt(null)
        }}
        onConfirm={(value) => {
          if (!namePrompt || namePromptBusy) return
          void (async () => {
            setNamePromptBusy(true)
            try {
              await namePrompt.run(value)
              setNamePrompt(null)
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
              setNamePrompt(null)
            } finally {
              setNamePromptBusy(false)
            }
          })()
        }}
      />
    </PlaylistContext.Provider>
  )
}

export function usePlaylists(): PlaylistContextValue {
  const ctx = useContext(PlaylistContext)
  if (!ctx) throw new Error('usePlaylists must be used within PlaylistProvider')
  return ctx
}
