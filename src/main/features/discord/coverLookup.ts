/**
 * Resolve a public cover-art URL for Discord Rich Presence.
 * Local files are invisible to Discord — we look up a CDN image by metadata.
 */

type CacheEntry = {
  url: string | null
  expiresAt: number
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

type ItunesResult = {
  artworkUrl100?: string
  artworkUrl60?: string
}

type ItunesResponse = {
  resultCount?: number
  results?: ItunesResult[]
}

function cacheKey(artist: string, title: string, album: string): string {
  return [artist, title, album].map((part) => part.trim().toLowerCase()).join('\u0001')
}

function upgradeArtworkUrl(url: string): string {
  // Apple serves size variants in the path (100x100bb → 600x600bb).
  return url.replace(/\d+x\d+bb/, '600x600bb')
}

function isUsableMeta(value: string | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return (
    lower !== 'unknown' &&
    lower !== 'unknown artist' &&
    lower !== 'unknown album' &&
    lower !== 'various artists'
  )
}

async function itunesSearch(term: string, entity: 'song' | 'album'): Promise<string | null> {
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&media=music&entity=${entity}&limit=5`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) return null
  const data = (await response.json()) as ItunesResponse
  const hit = data.results?.find((row) => row.artworkUrl100 || row.artworkUrl60)
  const art = hit?.artworkUrl100 ?? hit?.artworkUrl60
  return art ? upgradeArtworkUrl(art) : null
}

/**
 * Find a public cover URL for the playing track.
 * Returns null when nothing usable is found (caller keeps app icon / no art).
 */
export async function lookupCoverUrl(input: {
  artist?: string
  title?: string
  album?: string
}): Promise<string | null> {
  const artist = isUsableMeta(input.artist) ? input.artist.trim() : ''
  const title = isUsableMeta(input.title) ? input.title.trim() : ''
  const album = isUsableMeta(input.album) ? input.album.trim() : ''

  if (!artist && !title && !album) return null

  const key = cacheKey(artist, title, album)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  let url: string | null = null
  try {
    if (artist && title) {
      url = await itunesSearch(`${artist} ${title}`, 'song')
    }
    if (!url && artist && album) {
      url = await itunesSearch(`${artist} ${album}`, 'album')
    }
    if (!url && album) {
      url = await itunesSearch(album, 'album')
    }
    if (!url && title) {
      url = await itunesSearch(title, 'song')
    }
  } catch {
    url = null
  }

  cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS })
  return url
}
