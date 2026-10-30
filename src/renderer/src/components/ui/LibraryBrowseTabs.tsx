import type { NavId } from '@shared/types'
import { useLibrary } from '@renderer/features/library'
import { BrowseTabs } from './BrowseTabs'

const LIBRARY_TABS = [
  { id: 'songs' as const, label: 'All Songs' },
  { id: 'albums' as const, label: 'All Albums' },
  { id: 'artists' as const, label: 'All Artists' }
]

type LibraryTabId = (typeof LIBRARY_TABS)[number]['id']

export function isLibraryBrowseNav(nav: NavId): boolean {
  return nav === 'songs' || nav === 'albums' || nav === 'artists'
}

/** Tab plate for All Songs / Albums / Artists. */
export function LibraryBrowseTabs(): React.JSX.Element {
  const { activeNav, setActiveNav, selectAlbum, selectArtist, selectGenre } = useLibrary()
  const active: LibraryTabId =
    activeNav === 'albums' || activeNav === 'artists' ? activeNav : 'songs'

  return (
    <BrowseTabs
      label="Library browse"
      tabs={LIBRARY_TABS}
      active={active}
      onChange={(id) => {
        selectAlbum(null)
        selectArtist(null)
        selectGenre(null)
        setActiveNav(id)
      }}
    />
  )
}
