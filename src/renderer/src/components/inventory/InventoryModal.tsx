import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ItemForm, type ItemFormHandle, type ItemFormButtonState } from './items/ItemForm'
import { DepartmentPanel } from './departments/DepartmentPanel'
import { TaxCodePanel } from './tax-codes/TaxCodePanel'
import { VendorPanel } from './vendors/VendorPanel'
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
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Reset to Items tab and focus the search input every time the modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setActiveTab('items')
        setSearchTerm('')
        setNoResultsSku(null)
        if (openItemNumber != null) {
          void itemFormRef.current?.selectItem({ item_number: openItemNumber } as InventoryProduct)
        } else {
          searchInputRef.current?.focus()
        }
      })
    }
  }, [isOpen, openItemNumber])

  // Debounced search — only for Items tab autocomplete
  useEffect(() => {
    if (activeTab !== 'items') return
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
  }, [debouncedSearch, api, activeTab])

  // Clear no-results prompt when the user edits the search term
  const handleSearchTermChange = (term: string): void => {
    setSearchTerm(term)
    if (noResultsSku) setNoResultsSku(null)
    if (!term.trim()) {
      setShowSearchDropdown(false)
      setSearchResults([])
    }
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
    if (!searchTerm.trim() || typeof api?.searchInventoryProducts !== 'function') return
    void api.searchInventoryProducts(searchTerm).then(setSearchResults)
  }, [searchTerm, api])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="inventory-modal"
        aria-label="Inventory Management"
        onInteractOutside={(e) => e.preventDefault()}
      >
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
                : activeTab === 'departments'
                  ? 'Departments'
                  : activeTab === 'tax-codes'
                    ? 'Tax Codes'
                    : activeTab === 'vendors'
                      ? 'Vendors'
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
                  { value: INVENTORY_TABS[1], label: 'Departments' },
                  { value: INVENTORY_TABS[2], label: 'Tax Codes' },
                  { value: INVENTORY_TABS[3], label: 'Vendors' }
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger key={value} value={value} className="inventory-modal__tab-trigger">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
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
            value="departments"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <DepartmentPanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent
            value="tax-codes"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <TaxCodePanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent
            value="vendors"
            className="inventory-modal__tab-content inventory-modal__tab-content--panel"
          >
            <VendorPanel searchFilter={searchTerm} />
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
