type BrowseTab<T extends string> = {
  id: T
  label: string
}

type BrowseTabsProps<T extends string> = {
  tabs: readonly BrowseTab<T>[]
  active: T
  onChange: (id: T) => void
  label: string
}

/** Shared plate tab strip (home + library browse). */
export function BrowseTabs<T extends string>({
  tabs,
  active,
  onChange,
  label
}: BrowseTabsProps<T>): React.JSX.Element {
  return (
    <nav className="browse-tabs" aria-label={label}>
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={`browse-tabs__tab${active === item.id ? ' is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
