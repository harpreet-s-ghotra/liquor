import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { InventoryIcon } from '@renderer/components/common/modal-icons'
import { ItemForm, type ItemFormHandle, type ItemFormButtonState } from './items/ItemForm'
import { ItemTypePanel } from './item-types/ItemTypePanel'
import { TaxCodePanel } from './tax-codes/TaxCodePanel'
import { DistributorPanel } from './distributors/DistributorPanel'
import { ReorderDashboard } from './reorder/ReorderDashboard'
import { PurchaseOrderPanel } from './purchase-orders/PurchaseOrderPanel'
import { FooterActionBar } from './FooterActionBar'
import { useDebounce } from '@renderer/hooks/useDebounce'
import type { InventoryProduct, ReorderProduct } from '@renderer/types/pos'
import { type InventoryTab, INVENTORY_TABS } from './tabs'
import './inventory-modal.css'

const LAST_TAB_KEY = 'inventory-modal-last-tab'

function readLastTab(): InventoryTab {
  try {
    const saved = localStorage.getItem(LAST_TAB_KEY)
    return INVENTORY_TABS.includes(saved as InventoryTab) ? (saved as InventoryTab) : 'items'
  } catch {
    return 'items'
  }
}

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
  const [activeTab, setActiveTab] = useState<InventoryTab>(readLastTab)
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
  const [prefillItems, setPrefillItems] = useState<ReorderProduct[] | null>(null)
  const [prefillDistributor, setPrefillDistributor] = useState<number | null>(null)
  const [prefillUnitThreshold, setPrefillUnitThreshold] = useState(10)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  const handleTabChange = useCallback((tab: InventoryTab): void => {
    setActiveTab(tab)
    setSearchTerm('')
    setNoResultsSku(null)
    try {
      localStorage.setItem(LAST_TAB_KEY, tab)
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleCreateOrder = useCallback(
    (items: ReorderProduct[], distributor: number | 'unassigned' | null, unitThreshold: number) => {
      setPrefillItems(items)
      setPrefillDistributor(typeof distributor === 'number' ? distributor : null)
      setPrefillUnitThreshold(unitThreshold)
      handleTabChange('purchase-orders')
    },
    [handleTabChange]
  )

  const handlePrefillConsumed = useCallback((): void => {
    setPrefillItems(null)
    setPrefillDistributor(null)
    setPrefillUnitThreshold(10)
  }, [])

  const [pendingOpenItemNumber, setPendingOpenItemNumber] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      const nextTab = openItemNumber != null ? 'items' : readLastTab()
      setActiveTab(nextTab)
      setSearchTerm('')
      setNoResultsSku(null)
      setInventoryFilter('all')
      if (openItemNumber != null) {
        setPendingOpenItemNumber(openItemNumber)
      } else if (nextTab === 'items') {
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }
    } else {
      setPendingOpenItemNumber(null)
    }
  }, [isOpen, openItemNumber])

  // Drives the actual selectItem call once the items tab is mounted and the ref is bound.
  // Without this, calling selectItem in the same tick as setActiveTab races the ItemForm
  // mount and the ref is null — modal opens empty.
  useEffect(() => {
    if (pendingOpenItemNumber == null) return
    if (activeTab !== 'items') return

    let cancelled = false
    let attempts = 0
    const tryDispatch = (): void => {
      if (cancelled) return
      const handle = itemFormRef.current
      if (handle) {
        void handle.selectItem({ item_number: pendingOpenItemNumber } as InventoryProduct)
        setPendingOpenItemNumber(null)
        return
      }
      if (attempts++ < 10) {
        requestAnimationFrame(tryDispatch)
      } else {
        setPendingOpenItemNumber(null)
      }
    }
    tryDispatch()

    return () => {
      cancelled = true
    }
  }, [pendingOpenItemNumber, activeTab])

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
    const trimmedSearch = debouncedSearch.trim()
    if (trimmedSearch.length < 2 || typeof api?.searchInventoryProducts !== 'function') {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    let active = true
    void api.searchInventoryProducts(trimmedSearch).then((results) => {
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
        <AppModalHeader
          icon={<InventoryIcon />}
          label="Inventory"
          title={
            activeTab === 'items'
              ? itemBtnState.selectedSku
                ? `Edit Record: ${itemBtnState.selectedSku}`
                : 'New Item'
              : activeTab === 'item-types'
                ? 'Item Types'
                : activeTab === 'tax-codes'
                  ? 'Tax Codes'
                  : activeTab === 'distributors'
                    ? 'Distributors'
                    : activeTab === 'reorder'
                      ? 'Reorder Dashboard'
                      : activeTab === 'purchase-orders'
                        ? 'Purchase Orders'
                        : activeTab
          }
          onClose={onClose}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(tab) => handleTabChange(tab as InventoryTab)}
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
                  { value: INVENTORY_TABS[3], label: 'Distributors' },
                  { value: INVENTORY_TABS[4], label: 'Reorder' },
                  { value: INVENTORY_TABS[5], label: 'Purchase Orders' }
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
          <TabsContent
            value="reorder"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <ReorderDashboard onCreateOrder={handleCreateOrder} />
          </TabsContent>
          <TabsContent
            value="purchase-orders"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <PurchaseOrderPanel
              prefillItems={prefillItems}
              prefillDistributor={prefillDistributor}
              prefillUnitThreshold={prefillUnitThreshold}
              onPrefillConsumed={handlePrefillConsumed}
            />
          </TabsContent>
        </Tabs>

        <FooterActionBar
          activeTab={activeTab}
          showSearch={activeTab !== 'reorder' && activeTab !== 'purchase-orders'}
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          onSearch={() => void handleSearch()}
          searchResults={searchResults}
          showSearchDropdown={showSearchDropdown}
          onSelectSearchResult={selectSearchResult}
          onOpenDropdown={() => {
            setShowSearchDropdown(searchResults.length > 0)
            setNoResultsSku(null)
          }}
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
