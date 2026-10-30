import { useEffect, useMemo, useRef, useState } from 'react'
import type { TrackMetadataPatch, TrackRow } from '@shared/types'
import { artworkUrl } from '@renderer/lib/format'
import { GrooveSelect } from '@renderer/components/ui/GrooveSelect'
import { Icon } from '@renderer/components/ui/Icon'
import { ModalHeader } from '@renderer/components/ui/ModalHeader'
import '@renderer/components/ui/ModalChrome.css'
import '../../playlists/components/PlaylistEditModal.css'
import './TrackEditModal.css'

type TrackEditModalProps = {
  open: boolean
  track: TrackRow
  onClose: () => void
  onSaved: (track: TrackRow) => void
}

const YEAR_START = 1920

/** Curated list so genre stays tidy — library genres merge in when present. */
const BASE_GENRES = [
  'Alternative',
  'Ambient',
  'Blues',
  'Classical',
  'Country',
  'Dance',
  'Electronic',
  'Folk',
  'Funk',
  'Hip-Hop',
  'Indie',
  'Jazz',
  'Latin',
  'Metal',
  'Pop',
  'Punk',
  'R&B',
  'Rap',
  'Reggae',
  'Rock',
  'Soul',
  'Soundtrack',
  'World'
] as const

function buildYearOptions(currentYear: number | null): number[] {
  const now = new Date().getFullYear()
  const end = Math.max(now + 1, currentYear ?? now)
  const years: number[] = []
  for (let y = end; y >= YEAR_START; y -= 1) years.push(y)
  if (currentYear != null && currentYear < YEAR_START) years.push(currentYear)
  return years
}

const LYRICS_EXTS = ['.lrc', '.txt', '.lyrics'] as const
/** Browser sites that actually let you grab / download synced LRC. */
const MEGALOBIZ_LRC_URL =
  'https://www.megalobiz.com/lrc/maker/download-music-lyrics-lrc-generated-files'
const RENTANADVISER_URL = 'https://www.rentanadviser.com/subtitles/subtitles4songs.aspx'

function isLyricsFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return LYRICS_EXTS.some((ext) => lower.endsWith(ext))
}

/** Edit how a track looks in Groove (library only — does not rewrite the audio file). */
export function TrackEditModal({
  open,
  track,
  onClose,
  onSaved
}: TrackEditModalProps): React.JSX.Element | null {
  const fileRef = useRef<HTMLInputElement>(null)
  const lyricsFileRef = useRef<HTMLInputElement>(null)
  /** True once the user edits / pastes / uploads lyrics — blocks async load from wiping it. */
  const lyricsTouchedRef = useRef(false)
  const [title, setTitle] = useState(track.title)
  const [artistName, setArtistName] = useState(track.artistName)
  const [albumTitle, setAlbumTitle] = useState(track.albumTitle)
  const [year, setYear] = useState(track.year != null ? String(track.year) : '')
  const [genre, setGenre] = useState(track.genre ?? '')
  const [genreOptions, setGenreOptions] = useState<string[]>([...BASE_GENRES])
  /** Current lyrics draft in the paste box (file upload fills this too). */
  const [lyricsDraft, setLyricsDraft] = useState('')
  /** Lyrics loaded when the modal opened — used to detect changes. */
  const [lyricsBaseline, setLyricsBaseline] = useState('')
  const [lyricsFileName, setLyricsFileName] = useState<string | null>(null)
  const [clearLyrics, setClearLyrics] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<{ data: ArrayBuffer; mime: string } | null>(null)
  const [clearCover, setClearCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yearSelectOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...buildYearOptions(track.year).map((y) => ({ value: String(y), label: String(y) }))
    ],
    [track.year]
  )

  const genreSelectOptions = useMemo(
    () => [{ value: '', label: 'None' }, ...genreOptions.map((name) => ({ value: name, label: name }))],
    [genreOptions]
  )

  useEffect(() => {
    if (!open) return
    setTitle(track.title)
    setArtistName(track.artistName)
    setAlbumTitle(track.albumTitle)
    setYear(track.year != null ? String(track.year) : '')
    {
      const current = track.genre?.trim() ?? ''
      const baseHit = BASE_GENRES.find((name) => name.toLowerCase() === current.toLowerCase())
      setGenre(baseHit ?? current)
    }
    setCoverPreview(null)
    setCoverFile(null)
    setClearCover(false)
    setError(null)
    setLyricsDraft('')
    setLyricsBaseline('')
    setLyricsFileName(null)
    setClearLyrics(false)
    lyricsTouchedRef.current = false

    let cancelled = false
    void (async () => {
      try {
        const [libraryGenres, override] = await Promise.all([
          window.api.library.listGenres(),
          window.api.library.getTrackLyricsOverride(track.id)
        ])
        if (cancelled) return

        const merged = new Map<string, string>()
        for (const name of BASE_GENRES) merged.set(name.toLowerCase(), name)
        for (const row of libraryGenres) {
          const clean = row.genre.trim()
          if (!clean) continue
          const key = clean.toLowerCase()
          if (!merged.has(key)) merged.set(key, clean)
        }
        const current = track.genre?.trim() ?? ''
        if (current && !merged.has(current.toLowerCase())) {
          merged.set(current.toLowerCase(), current)
        }
        setGenreOptions(
          [...merged.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        )
        setGenre(current ? (merged.get(current.toLowerCase()) ?? current) : '')
        const lyrics = override?.trim() ? override : ''
        setLyricsBaseline(lyrics)
        // Do not clobber a paste/upload that landed while this request was in flight.
        if (!lyricsTouchedRef.current) {
          setLyricsDraft(lyrics)
        }
      } catch {
        if (!cancelled) {
          setGenreOptions([...BASE_GENRES])
          setLyricsBaseline('')
          if (!lyricsTouchedRef.current) setLyricsDraft('')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, track])

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  if (!open) return null

  const displayArt = clearCover
    ? null
    : coverPreview ?? artworkUrl(track.artworkKey)

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Pick an image file (jpg, png, webp, gif).')
      return
    }
    void (async () => {
      try {
        const data = await file.arrayBuffer()
        if (coverPreview) URL.revokeObjectURL(coverPreview)
        setCoverPreview(URL.createObjectURL(file))
        setCoverFile({ data, mime: file.type || 'image/jpeg' })
        setClearCover(false)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }

  const onLyricsFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isLyricsFileName(file.name)) {
      setError('Pick a lyrics file (.lrc, .txt, or .lyrics).')
      return
    }
    void (async () => {
      try {
        const text = await file.text()
        if (!text.trim()) {
          setError('That lyrics file is empty.')
          return
        }
        lyricsTouchedRef.current = true
        setLyricsDraft(text)
        setLyricsFileName(file.name)
        setClearLyrics(false)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }

  const lyricsDirty =
    clearLyrics || lyricsDraft.trim() !== lyricsBaseline.trim() || lyricsFileName != null
  const hasLyricsContent = lyricsDraft.trim().length > 0 && !clearLyrics

  const save = async (): Promise<void> => {
    if (!title.trim()) {
      setError('Title cannot be empty.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updateTrack = window.api?.library?.updateTrackMetadata
      if (!updateTrack) {
        throw new Error(
          'Save bridge is outdated. Fully quit Umbrix Groove, run npm run dev again, then retry.'
        )
      }
      const yearValue = year.trim() ? Number(year) : null
      const patch: TrackMetadataPatch = {
        title: title.trim(),
        artistName: artistName.trim() || 'Unknown Artist',
        albumTitle: albumTitle.trim() || 'Unknown Album',
        trackNumber: track.trackNumber ?? null,
        discNumber: track.discNumber ?? null,
        year:
          yearValue != null && Number.isFinite(yearValue) ? Math.trunc(yearValue) : null,
        genre: genre.trim() || null
      }
      if (clearCover) patch.artwork = null
      else if (coverFile) {
        // Fresh buffer copy — Electron IPC is happier with a plain ArrayBuffer.
        patch.artwork = {
          data: coverFile.data.slice(0),
          mime: coverFile.mime || 'image/jpeg'
        }
      }
      if (clearLyrics || (lyricsDirty && !lyricsDraft.trim())) {
        patch.lyricsText = null
      } else if (lyricsDirty) {
        patch.lyricsText = lyricsDraft
      }

      const updated = await updateTrack(track.id, patch)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="playlist-edit track-edit" role="presentation">
      <div
        className="playlist-edit__panel gold-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-edit-title"
      >
        <ModalHeader
          title="Edit track"
          titleId="track-edit-title"
          seed={29}
          onClose={onClose}
          closeDisabled={saving}
        />

        <div className="playlist-edit__body">
          <div className="playlist-edit__cover-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp"
              className="playlist-edit__file"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="playlist-edit__cover"
              aria-label="Choose cover art"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
            >
              {displayArt ? (
                <img src={displayArt} alt="" />
              ) : (
                <Icon name="moon" size={40} />
              )}
              <div className="playlist-edit__cover-hint">
                <Icon name="edit" size={18} />
                <span>Choose photo</span>
              </div>
            </button>
            {track.artworkKey || coverFile ? (
              <button
                type="button"
                className="playlist-edit__cover-reset"
                disabled={saving || clearCover}
                onClick={() => {
                  if (coverPreview) URL.revokeObjectURL(coverPreview)
                  setCoverPreview(null)
                  setCoverFile(null)
                  setClearCover(true)
                }}
              >
                Remove cover
              </button>
            ) : (
              <p className="playlist-edit__cover-note">Shown in Groove only</p>
            )}
          </div>

          <div className="playlist-edit__fields">
            <div className="track-edit__grid">
              <label className="playlist-edit__field playlist-edit__field--span">
                <span className="track-edit__label">Title</span>
                <input
                  type="text"
                  value={title}
                  disabled={saving}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Title"
                />
              </label>
              <label className="playlist-edit__field playlist-edit__field--span">
                <span className="track-edit__label">Artist</span>
                <input
                  type="text"
                  value={artistName}
                  disabled={saving}
                  onChange={(event) => setArtistName(event.target.value)}
                  placeholder="Artist"
                />
              </label>
              <label className="playlist-edit__field playlist-edit__field--span">
                <span className="track-edit__label">Album</span>
                <input
                  type="text"
                  value={albumTitle}
                  disabled={saving}
                  onChange={(event) => setAlbumTitle(event.target.value)}
                  placeholder="Album"
                />
              </label>
              <div className="playlist-edit__field">
                <span className="track-edit__label">Year</span>
                <GrooveSelect
                  aria-label="Year"
                  value={year}
                  options={yearSelectOptions}
                  disabled={saving}
                  onChange={setYear}
                />
              </div>
              <div className="playlist-edit__field">
                <span className="track-edit__label">Genre</span>
                <GrooveSelect
                  aria-label="Genre"
                  value={genre}
                  options={genreSelectOptions}
                  disabled={saving}
                  onChange={setGenre}
                />
              </div>
              <div className="playlist-edit__field playlist-edit__field--span playlist-edit__field--area track-edit__lyrics">
                <span className="track-edit__label">Lyrics</span>
                <textarea
                  className="track-edit__lyrics-paste"
                  value={clearLyrics ? '' : lyricsDraft}
                  disabled={saving}
                  rows={8}
                  spellCheck={false}
                  placeholder="Paste synced or plain lyrics here (LRC from LRCLIB works great)…"
                  aria-label="Paste lyrics"
                  onChange={(event) => {
                    lyricsTouchedRef.current = true
                    setLyricsDraft(event.target.value)
                    setLyricsFileName(null)
                    setClearLyrics(false)
                  }}
                />
                <input
                  ref={lyricsFileRef}
                  type="file"
                  accept=".lrc,.txt,.lyrics,text/plain"
                  className="playlist-edit__file"
                  onChange={onLyricsFileChange}
                />
                <div className="track-edit__lyrics-row">
                  <button
                    type="button"
                    className="ug-modal__btn ug-modal__btn--ghost track-edit__lyrics-pick"
                    disabled={saving}
                    onClick={() => lyricsFileRef.current?.click()}
                  >
                    {hasLyricsContent || lyricsBaseline ? 'Replace from file' : 'Upload lyrics file'}
                  </button>
                  {(hasLyricsContent || lyricsBaseline) && (
                    <button
                      type="button"
                      className="playlist-edit__cover-reset"
                      disabled={saving || clearLyrics}
                      onClick={() => {
                        lyricsTouchedRef.current = true
                        setLyricsDraft('')
                        setLyricsFileName(null)
                        setClearLyrics(true)
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="track-edit__lyrics-status">
                  {clearLyrics
                    ? 'Custom lyrics will be removed on save.'
                    : lyricsFileName
                      ? `Loaded from ${lyricsFileName}`
                      : lyricsDirty && hasLyricsContent
                        ? 'Pasted lyrics ready to save.'
                        : lyricsBaseline
                          ? 'Custom lyrics are set for this track. Edit or paste to replace.'
                          : 'Paste lyrics below, or upload a .lrc / .txt / .lyrics file.'}
                </p>
                <div className="track-edit__lyrics-links">
                  <a
                    className="track-edit__lyrics-link"
                    href={MEGALOBIZ_LRC_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download LRC on Megalobiz
                  </a>
                  <a
                    className="track-edit__lyrics-link"
                    href={RENTANADVISER_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Search and download on RentAnAdviser
                  </a>
                </div>
              </div>
            </div>
            <p className="track-edit__hint">
              Changes how this track looks in Umbrix Groove. Your audio file stays untouched.
            </p>
          </div>
        </div>

        {error ? <p className="track-edit__error">{error}</p> : null}

        <footer className="playlist-edit__foot">
          <button
            type="button"
            className="ug-modal__btn ug-modal__btn--solid"
            disabled={saving || !title.trim()}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}
