/** Playlist / folder types shared across main, preload, and renderer. */

export interface PlaylistFolder {
  id: string
  name: string
  parentId: string | null
  position: number
  createdAt: string
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string | null
  folderId: string | null
  position: number
  isSystem: boolean
  systemKey: string | null
  /** Custom uploaded cover (artwork cache key). */
  coverKey: string | null
  /**
   * Auto collage: artwork keys from the first songs in playlist order
   * that have cover art (up to 4, unique).
   */
  coverArtKeys: string[]
  /**
   * Banner accent (#RRGGBB). Null = derive from cover art.
   */
  accentColor: string | null
  trackCount: number
  totalDurationMs: number
  createdAt: string
  updatedAt: string
}

export interface PlaylistTreeNode {
  type: 'folder' | 'playlist'
  id: string
  name: string
  parentId: string | null
  position: number
  /** Present when type === 'playlist' */
  playlist?: PlaylistSummary
  children: PlaylistTreeNode[]
}

/** Playlist or folder reference for tree drag-reorder. */
export type PlaylistTreeItemRef = {
  type: 'folder' | 'playlist'
  id: string
}

export interface PlaylistDetail extends PlaylistSummary {
  trackIds: string[]
}
