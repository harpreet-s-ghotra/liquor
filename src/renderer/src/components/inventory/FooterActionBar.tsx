import type { RefObject } from 'react'
import { SearchDropdown } from '@renderer/components/common/SearchDropdown'
import type { InventoryProduct } from '@renderer/types/pos'
import { formatCurrency } from '@renderer/utils/currency'
import { AppButton } from '@renderer/components/common/AppButton'
import type { InventoryTab } from './tabs'
import './footer-action-bar.css'

const SEARCH_PLACEHOLDER: Record<InventoryTab, string> = {
  items: 'Scan or enter SKU / name...',
  'item-types': 'Filter item types...',
  'tax-codes': 'Filter tax codes...',
  distributors: 'Filter distributors...',
  reorder: 'Search reorder items...',
  'purchase-orders': 'Search purchase orders...'
}

export type FooterActionBarProps = {
  activeTab: InventoryTab
  showSearch?: boolean
  // Search
  searchTerm: string
  onSearchTermChange: (term: string) => void
  onSearch: () => void
  searchResults: InventoryProduct[]
  showSearchDropdown: boolean
  onSelectSearchResult: (item: InventoryProduct) => void
  onOpenDropdown?: () => void
  onCloseDropdown: () => void
  searchWrapperRef: RefObject<HTMLDivElement | null>
  searchInputRef: RefObject<HTMLInputElement | null>
  noResultsSku: string | null
  onAddNewWithSku: (sku: string) => void
  // Actions — only rendered when on the Items tab
  showItemActions: boolean
  canDuplicate: boolean
  onNewItem: () => void
  onDuplicate: () => void
  canSave: boolean
  canDelete: boolean
  onSave: () => void
  onDelete: () => void
  onDiscard: () => void
}

export function FooterActionBar({
  activeTab,
  showSearch = true,
  searchTerm,
  onSearchTermChange,
  onSearch,
  searchResults,
  showSearchDropdown,
  onSelectSearchResult,
  onOpenDropdown,
  onCloseDropdown,
  searchWrapperRef,
  searchInputRef,
  noResultsSku,
  onAddNewWithSku,
  showItemActions,
  canDuplicate,
  onNewItem,
  onDuplicate,
  canSave,
  canDelete,
  onSave,
  onDelete,
  onDiscard
}: FooterActionBarProps): React.JSX.Element {
  return (
    <div className="footer-action-bar">
      {showSearch && (
        <div ref={searchWrapperRef} className="footer-action-bar__search">
          <div className="footer-action-bar__search-wrap">
            <SearchDropdown
              ariaLabel="Search Inventory"
              inputRef={searchInputRef}
              value={searchTerm}
              onValueChange={onSearchTermChange}
              results={activeTab === 'items' ? searchResults : []}
              isOpen={activeTab === 'items' && showSearchDropdown && searchTerm.trim().length > 0}
              onOpenChange={(open) => {
                if (open) onOpenDropdown?.()
                else onCloseDropdown()
              }}
              onSelect={onSelectSearchResult}
              onSubmit={onSearch}
              listboxLabel="Search results"
              getOptionKey={(item) => item.item_number}
              renderOption={(item) => (
                <div className="footer-action-bar__dropdown-item-grid">
                  <span className="footer-action-bar__dropdown-item-name">{item.item_name}</span>
                  <span className="footer-action-bar__dropdown-item-sku">{item.sku}</span>
                  <span className="footer-action-bar__dropdown-item-distributor">
                    {item.distributor_name ?? 'No distributor'}
                  </span>
                  <span className="footer-action-bar__dropdown-item-price">
                    {formatCurrency(item.retail_price)}
                  </span>
                  <span className="footer-action-bar__dropdown-item-stock">
                    {item.in_stock} in stock
                  </span>
                </div>
              )}
              placeholder={SEARCH_PLACEHOLDER[activeTab] ?? 'Search...'}
              listboxPlacement="top"
              inputClassName="footer-action-bar__search-input"
              listboxClassName="footer-action-bar__dropdown"
              optionClassName="footer-action-bar__dropdown-item"
            />

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
      )}

      <div className="footer-action-bar__spacer" />

      {/* Right: Action buttons — only on Items tab */}
      {showItemActions && (
        <div className="footer-action-bar__actions">
          <AppButton size="md" variant="neutral" onClick={onNewItem}>
            New Item
          </AppButton>

          <AppButton size="md" variant="neutral" disabled={!canDuplicate} onClick={onDuplicate}>
            Duplicate
          </AppButton>

          <div className="footer-action-bar__divider" />

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
