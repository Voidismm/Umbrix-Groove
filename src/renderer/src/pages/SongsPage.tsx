import { useEffect } from 'react'
import { useLibrary } from '@renderer/features/library'
import { PlaylistTrackTable } from '@renderer/features/playlists'
import { LibraryBrowseShell } from './LibraryBrowseShell'

/** All Songs — library banner chrome + track table. */
export function SongsPage(): React.JSX.Element {
  const { tracks, trackTotal, searchQuery, setSort } = useLibrary()

  useEffect(() => {
    setSort('date_added')
  }, [setSort])

  const songLabel = searchQuery
    ? `${trackTotal} match${trackTotal === 1 ? '' : 'es'}`
    : `${trackTotal} song${trackTotal === 1 ? '' : 's'}`

  return (
    <LibraryBrowseShell
      title="All Songs"
      description={searchQuery ? `Results for “${searchQuery}”` : null}
      metaPrimary={songLabel}
      icon="queue"
      artItems={tracks}
      showSort
    >
      <PlaylistTrackTable
        tracks={tracks}
        emptyMessage={
          searchQuery
            ? 'No songs match this search.'
            : 'No songs in your library yet. Add music folders in Settings.'
        }
      />
    </LibraryBrowseShell>
  )
}
