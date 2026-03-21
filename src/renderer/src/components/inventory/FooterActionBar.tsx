import type { RefObject } from 'react'
import type { InventoryProduct } from '@renderer/types/pos'
import { formatCurrency } from '@renderer/utils/currency'
import { AppButton } from '@renderer/components/common/AppButton'
import type { InventoryTab } from './tabs'

const SEARCH_PLACEHOLDER: Record<InventoryTab, string> = {
  items: 'Scan or enter SKU / name...',
  departments: 'Filter departments...',
  'tax-codes': 'Filter tax codes...',
  vendors: 'Filter vendors...'
}

export type FooterActionBarProps = {
  activeTab: InventoryTab
  // Search
  searchTerm: string
  onSearchTermChange: (term: string) => void
  onSearch: () => void
  searchResults: InventoryProduct[]
  showSearchDropdown: boolean
  onSelectSearchResult: (item: InventoryProduct) => void
  onCloseDropdown: () => void
  searchWrapperRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  noResultsSku: string | null
  onAddNewWithSku: (sku: string) => void
  // Actions — only rendered when on the Items tab
  showItemActions: boolean
  canNew: boolean
  canSave: boolean
  canDelete: boolean
  onNew: () => void
  onSave: () => void
  onDelete: () => void
  onDiscard: () => void
}

export function FooterActionBar({
  activeTab,
  searchTerm,
  onSearchTermChange,
  onSearch,
  searchResults,
  showSearchDropdown,
  onSelectSearchResult,
  onCloseDropdown,
  searchWrapperRef,
  searchInputRef,
  noResultsSku,
  onAddNewWithSku,
  showItemActions,
  canNew,
  canSave,
  canDelete,
  onNew,
  onSave,
  onDelete,
  onDiscard
}: FooterActionBarProps): React.JSX.Element {
  return (
    <div className="h-[80px] bg-[#2d3133] flex items-center gap-6 px-6 shrink-0">
      {/* Left: Search */}
      <div ref={searchWrapperRef} className="relative flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[1.2px] text-[#94a3b8] whitespace-nowrap">
          Item Lookup
        </span>
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search Inventory"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch()
              if (e.key === 'Escape') onCloseDropdown()
            }}
            placeholder={SEARCH_PLACEHOLDER[activeTab] ?? 'Search...'}
            className="h-9 w-[280px] bg-(--bg-input) rounded-(--radius) px-3 text-[13px] font-bold text-(--text-primary) placeholder:text-(--text-muted) placeholder:font-normal outline-none border border-(--border-default) focus:ring-1 focus:ring-(--accent-blue)"
          />

          {/* Autocomplete dropdown — Items tab only */}
          {activeTab === 'items' &&
            showSearchDropdown &&
            searchResults.length > 0 &&
            searchTerm.trim() && (
              <ul
                role="listbox"
                aria-label="Search results"
                className="absolute bottom-full left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-(--radius) bg-(--bg-surface) border border-(--border-default) shadow-lg mb-1"
              >
                {searchResults.map((item) => (
                  <li
                    key={item.item_number}
                    role="option"
                    aria-selected={false}
                    className="px-3 py-1.5 cursor-pointer flex justify-between items-center hover:bg-(--bg-surface-soft)"
                    onMouseDown={() => onSelectSearchResult(item)}
                  >
                    <span className="truncate text-[13px] font-bold text-(--text-primary)">
                      {item.item_name}
                    </span>
                    <span className="ml-2 text-[11px] text-(--text-muted) shrink-0">
                      {item.sku} · {formatCurrency(item.retail_price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

          {/* No-results prompt — Items tab only */}
          {activeTab === 'items' && noResultsSku && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-(--radius) bg-(--bg-surface) border border-(--border-default) shadow-lg px-3 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[12px] text-(--text-muted)">
                No item found for{' '}
                <span className="font-bold text-(--text-primary)">{noResultsSku}</span>
              </span>
              <AppButton
                size="sm"
                variant="success"
                onMouseDown={() => onAddNewWithSku(noResultsSku)}
              >
                + Add New Item
              </AppButton>
            </div>
          )}
        </div>
        <AppButton size="sm" variant="default" onClick={onSearch}>
          Search
        </AppButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: Action buttons — only on Items tab */}
      {showItemActions && (
        <div className="flex items-center gap-3">
          <AppButton size="md" variant="success" disabled={!canNew} onClick={onNew}>
            + New Item
          </AppButton>

          <AppButton size="md" variant="success" disabled={!canSave} onClick={onSave}>
            Save
          </AppButton>

          <div className="w-0.5 h-8 bg-[rgba(194,199,202,0.3)]" />

          <AppButton size="md" variant="danger" disabled={!canDelete} onClick={onDelete}>
            Delete Item
          </AppButton>

          <AppButton size="md" variant="neutral" onClick={onDiscard}>
            Discard
          </AppButton>
        </div>
      )}
    </div>
  )
}
