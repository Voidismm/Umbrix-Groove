import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlaylistSummary, TrackRow } from '@shared/types'
import { artworkUrl } from '@renderer/lib/format'
import {
  DEFAULT_PLAYLIST_ACCENT,
  extractAccentFromImageUrl,
  normalizeHexColor,
  playlistBannerStyle
} from '@renderer/lib/playlistAccent'
import { Icon } from '@renderer/components/ui/Icon'
import './PlaylistEditModal.css'

type PlaylistEditModalProps = {
  open: boolean
  playlist: PlaylistSummary
  tracks: TrackRow[]
  /** Live banner accent currently shown on the page (saved or derived). */
  previewAccent?: string
  onClose: () => void
  onSave: (
    name: string,
    description: string | null,
    accentColor: string | null
  ) => Promise<void>
  onCoverFile: (data: ArrayBuffer, mime: string) => Promise<void>
  onClearCover: () => Promise<void>
}

function coverKeys(tracks: TrackRow[]): string[] {
  const keys: string[] = []
  for (const track of tracks) {
    if (track.artworkKey && !keys.includes(track.artworkKey)) keys.push(track.artworkKey)
    if (keys.length >= 4) break
  }
  return keys
}

/** Offline edit details — name, description, cover, banner color. */
export function PlaylistEditModal({
  open,
  playlist,
  tracks,
  previewAccent,
  onClose,
  onSave,
  onCoverFile,
  onClearCover
}: PlaylistEditModalProps): React.JSX.Element | null {
  const [name, setName] = useState(playlist.name)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [accentMode, setAccentMode] = useState<'auto' | 'custom'>(
    playlist.accentColor ? 'custom' : 'auto'
  )
  const [accentDraft, setAccentDraft] = useState(
    normalizeHexColor(playlist.accentColor) ?? DEFAULT_PLAYLIST_ACCENT
  )
  const [autoSample, setAutoSample] = useState(DEFAULT_PLAYLIST_ACCENT)
  const [saving, setSaving] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const art = coverKeys(tracks)
  const customCover = playlist.coverKey

  const coverSampleUrl = useMemo(() => {
    if (customCover) return artworkUrl(customCover)
    if (art[0]) return artworkUrl(art[0])
    return null
  }, [customCover, art])

  useEffect(() => {
    if (!open) return
    setName(playlist.name)
    setDescription(playlist.description ?? '')
    setAccentMode(playlist.accentColor ? 'custom' : 'auto')
    setAccentDraft(
      normalizeHexColor(playlist.accentColor) ??
        normalizeHexColor(previewAccent) ??
        DEFAULT_PLAYLIST_ACCENT
    )
    setCoverError(null)
  }, [open, playlist.id, playlist.name, playlist.description, playlist.accentColor, previewAccent])

  useEffect(() => {
    if (!open) return
    if (!coverSampleUrl) {
      setAutoSample(DEFAULT_PLAYLIST_ACCENT)
      return
    }
    let cancelled = false
    void extractAccentFromImageUrl(coverSampleUrl).then((hex) => {
      if (!cancelled) setAutoSample(hex ?? DEFAULT_PLAYLIST_ACCENT)
    })
    return () => {
      cancelled = true
    }
  }, [open, coverSampleUrl, playlist.coverKey])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const displayName =
    playlist.systemKey === 'liked' || playlist.name === 'Liked Songs' ? 'Loved Songs' : name

  const liveAccent =
    accentMode === 'custom'
      ? (normalizeHexColor(accentDraft) ?? DEFAULT_PLAYLIST_ACCENT)
      : autoSample
  const swatchStyle = playlistBannerStyle(liveAccent)

  const pickCover = (): void => {
    fileRef.current?.click()
  }

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCoverError('Pick an image file (jpg, png, webp, gif).')
      return
    }
    void (async () => {
      setCoverBusy(true)
      setCoverError(null)
      try {
        const data = await file.arrayBuffer()
        await onCoverFile(data, file.type || 'image/jpeg')
      } catch (err) {
        setCoverError(err instanceof Error ? err.message : String(err))
      } finally {
        setCoverBusy(false)
      }
    })()
  }

  return (
    <div className="playlist-edit" role="presentation" onClick={onClose}>
      <div
        className="playlist-edit__panel gold-frame"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="playlist-edit__head">
          <h2 id="playlist-edit-title">Edit details</h2>
          <button type="button" className="playlist-edit__close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>

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
              aria-label="Choose custom cover"
              disabled={coverBusy}
              onClick={pickCover}
            >
              {customCover ? (
                <img src={artworkUrl(customCover) ?? undefined} alt="" />
              ) : art.length >= 4 ? (
                <div className="playlist-edit__collage">
                  {art.map((key) => (
                    <img key={key} src={artworkUrl(key) ?? undefined} alt="" />
                  ))}
                </div>
              ) : art[0] ? (
                <img src={artworkUrl(art[0]) ?? undefined} alt="" />
              ) : (
                <Icon name={playlist.isSystem ? 'heart-filled' : 'create-playlist'} size={40} />
              )}
              <div className="playlist-edit__cover-hint">
                <Icon name="edit" size={18} />
                <span>{coverBusy ? 'Updating…' : 'Choose photo'}</span>
              </div>
            </button>
            {customCover ? (
              <button
                type="button"
                className="playlist-edit__cover-reset"
                disabled={coverBusy}
                onClick={() => {
                  void (async () => {
                    setCoverBusy(true)
                    setCoverError(null)
                    try {
                      await onClearCover()
                    } catch (err) {
                      setCoverError(err instanceof Error ? err.message : String(err))
                    } finally {
                      setCoverBusy(false)
                    }
                  })()
                }}
              >
                Use covers from tracks
              </button>
            ) : (
              <p className="playlist-edit__cover-note">Auto collage from the first tracks with art</p>
            )}
            {coverError ? <p className="playlist-edit__cover-error">{coverError}</p> : null}
          </div>

          <div className="playlist-edit__fields">
            <label className="playlist-edit__field">
              <span className="playlist-edit__visually-hidden">Name</span>
              <input
                type="text"
                value={displayName}
                disabled={playlist.isSystem || saving}
                onChange={(event) => setName(event.target.value)}
                placeholder="Playlist name"
              />
            </label>
            <label className="playlist-edit__field playlist-edit__field--area">
              <span className="playlist-edit__visually-hidden">Description</span>
              <textarea
                value={description}
                disabled={saving}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add an optional description"
                rows={4}
              />
            </label>

            <div className="playlist-edit__accent">
              <div className="playlist-edit__accent-head">
                <span>Banner color</span>
                <div className="playlist-edit__accent-swatch" style={swatchStyle} aria-hidden />
              </div>
              <div className="playlist-edit__accent-row">
                <label className="playlist-edit__accent-pick">
                  <input
                    type="color"
                    value={normalizeHexColor(accentDraft) ?? DEFAULT_PLAYLIST_ACCENT}
                    disabled={saving}
                    onChange={(event) => {
                      setAccentMode('custom')
                      setAccentDraft(event.target.value)
                    }}
                  />
                  <span>Custom color</span>
                </label>
                <input
                  type="text"
                  className="playlist-edit__accent-hex"
                  value={accentDraft}
                  disabled={saving || accentMode === 'auto'}
                  spellCheck={false}
                  onChange={(event) => {
                    setAccentMode('custom')
                    setAccentDraft(event.target.value)
                  }}
                  aria-label="Banner color hex"
                />
              </div>
              <button
                type="button"
                className={`playlist-edit__accent-auto${accentMode === 'auto' ? ' is-active' : ''}`}
                disabled={saving}
                onClick={() => {
                  setAccentMode('auto')
                  setAccentDraft(autoSample)
                }}
              >
                Auto from cover
              </button>
            </div>
          </div>
        </div>

        <footer className="playlist-edit__foot">
          <button
            type="button"
            className="playlist-edit__save"
            disabled={
              saving ||
              (!playlist.isSystem && !name.trim()) ||
              (accentMode === 'custom' && !normalizeHexColor(accentDraft))
            }
            onClick={() => {
              void (async () => {
                setSaving(true)
                try {
                  const accent =
                    accentMode === 'custom' ? normalizeHexColor(accentDraft) : null
                  await onSave(
                    playlist.isSystem ? playlist.name : name.trim(),
                    description.trim() || null,
                    accent
                  )
                  onClose()
                } finally {
                  setSaving(false)
                }
              })()
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}
