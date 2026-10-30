import { ScanBanner, useLibrary } from '@renderer/features/library'
import { usePlayback, VisualizerStage } from '@renderer/features/player'
import {
  AlbumsPage,
  ArtistsPage,
  BrowsePage,
  DailyMixPage,
  GenresPage,
  HomePage,
  LyricsPage,
  PlaylistsPage,
  SongsPage
} from '@renderer/pages'
import { CandyScroll } from '../ui/CandyScroll'
import { VisualizerErrorBoundary } from '../ui/VisualizerErrorBoundary'
import './CenterWorkspace.css'

/** Center pane — picks which page to show from the left sidebar. */
export function CenterWorkspace(): React.JSX.Element {
  const { activeNav } = useLibrary()
  const { visualizerOpen, setVisualizerOpen } = usePlayback()

  return (
    <main className="center gold-frame" aria-label="Main content">
      {visualizerOpen ? (
        <div className="center__viz">
          <VisualizerErrorBoundary onError={() => setVisualizerOpen(false)}>
            <VisualizerStage />
          </VisualizerErrorBoundary>
        </div>
      ) : (
        <CandyScroll className="center__scroll" label="Scroll main content">
          <ScanBanner />

          {activeNav === 'home' && <HomePage />}
          {activeNav === 'daily-mix' && <DailyMixPage />}
          {activeNav === 'songs' && <SongsPage />}
          {activeNav === 'albums' && <AlbumsPage />}
          {activeNav === 'artists' && <ArtistsPage />}
          {activeNav === 'genres' && <GenresPage />}
          {activeNav === 'playlists' && <PlaylistsPage />}
          {activeNav === 'lyrics' && <LyricsPage />}
          {activeNav === 'browse' && <BrowsePage />}
        </CandyScroll>
      )}
    </main>
  )
}
