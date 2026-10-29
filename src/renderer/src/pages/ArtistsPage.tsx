import { TrackTable, useLibrary } from '@renderer/features/library'

/** Artist list and artist detail track list. */
export function ArtistsPage(): React.JSX.Element {
  const { artists, tracks, trackTotal, selectedArtistId, selectArtist } = useLibrary()
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) ?? null

  if (selectedArtist) {
    return (
      <section className="view">
        <header className="view__head">
          <button type="button" className="linkish" onClick={() => selectArtist(null)}>
            ← All artists
          </button>
          <h2>{selectedArtist.name}</h2>
          <p>
            {selectedArtist.trackCount} songs · {selectedArtist.albumCount} albums
          </p>
        </header>
        <TrackTable tracks={tracks} total={trackTotal} />
      </section>
    )
  }

  return (
    <section className="view">
      <header className="view__head">
        <h2>Artists</h2>
        <p>{artists.length} artists</p>
      </header>
      <div className="list-panel gold-frame">
        {artists.map((artist) => (
          <button
            key={artist.id}
            type="button"
            className="list-panel__row"
            onClick={() => selectArtist(artist.id)}
          >
            <strong>{artist.name}</strong>
            <span>
              {artist.trackCount} songs · {artist.albumCount} albums
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
