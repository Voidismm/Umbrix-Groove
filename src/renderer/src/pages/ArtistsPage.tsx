import { TrackTable, useLibrary } from '@renderer/features/library'
import { LibraryBrowseShell } from './LibraryBrowseShell'

/** Artist list and artist detail — same library banner chrome as All Songs. */
export function ArtistsPage(): React.JSX.Element {
  const { artists, tracks, trackTotal, selectedArtistId, selectArtist, searchQuery, albums } =
    useLibrary()
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) ?? null

  if (selectedArtist) {
    const artistArt = albums
      .filter((album) => album.artistName === selectedArtist.name)
      .slice(0, 4)

    return (
      <LibraryBrowseShell
        title={selectedArtist.name}
        metaPrimary={`${selectedArtist.trackCount} songs · ${selectedArtist.albumCount} albums`}
        icon="artist"
        artItems={artistArt.length > 0 ? artistArt : tracks}
      >
        <div className="library-browse__toolbar">
          <button type="button" className="linkish" onClick={() => selectArtist(null)}>
            ← All artists
          </button>
        </div>
        <TrackTable tracks={tracks} total={trackTotal} />
      </LibraryBrowseShell>
    )
  }

  return (
    <LibraryBrowseShell
      title="All Artists"
      description={searchQuery ? `Results for “${searchQuery}”` : null}
      metaPrimary={`${artists.length} artist${artists.length === 1 ? '' : 's'}`}
      icon="artist"
      artItems={albums}
    >
      <div className="list-panel gold-frame library-browse__list">
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
    </LibraryBrowseShell>
  )
}
