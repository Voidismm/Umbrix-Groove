import { MIGRATIONS as INITIAL } from './001_initial'
import { MIGRATIONS as PLAYLISTS } from './002_playlists'
import { MIGRATIONS as PLAYLIST_COVER } from './003_playlist_cover'
import { MIGRATIONS as PLAYLIST_ACCENT } from './004_playlist_accent'
import { MIGRATIONS as PLAY_HISTORY } from './005_play_history'

/** Ordered database migrations. Add new files as 002_*.ts, 003_*.ts, etc. */
export const MIGRATIONS = [
  ...INITIAL,
  ...PLAYLISTS,
  ...PLAYLIST_COVER,
  ...PLAYLIST_ACCENT,
  ...PLAY_HISTORY
]
