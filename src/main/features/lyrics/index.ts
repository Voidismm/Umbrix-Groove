/**
 * Lyrics feature (main process)
 * Sidecar LRC/TXT + embedded tags from music-metadata.
 */
export { getLyricsForTrack, type LyricsLookupOptions } from './service'
export { cleanLyricText, coalesceWordSyncLines, parseLrc } from './parseLrc'
