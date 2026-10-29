import { closeSync, existsSync, openSync, readSync, statSync } from 'fs'
import { extname } from 'path'
import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { artworkMimeFromKey, resolveArtworkPath } from './artwork'
import { getTrackMediaById } from './queries'

function audioMimeFromPath(filePath: string, codec: string | null): string {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg'
    case '.flac':
      return 'audio/flac'
    case '.wav':
    case '.wave':
      return 'audio/wav'
    case '.m4a':
    case '.aac':
    case '.alac':
      return 'audio/mp4'
    case '.ogg':
    case '.oga':
      return 'audio/ogg'
    case '.opus':
      return 'audio/opus'
    case '.aiff':
    case '.aif':
      return 'audio/aiff'
    default:
      if (codec?.toLowerCase().includes('mp3')) return 'audio/mpeg'
      if (codec?.toLowerCase().includes('flac')) return 'audio/flac'
      return 'application/octet-stream'
  }
}

/** Parse a single HTTP Range request into inclusive byte offsets. */
function parseByteRange(
  rangeHeader: string,
  size: number
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) return null

  const startToken = match[1]
  const endToken = match[2]
  if (startToken === '' && endToken === '') return null

  let start: number
  let end: number

  if (startToken === '') {
    const suffix = Number(endToken)
    if (!Number.isFinite(suffix) || suffix <= 0) return 'unsatisfiable'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startToken)
    end = endToken === '' ? size - 1 : Number(endToken)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'unsatisfiable'
  }

  if (size === 0) return 'unsatisfiable'
  if (start < 0 || start >= size || end < start) return 'unsatisfiable'
  end = Math.min(end, size - 1)
  return { start, end }
}

function readFileBytes(filePath: string, start: number, end: number): Uint8Array {
  const length = end - start + 1
  const buffer = Buffer.allocUnsafe(length)
  const fd = openSync(filePath, 'r')
  try {
    readSync(fd, buffer, 0, length, start)
  } finally {
    closeSync(fd)
  }
  return buffer
}

/**
 * Serve local audio with real byte-range support.
 * Chromium media always sends Range (often `bytes=0-` first) and needs 206 + Content-Range.
 * Buffer bodies avoid Electron stream/Response quirks that break seeking.
 */
function mediaFileResponse(filePath: string, mime: string, request: Request): Response {
  const { size } = statSync(filePath)
  const headers = new Headers({
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
  })

  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(size))
    return new Response(null, { status: 200, headers })
  }

  const rangeHeader = request.headers.get('Range')
  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, size)
    if (parsed === 'unsatisfiable' || parsed === null) {
      headers.set('Content-Range', `bytes */${size}`)
      return new Response(null, { status: 416, headers })
    }

    const { start, end } = parsed
    const chunk = readFileBytes(filePath, start, end)
    headers.set('Content-Length', String(chunk.byteLength))
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    return new Response(chunk as unknown as BodyInit, { status: 206, headers })
  }

  const body = readFileBytes(filePath, 0, Math.max(0, size - 1))
  headers.set('Content-Length', String(body.byteLength))
  return new Response(body as unknown as BodyInit, { status: 200, headers })
}

/**
 * Custom protocol:
 * - umbrix://artwork/<key>  → cached cover art
 * - umbrix://media/<trackId> → local audio file for playback
 */
export function registerArtworkProtocol(): void {
  protocol.handle('umbrix', async (request) => {
    try {
      const url = new URL(request.url)

      if (url.hostname === 'artwork') {
        const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        const fullPath = resolveArtworkPath(key)
        if (!fullPath) {
          return new Response('Not found', { status: 404 })
        }
        const response = await net.fetch(pathToFileURL(fullPath).toString())
        const headers = new Headers(response.headers)
        headers.set('Content-Type', artworkMimeFromKey(key))
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        return new Response(response.body, { status: 200, headers })
      }

      if (url.hostname === 'media') {
        const trackId = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        if (!trackId) {
          return new Response('Not found', { status: 404 })
        }
        const media = getTrackMediaById(trackId)
        if (!media || !existsSync(media.path)) {
          return new Response('Not found', { status: 404 })
        }
        return mediaFileResponse(
          media.path,
          audioMimeFromPath(media.path, media.codec),
          request
        )
      }

      return new Response('Not found', { status: 404 })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
