import { TrackTable, useLibrary } from '@renderer/features/library'

/** Search-oriented browse view. */
export function BrowsePage(): React.JSX.Element {
  const { tracks, trackTotal } = useLibrary()

  return (
    <section className="view">
      <header className="view__head">
        <h2>Browse</h2>
        <p>Search from the top bar, or jump into songs, albums, and artists.</p>
      </header>
      <TrackTable tracks={tracks} total={trackTotal} />
    </section>
  )
}
