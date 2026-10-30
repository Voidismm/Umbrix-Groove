import { useCallback, useMemo, useState } from 'react'
import type { PlaylistTreeItemRef, PlaylistTreeNode } from '@shared/types'
import { Icon } from '@renderer/components/ui/Icon'
import { usePlayback } from '@renderer/features/player'
import { usePlaylists } from '../hooks/usePlaylists'
import { hasTrackDrag, readTrackDragId } from '../trackDrag'
import { PlaylistContextMenu, type PlaylistMenuItem } from './PlaylistContextMenu'
import { PlaylistCoverThumb } from './PlaylistCoverThumb'
import './PlaylistTree.css'

type DragPayload = PlaylistTreeItemRef

type DropPlacement = 'before' | 'after' | 'inside'

type DropTarget = {
  nodeId: string
  nodeType: 'folder' | 'playlist'
  parentId: string | null
  placement: DropPlacement
}

type MenuState = {
  x: number
  y: number
  items: PlaylistMenuItem[]
}

type TreeDnD = {
  drag: DragPayload | null
  drop: DropTarget | null
  /** Playlist id highlighted while dragging a library track onto it. */
  trackDropId: string | null
  setDrag: (payload: DragPayload | null) => void
  setDrop: (target: DropTarget | null) => void
  setTrackDropId: (playlistId: string | null) => void
  commitDrop: (target: DropTarget) => void
  commitTrackDrop: (playlistId: string, trackId: string) => void
}

/** Playback actions owned by PlaylistTree — nodes must not call usePlayback(). */
type TreePlayback = {
  closeVisualizer: () => void
  playPlaylist: (playlistId: string) => void
  queuePlaylist: (playlistId: string) => void
}

function parseDrag(event: React.DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData('application/x-umbrix-playlist')
    if (!raw) return null
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function flattenFolders(nodes: PlaylistTreeNode[]): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = []
  const walk = (list: PlaylistTreeNode[]): void => {
    for (const node of list) {
      if (node.type === 'folder') {
        out.push({ id: node.id, name: node.name })
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return out
}

function findNode(
  nodes: PlaylistTreeNode[],
  id: string,
  type: 'folder' | 'playlist'
): PlaylistTreeNode | null {
  for (const node of nodes) {
    if (node.id === id && node.type === type) return node
    const nested = findNode(node.children, id, type)
    if (nested) return nested
  }
  return null
}

function movableChildren(
  tree: PlaylistTreeNode[],
  parentId: string | null
): PlaylistTreeNode[] {
  if (parentId === null) {
    return tree.filter(
      (node) => !(node.type === 'playlist' && (node.playlist?.isSystem || node.playlist?.systemKey === 'liked'))
    )
  }
  const folder = findNode(tree, parentId, 'folder')
  return folder?.children ?? []
}

function TreeNodeView({
  node,
  depth,
  openMenu,
  dnd,
  playback
}: {
  node: PlaylistTreeNode
  depth: number
  openMenu: (event: React.MouseEvent, items: PlaylistMenuItem[]) => void
  dnd: TreeDnD
  playback: TreePlayback
}): React.JSX.Element {
  const {
    selectedPlaylistId,
    selectPlaylist,
    openPlaylistEditor,
    askRenamePlaylist,
    askRenameFolder,
    deletePlaylist,
    deleteFolder,
    movePlaylist,
    moveFolder,
    createPlaylist,
    createFolder,
    tree,
    playlists
  } = usePlaylists()

  const openPlaylist = (id: string): void => {
    playback.closeVisualizer()
    selectPlaylist(id)
  }

  const openPlaylistDetails = (id: string): void => {
    playback.closeVisualizer()
    openPlaylistEditor(id)
  }
  const [open, setOpen] = useState(true)
  const isFolder = node.type === 'folder'
  const active = !isFolder && selectedPlaylistId === node.id
  const isLovedPlaylist =
    !isFolder &&
    (node.playlist?.systemKey === 'liked' || node.name === 'Liked Songs')
  const displayName = isLovedPlaylist ? 'Loved Songs' : node.name

  const folders = useMemo(() => flattenFolders(tree), [tree])
  const isSystemPlaylist = !isFolder && !!node.playlist?.isSystem
  const dropHere =
    dnd.drop &&
    dnd.drop.nodeId === node.id &&
    dnd.drop.nodeType === node.type
      ? dnd.drop.placement
      : null
  const isTrackDropTarget = !isFolder && dnd.trackDropId === node.id
  const isDragSource =
    dnd.drag?.id === node.id && dnd.drag.type === (isFolder ? 'folder' : 'playlist')

  const onDragStart = (event: React.DragEvent): void => {
    if (isSystemPlaylist) {
      event.preventDefault()
      return
    }
    const payload: DragPayload = { type: isFolder ? 'folder' : 'playlist', id: node.id }
    dnd.setDrag(payload)
    event.dataTransfer.setData('application/x-umbrix-playlist', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (event: React.DragEvent): void => {
    // Library / playlist tracks dragged from the content area.
    if (hasTrackDrag(event.dataTransfer) && !isFolder) {
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
      dnd.setDrop(null)
      dnd.setTrackDropId(node.id)
      return
    }

    if (!dnd.drag) return
    if (dnd.drag.type === node.type && dnd.drag.id === node.id) return
    if (
      dnd.drag.type === 'playlist' &&
      playlists.some((item) => item.id === dnd.drag!.id && item.isSystem)
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    dnd.setTrackDropId(null)

    // Loved Songs stays pinned — only allow parking other items after it.
    if (isSystemPlaylist) {
      dnd.setDrop({
        nodeId: node.id,
        nodeType: node.type,
        parentId: node.parentId,
        placement: 'after'
      })
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const y = event.clientY - rect.top
    const ratio = rect.height > 0 ? y / rect.height : 0.5

    let placement: DropPlacement
    if (isFolder && ratio > 0.28 && ratio < 0.72) {
      placement = 'inside'
    } else if (ratio < 0.5) {
      placement = 'before'
    } else {
      placement = 'after'
    }

    dnd.setDrop({
      nodeId: node.id,
      nodeType: node.type,
      parentId: node.parentId,
      placement
    })
  }

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    if (hasTrackDrag(event.dataTransfer) && !isFolder) {
      const trackId = readTrackDragId(event.dataTransfer)
      dnd.setTrackDropId(null)
      if (trackId) dnd.commitTrackDrop(node.id, trackId)
      return
    }

    if (!dnd.drop || dnd.drop.nodeId !== node.id) return
    dnd.commitDrop(dnd.drop)
  }

  const playlistMenu = (): PlaylistMenuItem[] => {
    const items: PlaylistMenuItem[] = [
      {
        kind: 'item',
        id: 'play',
        label: 'Play',
        onSelect: () => playback.playPlaylist(node.id)
      },
      {
        kind: 'item',
        id: 'queue',
        label: 'Add to queue',
        onSelect: () => playback.queuePlaylist(node.id)
      },
      { kind: 'separator', id: 'sep-1' },
      {
        kind: 'item',
        id: 'open',
        label: 'Open',
        onSelect: () => openPlaylist(node.id)
      },
      {
        kind: 'item',
        id: 'edit',
        label: 'Edit details',
        onSelect: () => openPlaylistDetails(node.id)
      },
      {
        kind: 'item',
        id: 'rename',
        label: 'Rename',
        disabled: !!node.playlist?.isSystem,
        onSelect: () => {
          if (node.playlist?.isSystem) return
          askRenamePlaylist(node.id, displayName)
        }
      }
    ]

    if (!node.playlist?.isSystem) {
      items.push({ kind: 'separator', id: 'sep-move' })
      items.push({
        kind: 'item',
        id: 'move-root',
        label: 'Move to root',
        disabled: !node.playlist?.folderId,
        onSelect: () => void movePlaylist(node.id, null)
      })
      for (const folder of folders) {
        items.push({
          kind: 'item',
          id: `move-${folder.id}`,
          label: `Move to “${folder.name}”`,
          disabled: node.playlist?.folderId === folder.id,
          onSelect: () => void movePlaylist(node.id, folder.id)
        })
      }
    }

    items.push(
      { kind: 'separator', id: 'sep-create' },
      {
        kind: 'item',
        id: 'new-playlist',
        label: 'Create playlist',
        onSelect: () => void createPlaylist(undefined, node.playlist?.folderId ?? null)
      },
      {
        kind: 'item',
        id: 'new-folder',
        label: 'Create folder',
        onSelect: () => void createFolder(undefined, node.playlist?.folderId ?? null)
      }
    )

    if (!node.playlist?.isSystem) {
      items.push(
        { kind: 'separator', id: 'sep-del' },
        {
          kind: 'item',
          id: 'delete',
          label: 'Delete',
          danger: true,
          onSelect: () => void deletePlaylist(node.id)
        }
      )
    }

    return items
  }

  const folderMenu = (): PlaylistMenuItem[] => [
    {
      kind: 'item',
      id: 'new-playlist',
      label: 'Create playlist here',
      onSelect: () => void createPlaylist(undefined, node.id)
    },
    {
      kind: 'item',
      id: 'new-folder',
      label: 'Create folder here',
      onSelect: () => void createFolder(undefined, node.id)
    },
    { kind: 'separator', id: 'sep-1' },
    {
      kind: 'item',
      id: 'rename',
      label: 'Rename',
      onSelect: () => askRenameFolder(node.id, displayName)
    },
    {
      kind: 'item',
      id: 'move-root',
      label: 'Move to root',
      disabled: !node.parentId,
      onSelect: () => void moveFolder(node.id, null)
    },
    { kind: 'separator', id: 'sep-2' },
    {
      kind: 'item',
      id: 'delete',
      label: 'Delete folder',
      danger: true,
      onSelect: () => void deleteFolder(node.id)
    }
  ]

  return (
    <div className="playlist-tree__node">
      <div
        className={[
          'playlist-tree__row',
          active ? 'is-active' : '',
          isFolder ? 'is-folder' : '',
          isSystemPlaylist ? 'is-system' : '',
          isDragSource ? 'is-dragging' : '',
          dropHere === 'before' ? 'is-drop-before' : '',
          dropHere === 'after' ? 'is-drop-after' : '',
          dropHere === 'inside' || isTrackDropTarget ? 'is-drop-inside' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={!isSystemPlaylist}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            if (dnd.trackDropId === node.id) dnd.setTrackDropId(null)
          }
        }}
        onDragEnd={() => {
          dnd.setDrag(null)
          dnd.setDrop(null)
          dnd.setTrackDropId(null)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openMenu(event, isFolder ? folderMenu() : playlistMenu())
        }}
      >
        <button
          type="button"
          className={`playlist-tree__main${
            isFolder ? ' playlist-tree__main--folder' : ' playlist-tree__main--playlist'
          }`}
          onClick={() => {
            if (isFolder) setOpen((value) => !value)
            else openPlaylist(node.id)
          }}
          onDoubleClick={() => {
            if (isFolder) askRenameFolder(node.id, displayName)
            else if (!node.playlist?.isSystem) askRenamePlaylist(node.id, displayName)
          }}
          data-tip={displayName}
          title={
            isFolder
              ? displayName
              : `${displayName} · ${node.playlist?.trackCount ?? 0} tracks`
          }
        >
          {isFolder ? (
            <span className="playlist-tree__folder-tile" aria-hidden>
              <Icon name="folder" size={20} />
            </span>
          ) : (
            <PlaylistCoverThumb playlist={node.playlist} size={40} />
          )}
          <span className="playlist-tree__name">{displayName}</span>
          {!isFolder && (
            <span className="playlist-tree__count">{node.playlist?.trackCount ?? 0}</span>
          )}
        </button>

        {isFolder ? (
          <button
            type="button"
            className={`playlist-tree__twist${open ? ' is-open' : ''}`}
            aria-label={open ? 'Collapse folder' : 'Expand folder'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            ▸
          </button>
        ) : null}

        {!isFolder && !node.playlist?.isSystem ? (
          <div className="playlist-tree__actions">
            <button
              type="button"
              title="Delete playlist"
              aria-label={`Delete playlist ${node.name}`}
              onClick={() => void deletePlaylist(node.id)}
            >
              <Icon name="delete" size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {isFolder && open && node.children.length > 0 && (
        <div className="playlist-tree__children">
          {node.children.map((child) => (
            <TreeNodeView
              key={`${child.type}-${child.id}`}
              node={child}
              depth={depth + 1}
              openMenu={openMenu}
              dnd={dnd}
              playback={playback}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type PlaylistTreeProps = {
  /** Icon-only rail: hide create toolbar and empty copy. */
  compact?: boolean
}

/** Nested playlist / folder tree with drag-and-drop reorder + track drop-in. */
export function PlaylistTree({ compact = false }: PlaylistTreeProps): React.JSX.Element {
  const { tree, ready, createPlaylist, createFolder, placeTreeItem, addTracks } = usePlaylists()
  const { playTrack, addTracksToQueue, setVisualizerOpen } = usePlayback()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [trackDropId, setTrackDropId] = useState<string | null>(null)

  const openMenu = useCallback((event: React.MouseEvent, items: PlaylistMenuItem[]): void => {
    setMenu({ x: event.clientX, y: event.clientY, items })
  }, [])

  const playback = useMemo<TreePlayback>(
    () => ({
      closeVisualizer: () => setVisualizerOpen(false),
      playPlaylist: (playlistId: string) => {
        void (async () => {
          const tracks = await window.api.playlists.getTracks(playlistId)
          if (tracks[0]) playTrack(tracks[0], tracks)
        })()
      },
      queuePlaylist: (playlistId: string) => {
        void (async () => {
          const tracks = await window.api.playlists.getTracks(playlistId)
          addTracksToQueue(tracks)
        })()
      }
    }),
    [playTrack, addTracksToQueue, setVisualizerOpen]
  )

  const commitDrop = useCallback(
    (target: DropTarget): void => {
      if (!drag) return
      if (drag.type === target.nodeType && drag.id === target.nodeId) {
        setDrag(null)
        setDrop(null)
        return
      }

      let parentId: string | null
      let index: number

      if (target.placement === 'inside' && target.nodeType === 'folder') {
        parentId = target.nodeId
        index = movableChildren(tree, parentId).filter(
          (node) => !(node.type === drag.type && node.id === drag.id)
        ).length
        // Expand feel: append inside
      } else {
        parentId = target.parentId
        const siblings = movableChildren(tree, parentId).filter(
          (node) => !(node.type === drag.type && node.id === drag.id)
        )
        const targetIndex = siblings.findIndex(
          (node) => node.id === target.nodeId && node.type === target.nodeType
        )
        if (targetIndex < 0) {
          index = siblings.length
        } else {
          index = target.placement === 'before' ? targetIndex : targetIndex + 1
        }
      }

      void placeTreeItem(drag, parentId, index)
      setDrag(null)
      setDrop(null)
      setTrackDropId(null)
    },
    [drag, placeTreeItem, tree]
  )

  const commitTrackDrop = useCallback(
    (playlistId: string, trackId: string): void => {
      setTrackDropId(null)
      void addTracks(playlistId, [trackId])
    },
    [addTracks]
  )

  const dnd: TreeDnD = {
    drag,
    drop,
    trackDropId,
    setDrag,
    setDrop,
    setTrackDropId,
    commitDrop,
    commitTrackDrop
  }

  const rootMenu = (): PlaylistMenuItem[] => [
    {
      kind: 'item',
      id: 'new-playlist',
      label: 'Create playlist',
      onSelect: () => void createPlaylist()
    },
    {
      kind: 'item',
      id: 'new-folder',
      label: 'Create folder',
      onSelect: () => void createFolder()
    }
  ]

  return (
    <div
      className={`playlist-tree${compact ? ' is-compact' : ''}${drag ? ' is-dnd' : ''}`}
      onDragOver={(event) => {
        if (!drag) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const payload = drag ?? parseDrag(event)
        if (!payload) return
        // Drop on empty chrome → append at root
        const siblings = movableChildren(tree, null).filter(
          (node) => !(node.type === payload.type && node.id === payload.id)
        )
        void placeTreeItem(payload, null, siblings.length)
        setDrag(null)
        setDrop(null)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDrop(null)
      }}
      onContextMenu={(event) => {
        if ((event.target as HTMLElement).closest('.playlist-tree__row')) return
        event.preventDefault()
        openMenu(event, rootMenu())
      }}
    >
      {!compact && (
        <div className="playlist-tree__toolbar">
          <button
            type="button"
            data-tip="New playlist"
            aria-label="New playlist"
            onClick={() => void createPlaylist()}
          >
            <Icon name="create-playlist" size={14} /> Playlist
          </button>
          <button
            type="button"
            data-tip="New folder"
            aria-label="New folder"
            onClick={() => void createFolder()}
          >
            <Icon name="create-folder" size={14} /> Folder
          </button>
        </div>
      )}

      {!ready ? (
        !compact ? <p className="playlist-tree__empty">Loading playlists…</p> : null
      ) : tree.length === 0 ? (
        !compact ? (
          <p className="playlist-tree__empty">Create a playlist to start organizing.</p>
        ) : null
      ) : (
        tree.map((node) => (
          <TreeNodeView
            key={`${node.type}-${node.id}`}
            node={node}
            depth={0}
            openMenu={openMenu}
            dnd={dnd}
            playback={playback}
          />
        ))
      )}

      {menu ? (
        <PlaylistContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  )
}
