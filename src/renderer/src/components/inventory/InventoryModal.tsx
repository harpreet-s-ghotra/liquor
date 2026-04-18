import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ItemForm, type ItemFormHandle, type ItemFormButtonState } from './items/ItemForm'
import { ItemTypePanel } from './item-types/ItemTypePanel'
import { TaxCodePanel } from './tax-codes/TaxCodePanel'
import { DistributorPanel } from './distributors/DistributorPanel'
import { FooterActionBar } from './FooterActionBar'
import { useDebounce } from '@renderer/hooks/useDebounce'
import type { InventoryProduct } from '@renderer/types/pos'
import { type InventoryTab, INVENTORY_TABS } from './tabs'
import './inventory-modal.css'

type InventoryModalProps = {
  isOpen: boolean
  onClose: () => void
  openItemNumber?: number
  onRecallTransaction?: (txnNumber: string) => void
}

export function InventoryModal({
  isOpen,
  onClose,
  openItemNumber,
  onRecallTransaction
}: InventoryModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<InventoryTab>('items')
  const itemFormRef = useRef<ItemFormHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [itemBtnState, setItemBtnState] = useState<ItemFormButtonState>({
    canNew: false,
    canSave: true,
    canDelete: false,
    selectedSku: null
  })
  const handleItemButtonState = useCallback(
    (state: ItemFormButtonState) => setItemBtnState(state),
    []
  )

  const api = typeof window !== 'undefined' ? window.api : undefined
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryProduct[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [noResultsSku, setNoResultsSku] = useState<string | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'needs-pricing'>('all')
  const [unpricedCount, setUnpricedCount] = useState(0)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Reset to Items tab and focus the search input every time the modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setActiveTab('items')
        setSearchTerm('')
        setNoResultsSku(null)
        setInventoryFilter('all')
        if (openItemNumber != null) {
          void itemFormRef.current?.selectItem({ item_number: openItemNumber } as InventoryProduct)
        } else {
          searchInputRef.current?.focus()
        }
      })
    }
  }, [isOpen, openItemNumber])

  // Load unpriced product count whenever the modal is open
  useEffect(() => {
    if (!isOpen || typeof api?.getUnpricedProducts !== 'function') return
    void api.getUnpricedProducts().then((items) => setUnpricedCount(items.length))
  }, [isOpen, api])

  // Debounced search — only for Items tab autocomplete
  useEffect(() => {
    if (activeTab !== 'items') return
    // When "needs pricing" filter is active and no manual search term, show unpriced list
    if (inventoryFilter === 'needs-pricing' && !debouncedSearch.trim()) {
      if (typeof api?.getUnpricedProducts !== 'function') return
      let active = true
      void api.getUnpricedProducts().then((results) => {
        if (!active) return
        setSearchResults(results)
        setShowSearchDropdown(results.length > 0)
      })
      return () => {
        active = false
      }
    }
    if (!debouncedSearch.trim() || typeof api?.searchInventoryProducts !== 'function') return
    let active = true
    void api.searchInventoryProducts(debouncedSearch).then((results) => {
      if (!active) return
      setSearchResults(results)
      setShowSearchDropdown(results.length > 0)
    })
    return () => {
      active = false
    }
  }, [debouncedSearch, api, activeTab, inventoryFilter])

  // Clear no-results prompt when the user edits the search term
  const handleSearchTermChange = (term: string): void => {
    setSearchTerm(term)
    if (noResultsSku) setNoResultsSku(null)
    // Typing cancels the "needs pricing" filter mode
    if (inventoryFilter !== 'all' && term.trim()) setInventoryFilter('all')
    if (!term.trim()) {
      if (inventoryFilter === 'all') {
        setShowSearchDropdown(false)
        setSearchResults([])
      }
      // If filter is active, the debounced effect will repopulate the dropdown
    }
  }

  const handleFilterChange = (filter: 'all' | 'needs-pricing'): void => {
    setInventoryFilter(filter)
    setSearchTerm('')
    setNoResultsSku(null)
    if (filter === 'all') {
      setSearchResults([])
      setShowSearchDropdown(false)
    }
    // 'needs-pricing' — the debounced effect will load unpriced products
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
        setNoResultsSku(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = async (): Promise<void> => {
    if (!searchTerm.trim()) return
    if (activeTab !== 'items') return
    if (typeof api?.searchInventoryProducts !== 'function') return
    try {
      const results = await api.searchInventoryProducts(searchTerm)
      setSearchResults(results)
      if (results.length > 0) {
        setShowSearchDropdown(true)
        setNoResultsSku(null)
      } else {
        setShowSearchDropdown(false)
        setNoResultsSku(searchTerm.trim())
      }
    } catch {
      /* no-op */
    }
  }

  const selectSearchResult = (item: InventoryProduct): void => {
    setShowSearchDropdown(false)
    setNoResultsSku(null)
    setSearchTerm('')
    setActiveTab('items')
    itemFormRef.current?.selectItem(item)
  }

  const handleAddNewWithSku = (sku: string): void => {
    setNoResultsSku(null)
    setSearchTerm('')
    setShowSearchDropdown(false)
    setActiveTab('items')
    itemFormRef.current?.startNewWithSku(sku)
  }

  const handleSaveComplete = useCallback((): void => {
    // Refresh unpriced count so the badge stays accurate
    if (typeof api?.getUnpricedProducts === 'function') {
      void api.getUnpricedProducts().then((items) => setUnpricedCount(items.length))
    }
    if (inventoryFilter === 'needs-pricing') {
      // Refresh the unpriced list in the dropdown
      if (typeof api?.getUnpricedProducts === 'function') {
        void api.getUnpricedProducts().then((results) => {
          setSearchResults(results)
          setShowSearchDropdown(results.length > 0)
        })
      }
      return
    }
    if (!searchTerm.trim() || typeof api?.searchInventoryProducts !== 'function') return
    void api.searchInventoryProducts(searchTerm).then(setSearchResults)
  }, [searchTerm, api, inventoryFilter])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="inventory-modal"
        aria-label="Inventory Management"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Inventory Management</DialogTitle>
        {/* Header */}
        <div className="inventory-modal__header">
          <div className="inventory-modal__header-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a3f69c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
          <div className="inventory-modal__header-breadcrumb">
            <span className="inventory-modal__header-label">Inventory Maintenance</span>
            <span className="inventory-modal__header-separator">/</span>
            <span className="inventory-modal__header-title">
              {activeTab === 'items'
                ? itemBtnState.selectedSku
                  ? `Edit Record: ${itemBtnState.selectedSku}`
                  : 'New Item'
                : activeTab === 'item-types'
                  ? 'Item Types'
                  : activeTab === 'tax-codes'
                    ? 'Tax Codes'
                    : activeTab === 'distributors'
                      ? 'Distributors'
                      : activeTab}
            </span>
          </div>
          <button type="button" onClick={onClose} className="inventory-modal__close-btn">
            Close
          </button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab as InventoryTab)
            setSearchTerm('')
            setNoResultsSku(null)
          }}
          className="inventory-modal__tabs"
        >
          {/* Outer tab bar */}
          <div className="inventory-modal__tab-bar">
            <TabsList className="inventory-modal__tab-list">
              {(
                [
                  { value: INVENTORY_TABS[0], label: 'Items' },
                  { value: INVENTORY_TABS[1], label: 'Item Types' },
                  { value: INVENTORY_TABS[2], label: 'Tax Codes' },
                  { value: INVENTORY_TABS[3], label: 'Distributors' }
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger key={value} value={value} className="inventory-modal__tab-trigger">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeTab === 'items' && (
              <div className="inventory-modal__filter-chips">
                <button
                  type="button"
                  className={`inventory-modal__filter-chip${inventoryFilter === 'all' ? ' inventory-modal__filter-chip--active' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`inventory-modal__filter-chip${inventoryFilter === 'needs-pricing' ? ' inventory-modal__filter-chip--active' : ''}`}
                  onClick={() => handleFilterChange('needs-pricing')}
                >
                  Needs pricing
                  {unpricedCount > 0 && (
                    <span className="inventory-modal__filter-chip-badge">{unpricedCount}</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <TabsContent
            value="items"
            className="inventory-modal__tab-content inventory-modal__tab-content--items"
          >
            <ItemForm
              ref={itemFormRef}
              onButtonStateChange={handleItemButtonState}
              onSaveComplete={handleSaveComplete}
              onRecallTransaction={(txnNumber) => {
                onClose()
                onRecallTransaction?.(txnNumber)
              }}
            />
          </TabsContent>
          <TabsContent
            value="item-types"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <ItemTypePanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent
            value="tax-codes"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <TaxCodePanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent
            value="distributors"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <DistributorPanel searchFilter={searchTerm} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <FooterActionBar
          activeTab={activeTab}
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          onSearch={() => void handleSearch()}
          searchResults={searchResults}
          showSearchDropdown={showSearchDropdown}
          onSelectSearchResult={selectSearchResult}
          onCloseDropdown={() => {
            setShowSearchDropdown(false)
            setNoResultsSku(null)
          }}
          searchWrapperRef={searchWrapperRef}
          searchInputRef={searchInputRef}
          noResultsSku={noResultsSku}
          onAddNewWithSku={handleAddNewWithSku}
          showItemActions={activeTab === 'items'}
          canSave={itemBtnState.canSave}
          canDelete={itemBtnState.canDelete}
          onSave={() => itemFormRef.current?.handleSave()}
          onDelete={() => itemFormRef.current?.handleDelete()}
          onDiscard={() => itemFormRef.current?.handleDiscard()}
        />
      </DialogContent>
    </Dialog>
  )
}
