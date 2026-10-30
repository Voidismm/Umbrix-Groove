export type ChangelogEntry = {
  version: string
  /** Short release title shown in Settings and the what's-new modal. */
  summary: string
  notes?: string[]
}

/**
 * In-app release notes — keep newest first.
 * When shipping an update: add a new top entry matching package.json version,
 * then build/push. Clients show it once on next launch.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.12',
    summary:
      'Added Live Appearance Studio, where you can select premade themes, or create your own themes with the hue, brightness, and saturation sliders.',
    notes: [
      'Live Studio Appearance editor floats over the app. You can drag it, use sliders to change buttons, scrollbars, and the UI colors all separately and watch it change and update live.',
      'Built-in presets: Umbrix, Violet, Ocean, Rose, Ember, Mint, and new Black Noire.',
      'Save theme lets you save the theme you made and then name it so you can make an infinite amount and switch between them all you want.',
      'Fixed the folders in the left sidebar when collapsed so that they are centered.',
      'Folders in the left sidebar when collapsed now use the rounded square look instead of a circle.',
      'Did a lot of UI and bug fixes that drove me to a deep and growing madness.'
    ]
  },
  {
    version: '0.1.11',
    summary:
      'New UI, Umbrix Galaxy home, edit tracks and lyrics, what\'s-new changelogs, and a bunch more shit I spent too long working on.',
    notes: [
      'Candy scrollbars across home rails, center workspace, and both sidebars, with PNG thumbs that actually look like Umbrix.',
      'Home carousel arrows are tall edge panels now, with drag, flick momentum, and denser candy bars.',
      'Frameless window drag on empty titlebar and footer chrome, plus double-click to maximize or restore.',
      'Mouse back and forward buttons walk your in-app navigation history.',
      'Home got Jump Back In, On Repeat, Most Played, Mixes, and Fresh Finds as real sub-tabs.',
      'Library browse tabs for All Songs, Albums, and Artists share the same banner treatment.',
      'Playlist banners fade softer at the top and bottom; column headers are bigger and # lines up cleanly.',
      'Updated the home page and theme to Umbrix Galaxy.',
      'Galaxy chrome stars on the titlebar, footer, and sidebars by default, with an Appearance toggle to turn them off.',
      'Newly made crest across the titlebar, updater, favicon, and installer icon.',
      'About page story copy, gold Umbrix / soft Groove title, green version pill, and the memorial plaque for my hams.',
      'Guide cards lightened so How to add music you already have is less dark.',
      'Volume and hue sliders share the same look, and the hue thumb shows the color you pick.',
      'Taller titlebar, bigger chrome icons, softer search focus, and a little spin on the settings heart.',
      'Collapsed left rail no longer resizes, and the gold L-brackets hide when it is collapsed.',
      'Queue drop targets, thinner scroll rails, and playlist hover polish throughout the tree.',
      'Visualizer error boundary so a viz crash does not happen.',
      'Lazy covers and browse-shell wiring so album and artist pages look similar to All Songs.',
      'Edit Track Metadata from All Songs, playlists, or the footer: library-only edits, audio files stay untouched.',
      'Locked user metadata survives rescans; custom cover art lands in the app artwork cache.',
      'Genre and year use GrooveSelect dropdowns; track and disc number fields are gone from the edit form.',
      'Paste or upload lyrics (.lrc / .txt / .lyrics) with overrides stored in the library database.',
      'Lyrics links point at Megalobiz and RentAnAdviser so you can grab real LRC files.',
      'Edit Track only closes from X or Save. No accidental backdrop dismiss.',
      'ModalHeader and ModalChrome give Confirm, Prompt, Settings, Playlist Edit, and Add Tracks the galaxy wash headers.',
      'Update dialog stays its own brand chrome on purpose. Other modals get titles that belong to them.',
      'GrooveSelect replaces ugly native dropdowns with Umbrix menus.',
      'GrooveColorPicker replaces native color inputs for playlist banner accents.',
      'Groove tips for hover labels, plus new icons for Keybinds, Warning Toggles, and About.',
      'Settings → Keybinds rename, bigger sidebar icons, Updates check CTA in a framed button, Changelog under Updates.',
      'Gold separator above Updates in the settings nav so the release section reads as its own block.',
      'What\'s-new ChangelogDialog shows once after an update.',
      'Settings → Changelog lists each version with a modal-matched card and Click to read log.',
      'Changelog seen-version persistence so the popup never nags twice for the same build.'
    ]
  }
]
