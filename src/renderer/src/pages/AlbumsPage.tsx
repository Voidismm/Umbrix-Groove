import { CoverArt, TrackTable, useLibrary } from '@renderer/features/library'
import { LibraryBrowseShell } from './LibraryBrowseShell'

/** Album grid and album detail — same library banner chrome as All Songs. */
export function AlbumsPage(): React.JSX.Element {
  const { albums, tracks, trackTotal, selectedAlbumId, selectAlbum, searchQuery } = useLibrary()

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null

  if (selectedAlbum) {
    return (
      <LibraryBrowseShell
        title={selectedAlbum.title}
        description={`${selectedAlbum.artistName}${selectedAlbum.year ? ` · ${selectedAlbum.year}` : ''}`}
        metaPrimary={`${selectedAlbum.trackCount} track${selectedAlbum.trackCount === 1 ? '' : 's'}`}
        icon="album"
        artItems={[selectedAlbum]}
      >
        <div className="library-browse__toolbar">
          <button type="button" className="linkish" onClick={() => selectAlbum(null)}>
            ← All albums
          </button>
        </div>
        <TrackTable tracks={tracks} total={trackTotal} showSort={false} />
      </LibraryBrowseShell>
    )
  }

  return (
    <LibraryBrowseShell
      title="All Albums"
      description={searchQuery ? `Results for “${searchQuery}”` : null}
      metaPrimary={`${albums.length} album${albums.length === 1 ? '' : 's'}`}
      icon="album"
      artItems={albums}
    >
      <div className="grid-cards library-browse__grid">
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            className="card card--button"
            onClick={() => selectAlbum(album.id)}
          >
            <div className="card__frame gold-frame">
              <CoverArt title={album.title} artworkKey={album.artworkKey} />
            </div>
            <h3>{album.title}</h3>
            <p>
              {album.artistName}
              {album.year ? ` · ${album.year}` : ''}
            </p>
          </button>
        ))}
      </div>
    </LibraryBrowseShell>
  )
}
