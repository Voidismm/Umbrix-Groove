import { existsSync, readFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { parseFile } from 'music-metadata'
import type { LyricsLine, LyricsPayload, LyricsSource } from '../../../shared/types'
import { getTrackMediaById } from '../library/queries'
import {
  cleanLyricText,
  coalesceWordSyncLines,
  isLyricsMetaLine,
  looksLikeTimedLyrics,
  parseLrc,
  plainTextToLines
} from './parseLrc'

const SIDECAR_EXTS = ['.lrc', '.txt', '.lyrics'] as const

export type LyricsLookupOptions = {
  /** When true (default), try sidecar files before embedded tags. */
  preferSidecar?: boolean
}

function emptyPayload(trackId: string): LyricsPayload {
  return {
    trackId,
    source: 'none',
    synced: false,
    lines: [],
    rawText: null
  }
}

function sidecarPaths(audioPath: string): string[] {
  const dir = dirname(audioPath)
  const base = basename(audioPath, extname(audioPath))
  return SIDECAR_EXTS.map((ext) => join(dir, `${base}${ext}`))
}

function readSidecar(audioPath: string): { source: LyricsSource; text: string } | null {
  for (const path of sidecarPaths(audioPath)) {
    if (!existsSync(path)) continue
    try {
      const text = readFileSync(path, 'utf8')
      if (!text.trim()) continue
      const ext = extname(path).toLowerCase()
      return { source: ext === '.lrc' ? 'lrc' : 'txt', text }
    } catch {
      // try next sidecar
    }
  }
  return null
}

async function readEmbedded(audioPath: string): Promise<{
  source: LyricsSource
  lines: LyricsLine[]
  rawText: string | null
} | null> {
  try {
    const metadata = await parseFile(audioPath, { duration: false, skipCovers: true })
    const tags = metadata.common.lyrics
    if (!tags?.length) return null

    for (const tag of tags) {
      if (tag.syncText?.length) {
        const cleaned = tag.syncText
          .map((item) => {
            const raw = (item.text ?? '').trim()
            if (isLyricsMetaLine(raw)) {
              return { timeMs: null as number | null, text: '' }
            }
            return {
              timeMs: typeof item.timestamp === 'number' ? item.timestamp : null,
              text: cleanLyricText(raw)
            }
          })
          .filter((item) => item.text.length > 0)
        const lines = coalesceWordSyncLines(cleaned)
        if (lines.length) {
          const synced = lines.some((line) => line.timeMs != null)
          return {
            source: synced ? 'embedded-sync' : 'embedded',
            lines,
            rawText: lines.map((line) => line.text).join('\n')
          }
        }
      }
      if (tag.text?.trim()) {
        const text = tag.text.trim()
        // Some embeds store LRC / enhanced-LRC in the unsynced field
        if (looksLikeTimedLyrics(text)) {
          const lines = parseLrc(text)
          if (lines.some((line) => line.timeMs != null)) {
            return { source: 'embedded-sync', lines, rawText: text }
          }
        }
        return {
          source: 'embedded',
          lines: plainTextToLines(text),
          rawText: text
        }
      }
    }
  } catch {
    return null
  }
  return null
}

function payloadFromSidecar(trackId: string, sidecar: { source: LyricsSource; text: string }): LyricsPayload {
  if (sidecar.source === 'lrc' || looksLikeTimedLyrics(sidecar.text)) {
    const lines = parseLrc(sidecar.text)
    const synced = lines.some((line) => line.timeMs != null)
    return {
      trackId,
      source: synced ? 'lrc' : sidecar.source,
      synced,
      lines,
      rawText: sidecar.text
    }
  }
  return {
    trackId,
    source: 'txt',
    synced: false,
    lines: plainTextToLines(sidecar.text),
    rawText: sidecar.text
  }
}

function payloadFromEmbedded(
  trackId: string,
  embedded: { source: LyricsSource; lines: LyricsLine[]; rawText: string | null }
): LyricsPayload {
  return {
    trackId,
    source: embedded.source,
    synced: embedded.lines.some((line) => line.timeMs != null),
    lines: embedded.lines,
    rawText: embedded.rawText
  }
}

/** Resolve lyrics for a library track: sidecar files and/or embedded tags. */
export async function getLyricsForTrack(
  trackId: string,
  options?: LyricsLookupOptions
): Promise<LyricsPayload> {
  const media = getTrackMediaById(trackId)
  if (!media) return emptyPayload(trackId)

  const preferSidecar = options?.preferSidecar !== false

  if (preferSidecar) {
    const sidecar = readSidecar(media.path)
    if (sidecar) return payloadFromSidecar(trackId, sidecar)

    const embedded = await readEmbedded(media.path)
    if (embedded) return payloadFromEmbedded(trackId, embedded)
    return emptyPayload(trackId)
  }

  const embedded = await readEmbedded(media.path)
  if (embedded) return payloadFromEmbedded(trackId, embedded)

  const sidecar = readSidecar(media.path)
  if (sidecar) return payloadFromSidecar(trackId, sidecar)

  return emptyPayload(trackId)
}
