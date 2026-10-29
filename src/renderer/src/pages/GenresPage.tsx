import { TrackTable, useLibrary } from '@renderer/features/library'

/** Genre chips and filtered track list. */
export function GenresPage(): React.JSX.Element {
  const { genres, tracks, trackTotal, selectedGenre, selectGenre } = useLibrary()

  return (
    <section className="view">
      <header className="view__head">
        <h2>Genres</h2>
        <p>{selectedGenre ? `Showing ${selectedGenre}` : `${genres.length} genres`}</p>
      </header>
      {selectedGenre ? (
        <>
          <button type="button" className="linkish" onClick={() => selectGenre(null)}>
            ← All genres
          </button>
          <TrackTable tracks={tracks} total={trackTotal} />
        </>
      ) : (
        <div className="chip-cloud">
          {genres.map((item) => (
            <button
              key={item.genre}
              type="button"
              className="chip"
              onClick={() => selectGenre(item.genre)}
            >
              {item.genre}
              <span>{item.trackCount}</span>
            </button>
          ))}
          {genres.length === 0 && <p className="muted">No genre tags found in your library yet.</p>}
        </div>
      )}
    </section>
  )
}
