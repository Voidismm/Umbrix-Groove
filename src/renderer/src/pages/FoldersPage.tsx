import { useLibrary } from '@renderer/features/library'

/** Manage indexed music folders (does not delete files on disk). */
export function FoldersPage(): React.JSX.Element {
  const { folders, scanning, addFolder, rescanAll, rescanFolder, removeFolder, openFolder } =
    useLibrary()

  return (
    <section className="view">
      <header className="view__head view__head--row">
        <div>
          <h2>Music Folders</h2>
          <p>Original files stay on disk. Removing a folder only drops index rows.</p>
        </div>
        <div className="view__actions">
          <button type="button" className="hero__cta" onClick={() => void addFolder()}>
            Add Folder
          </button>
          <button
            type="button"
            className="hero__cta hero__cta--ghost"
            onClick={() => void rescanAll()}
            disabled={folders.length === 0 || scanning}
          >
            Rescan All
          </button>
        </div>
      </header>
      <div className="list-panel gold-frame">
        {folders.length === 0 ? (
          <p className="muted padded">No folders yet. Add one to begin indexing.</p>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="list-panel__row list-panel__row--static">
              <div>
                <strong>{folder.path}</strong>
                <span>
                  {folder.trackCount} songs
                  {folder.lastScannedAt
                    ? ` · scanned ${new Date(folder.lastScannedAt).toLocaleString()}`
                    : ' · not scanned yet'}
                </span>
              </div>
              <div className="list-panel__actions">
                <button type="button" onClick={() => void openFolder(folder.id)}>
                  Open folder
                </button>
                <button
                  type="button"
                  onClick={() => void rescanFolder(folder.id)}
                  disabled={scanning}
                >
                  Rescan
                </button>
                <button type="button" onClick={() => void removeFolder(folder.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
