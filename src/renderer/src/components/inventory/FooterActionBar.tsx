import type { RefObject } from 'react'
import type { InventoryProduct } from '@renderer/types/pos'
import { formatCurrency } from '@renderer/utils/currency'
import { AppButton } from '@renderer/components/common/AppButton'
import type { InventoryTab } from './tabs'
import './footer-action-bar.css'

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
    <div className="footer-action-bar">
      {/* Left: Search */}
      <div ref={searchWrapperRef} className="footer-action-bar__search">
        {/* <span className="footer-action-bar__search-label">Item Lookup</span> */}
        <div className="footer-action-bar__search-wrap">
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
            className="footer-action-bar__search-input"
            name="Search Inventory"
          />

          {/* Autocomplete dropdown — Items tab only */}
          {activeTab === 'items' &&
            showSearchDropdown &&
            searchResults.length > 0 &&
            searchTerm.trim() && (
              <ul
                role="listbox"
                aria-label="Search results"
                className="footer-action-bar__dropdown"
              >
                {searchResults.map((item) => (
                  <li
                    key={item.item_number}
                    role="option"
                    aria-selected={false}
                    className="footer-action-bar__dropdown-item"
                    onMouseDown={() => onSelectSearchResult(item)}
                  >
                    <span className="footer-action-bar__dropdown-item-name">{item.item_name}</span>
                    <span className="footer-action-bar__dropdown-item-meta">
                      {item.sku} · {formatCurrency(item.retail_price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

          {/* No-results prompt — Items tab only */}
          {activeTab === 'items' && noResultsSku && (
            <div className="footer-action-bar__no-results">
              <span className="footer-action-bar__no-results-text">
                No item found for{' '}
                <span className="footer-action-bar__no-results-sku">{noResultsSku}</span>
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
      <div className="footer-action-bar__spacer" />

      {/* Right: Action buttons — only on Items tab */}
      {showItemActions && (
        <div className="footer-action-bar__actions">
          <AppButton size="md" variant="success" disabled={!canNew} onClick={onNew}>
            + New Item
          </AppButton>

          <AppButton size="md" variant="success" disabled={!canSave} onClick={onSave}>
            Save
          </AppButton>

          <div className="footer-action-bar__divider" />

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
