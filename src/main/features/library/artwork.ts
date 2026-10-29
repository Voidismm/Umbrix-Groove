import { createHash } from 'crypto'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { getUserDataPaths } from '../../db/database'

function extensionForMime(mime?: string): string {
  switch ((mime ?? '').toLowerCase()) {
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'image/gif':
      return '.gif'
    case 'image/bmp':
    case 'image/x-ms-bmp':
      return '.bmp'
    case 'image/jpeg':
    case 'image/jpg':
    default:
      return '.jpg'
  }
}

export function saveArtwork(data: Buffer, mime?: string): string {
  const { artworkDir } = getUserDataPaths()
  mkdirSync(artworkDir, { recursive: true })

  const hash = createHash('sha1').update(data).digest('hex')
  const ext = extensionForMime(mime)
  const fileName = `${hash}${ext}`
  const fullPath = join(artworkDir, fileName)

  if (!existsSync(fullPath)) {
    writeFileSync(fullPath, data)
  }

  return fileName
}

export function resolveArtworkPath(fileName: string | null | undefined): string | null {
  if (!fileName) return null
  const safe = fileName.replace(/[\\/]/g, '')
  if (!safe || safe !== fileName) return null
  const full = join(getUserDataPaths().artworkDir, safe)
  return existsSync(full) ? full : null
}

export function artworkKeyFromPath(fileName: string | null | undefined): string | null {
  if (!fileName) return null
  return fileName
}

export function artworkMimeFromKey(key: string): string {
  switch (extname(key).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.bmp':
      return 'image/bmp'
    default:
      return 'image/jpeg'
  }
}
