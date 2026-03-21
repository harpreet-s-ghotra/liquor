import { cn } from '@renderer/lib/utils'

export type TabItem = {
  id: string
  label: string
}

type TabBarProps = {
  tabs: TabItem[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): React.JSX.Element {
  return (
    <div
      className="flex gap-1 p-1 bg-[var(--bg-surface)] border-b border-[var(--border-soft)]"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={cn(
            'px-4 py-2 text-[0.92rem] font-bold rounded-[var(--radius)] cursor-pointer border-none',
            activeTab === tab.id
              ? 'text-[var(--btn-text)] bg-[var(--btn-bg)] shadow-xs'
              : 'text-[var(--text-muted)] bg-transparent'
          )}
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
