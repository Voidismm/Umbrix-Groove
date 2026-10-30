export type NavId =
  | 'home'
  | 'songs'
  | 'albums'
  | 'artists'
  | 'genres'
  | 'folders'
  | 'playlists'
  | 'lyrics'
  | 'browse'
  | 'recent-added'
  | 'daily-mix'

export type TrackSort =
  | 'title'
  | 'artist'
  | 'album'
  | 'duration'
  | 'date_added'
  | 'track_number'

export interface LibraryFolder {
  id: string
  path: string
  addedAt: string
  lastScannedAt: string | null
  trackCount: number
}

export interface TrackRow {
  id: string
  path: string
  title: string
  artistName: string
  albumTitle: string
  albumId: string | null
  artistId: string | null
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  genre: string | null
  durationMs: number | null
  bitrate: number | null
  codec: string | null
  artworkKey: string | null
  missing: boolean
  dateAdded: string
  incompleteMetadata: boolean
  playCount?: number
  lastPlayedAt?: string | null
}

/** Track with play stats for home rails. */
export interface PlayedTrackRow extends TrackRow {
  playCount: number
  lastPlayedAt: string | null
  /** Plays inside the on-repeat window (when relevant). */
  recentPlayCount?: number
}

/** App-generated local mix (decade + genre), refreshed about every 24h. */
export interface LocalMix {
  id: string
  title: string
  subtitle: string
  decadeLabel: string
  genreKey: string
  accentColor: string
  generatedAt: string
  trackCount: number
  coverArtKeys: string[]
  tracks: TrackRow[]
}

export interface HomePersonalization {
  jumpBackIn: PlayedTrackRow[]
  mostPlayed: PlayedTrackRow[]
  onRepeat: PlayedTrackRow[]
  dailyMixes: LocalMix[]
  mixesGeneratedAt: string | null
}

export interface AlbumRow {
  id: string
  title: string
  artistName: string
  year: number | null
  trackCount: number
  artworkKey: string | null
}

export interface ArtistRow {
  id: string
  name: string
  trackCount: number
  albumCount: number
}

export interface LibrarySummary {
  trackCount: number
  albumCount: number
  artistCount: number
  folderCount: number
  missingCount: number
  incompleteCount: number
}

export interface TrackQuery {
  query?: string
  sort?: TrackSort
  ascending?: boolean
  limit?: number
  offset?: number
  albumId?: string
  artistId?: string
  genre?: string
  missingOnly?: boolean
}

export interface TrackQueryResult {
  tracks: TrackRow[]
  total: number
}

export interface ScanProgress {
  phase: 'walking' | 'parsing' | 'finalizing' | 'done' | 'error'
  folderPath: string
  currentFile?: string
  processed: number
  total: number
  added: number
  updated: number
  removed: number
  errors: number
  message?: string
}

export interface ScanResult {
  folderId: string
  folderPath: string
  added: number
  updated: number
  removed: number
  unchanged: number
  errors: string[]
  duplicates: Array<{ path: string; otherPath: string }>
}

export interface AddFolderResult {
  folder: LibraryFolder | null
  cancelled: boolean
  alreadyExists?: boolean
}

/** Library-only metadata edit — does not rewrite audio file tags. */
export interface TrackMetadataPatch {
  title: string
  artistName: string
  albumTitle: string
  trackNumber: number | null
  discNumber: number | null
  year: number | null
  genre: string | null
  /**
   * undefined = leave cover; null = clear cover;
   * { data, mime } = replace cover in the app artwork cache.
   */
  artwork?: { data: ArrayBuffer; mime: string } | null
  /**
   * undefined = leave lyrics override; null or empty = clear override;
   * string = set library lyrics override (shown in-app only).
   */
  lyricsText?: string | null
}
