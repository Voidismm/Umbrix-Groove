const CHANGELOG_SEEN_KEY = 'ug-changelog-seen-version'

/** Last release notes version the user dismissed (or was seeded on first launch). */
export function getSeenChangelogVersion(): string | null {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY)
  } catch {
    return null
  }
}

export function setSeenChangelogVersion(version: string): void {
  try {
    localStorage.setItem(CHANGELOG_SEEN_KEY, version)
  } catch {
    /* ignore quota / private mode */
  }
}
