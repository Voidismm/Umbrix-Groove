import { CoverArt, TrackTable, useLibrary } from '@renderer/features/library'

/** Album grid and album detail track list. */
export function AlbumsPage(): React.JSX.Element {
  const {
    albums,
    tracks,
    trackTotal,
    selectedAlbumId,
    selectAlbum
  } = useLibrary()

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null

  if (selectedAlbum) {
    return (
      <section className="view">
        <header className="view__head view__head--row">
          <div>
            <button type="button" className="linkish" onClick={() => selectAlbum(null)}>
              ← All albums
            </button>
            <h2>{selectedAlbum.title}</h2>
            <p>
              {selectedAlbum.artistName}
              {selectedAlbum.year ? ` · ${selectedAlbum.year}` : ''} · {selectedAlbum.trackCount}{' '}
              tracks
            </p>
          </div>
          <div className="view__art gold-frame">
            <CoverArt title={selectedAlbum.title} artworkKey={selectedAlbum.artworkKey} />
          </div>
        </header>
        <TrackTable tracks={tracks} total={trackTotal} showSort={false} />
      </section>
    )
  }

  return (
    <section className="view">
      <header className="view__head">
        <h2>Albums</h2>
        <p>{albums.length} albums</p>
      </header>
      <div className="grid-cards">
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
    </section>
  )
}
