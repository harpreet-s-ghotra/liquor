import { cn } from '@renderer/lib/utils'
import './tab-bar.css'

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
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={cn('tab-bar__tab', activeTab === tab.id && 'tab-bar__tab--active')}
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
