/** Local lyrics payload shared across main / preload / renderer. */

export type LyricsSource = 'lrc' | 'txt' | 'embedded-sync' | 'embedded' | 'none'

export interface LyricsLine {
  /** Milliseconds from start when synced; null for plain text lines. */
  timeMs: number | null
  text: string
}

export interface LyricsPayload {
  trackId: string
  source: LyricsSource
  synced: boolean
  lines: LyricsLine[]
  /** Full plain text when useful for copy / fallback display. */
  rawText: string | null
}

export interface RelatedTracksResult {
  trackId: string
  sameArtist: import('./library').TrackRow[]
  sameAlbum: import('./library').TrackRow[]
  sameGenre: import('./library').TrackRow[]
}

export interface ArtistSpotlight {
  id: string | null
  name: string
  trackCount: number
  albumCount: number
  albums: import('./library').AlbumRow[]
  topTracks: import('./library').TrackRow[]
}
