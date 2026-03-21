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

type InventoryModalProps = {
  isOpen: boolean
  onClose: () => void
  openItemNumber?: number
}

export function InventoryModal({
  isOpen,
  onClose,
  openItemNumber
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
      setActiveTab('items')
      setSearchTerm('')
      setNoResultsSku(null)
      if (openItemNumber != null) {
        requestAnimationFrame(() => {
          void itemFormRef.current?.selectItem({ item_number: openItemNumber } as InventoryProduct)
        })
      } else {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
        })
      }
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
        className="w-[min(1152px,100%)] h-[min(96vh,920px)] flex flex-col p-0 overflow-hidden rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-default)] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
        aria-label="Inventory Management"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 bg-[#2d3133] shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#004b0f] flex items-center justify-center shrink-0">
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
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-[14px] uppercase tracking-[2px] text-[#94a3b8] shrink-0 font-bold">
              Inventory Maintenance
            </span>
            <span className="text-[#475569] shrink-0 text-[13px]">/</span>
            <span className="text-[14px] font-bold text-[#e8ecf0] truncate">
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
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-lg bg-[rgba(255,255,255,0.08)] text-[#94a3b8] text-[13px] font-bold cursor-pointer border border-[rgba(255,255,255,0.12)] outline-none hover:bg-[rgba(255,255,255,0.14)]"
          >
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
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Outer tab bar */}
          <div className="bg-[#2d3133] shrink-0 px-2">
            <TabsList className="gap-0 bg-transparent border-b border-[rgba(194,199,202,0.15)] rounded-none p-0 h-auto justify-start w-full">
              {(
                [
                  { value: INVENTORY_TABS[0], label: 'Items' },
                  { value: INVENTORY_TABS[1], label: 'Departments' },
                  { value: INVENTORY_TABS[2], label: 'Tax Codes' },
                  { value: INVENTORY_TABS[3], label: 'Vendors' }
                ] as const
              ).map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-none border-b-[3px] border-transparent min-h-[48px] px-6 py-3 text-[13px] font-black uppercase tracking-[1px] text-[#6b7280] bg-transparent data-[state=active]:border-[#a3f69c] data-[state=active]:text-[#e8ecf0] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Content */}
          <TabsContent value="items" className="flex-1 min-h-0 overflow-hidden m-0">
            <ItemForm
              ref={itemFormRef}
              onButtonStateChange={handleItemButtonState}
              onSaveComplete={handleSaveComplete}
            />
          </TabsContent>
          <TabsContent value="departments" className="flex-1 overflow-auto m-0 p-4">
            <DepartmentPanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent value="tax-codes" className="flex-1 overflow-auto m-0 p-4">
            <TaxCodePanel searchFilter={searchTerm} />
          </TabsContent>
          <TabsContent value="vendors" className="flex-1 overflow-auto m-0 p-4">
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
          canNew={itemBtnState.canNew}
          canSave={itemBtnState.canSave}
          canDelete={itemBtnState.canDelete}
          onNew={() => itemFormRef.current?.handleNewItem()}
          onSave={() => itemFormRef.current?.handleSave()}
          onDelete={() => itemFormRef.current?.handleDelete()}
          onDiscard={() => itemFormRef.current?.handleDiscard()}
        />
      </DialogContent>
    </Dialog>
  )
}
