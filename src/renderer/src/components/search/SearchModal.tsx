import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { SearchIcon } from '@renderer/components/common/modal-icons'
import type { Product, ItemType, Distributor } from '@renderer/types/pos'
import './search-modal.css'

type SearchModalProps = {
  isOpen: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  onOpenInInventory?: (product: Product) => void
}

export function SearchModal({
  isOpen,
  onClose,
  onAddToCart,
  onOpenInInventory
}: SearchModalProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [itemTypes, setItemTypes] = useState<ItemType[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [itemTypeId, setItemTypeId] = useState<number | undefined>(undefined)
  const [distributorNumber, setDistributorNumber] = useState<number | undefined>(undefined)
  const [size, setSize] = useState<string | undefined>(undefined)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastFiltersRef = useRef({
    itemTypeId: undefined as number | undefined,
    distributorNumber: undefined as number | undefined,
    size: undefined as string | undefined
  })

  // Load filter options on mount
  useEffect(() => {
    if (!isOpen) return
    const api = window.api
    if (!api) return
    let active = true
    const getItemTypes =
      typeof api.getItemTypes === 'function'
        ? api.getItemTypes
        : typeof api.getDepartments === 'function'
          ? api.getDepartments
          : null

    if (getItemTypes) {
      getItemTypes()
        .then((data) => {
          if (active) setItemTypes(data)
        })
        .catch(() => {})
    }
    if (typeof api.getDistributors === 'function') {
      api
        .getDistributors()
        .then((data) => {
          if (active) setDistributors(data)
        })
        .catch(() => {})
    }
    if (typeof api.getDistinctSizes === 'function') {
      api
        .getDistinctSizes()
        .then((data) => {
          if (active) setSizes(data)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [isOpen])

  // Focus input when modal opens
  useEffect(() => {
    if (!isOpen) return
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 50)
    return () => clearTimeout(timeout)
  }, [isOpen])

  // Auto-run empty search on open to show all products
  useEffect(() => {
    if (!isOpen) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery('')
    setItemTypeId(undefined)
    setDistributorNumber(undefined)
    setSize(undefined)
    /* eslint-enable react-hooks/set-state-in-effect */
    lastFiltersRef.current = {
      itemTypeId: undefined,
      distributorNumber: undefined,
      size: undefined
    }
    const api = window.api
    if (!api?.searchProducts) return
    let active = true
    api
      .searchProducts('', {})
      .then((data) => {
        if (!active) return
        setResults(data)
        setSelectedProduct(null)
        setHasSearched(true)
      })
      .catch(() => {
        if (!active) return
        setResults([])
        setHasSearched(true)
      })
    return () => {
      active = false
    }
  }, [isOpen])

  const runSearch = useCallback(
    async (
      searchQuery: string,
      filters?: { itemTypeId?: number; distributorNumber?: number; size?: string }
    ) => {
      const trimmed = searchQuery.trim()
      const f = filters ?? { itemTypeId, distributorNumber, size }
      const api = window.api
      if (!api?.searchProducts) return
      try {
        const data = await api.searchProducts(trimmed, {
          departmentId: f.itemTypeId,
          distributorNumber: f.distributorNumber,
          size: f.size
        })
        setResults(data)
        setSelectedProduct(null)
        setHasSearched(true)
      } catch {
        setResults([])
        setHasSearched(true)
      }
    },
    [itemTypeId, distributorNumber, size]
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      runSearch(query)
    },
    [query, runSearch]
  )

  const handleItemTypeChange = useCallback(
    (value: number | undefined) => {
      setItemTypeId(value)
      lastFiltersRef.current.itemTypeId = value
      if (hasSearched) {
        runSearch(query, {
          itemTypeId: value,
          distributorNumber: lastFiltersRef.current.distributorNumber,
          size: lastFiltersRef.current.size
        })
      }
    },
    [hasSearched, query, runSearch]
  )

  const handleDistributorChange = useCallback(
    (value: number | undefined) => {
      setDistributorNumber(value)
      lastFiltersRef.current.distributorNumber = value
      if (hasSearched) {
        runSearch(query, {
          itemTypeId: lastFiltersRef.current.itemTypeId,
          distributorNumber: value,
          size: lastFiltersRef.current.size
        })
      }
    },
    [hasSearched, query, runSearch]
  )

  const handleSizeChange = useCallback(
    (value: string | undefined) => {
      setSize(value)
      lastFiltersRef.current.size = value
      if (hasSearched) {
        runSearch(query, {
          itemTypeId: lastFiltersRef.current.itemTypeId,
          distributorNumber: lastFiltersRef.current.distributorNumber,
          size: value
        })
      }
    },
    [hasSearched, query, runSearch]
  )

  const handleRowClick = useCallback((product: Product) => {
    setSelectedProduct((prev) => (prev?.id === product.id ? null : product))
  }, [])

  const handleAddToCart = useCallback(() => {
    if (selectedProduct) {
      onAddToCart(selectedProduct)
      onClose()
    }
  }, [selectedProduct, onAddToCart, onClose])

  const handleOpenInInventory = useCallback(() => {
    if (selectedProduct && onOpenInInventory) {
      onOpenInInventory(selectedProduct)
      onClose()
    }
  }, [selectedProduct, onOpenInInventory, onClose])

  const formatMoney = (amount: number): string =>
    amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${amount.toFixed(2)}`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="search-modal"
        aria-label="Product Search"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Search</DialogTitle>
        <AppModalHeader
          icon={<SearchIcon />}
          label="POS"
          title="Product Search"
          onClose={onClose}
        />

        {/* Filters */}
        <div className="search-modal__filters">
          <select
            value={itemTypeId ?? ''}
            onChange={(e) =>
              handleItemTypeChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="search-modal__filter-select"
            aria-label="Filter by item type"
          >
            <option value="">All Item Types</option>
            {itemTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={distributorNumber ?? ''}
            onChange={(e) =>
              handleDistributorChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="search-modal__filter-select"
            aria-label="Filter by distributor"
          >
            <option value="">All Distributors</option>
            {distributors.map((d) => (
              <option key={d.distributor_number} value={d.distributor_number}>
                {d.distributor_name}
              </option>
            ))}
          </select>

          <select
            value={size ?? ''}
            onChange={(e) => handleSizeChange(e.target.value ? e.target.value : undefined)}
            className="search-modal__filter-select"
            aria-label="Filter by size"
          >
            <option value="">All Sizes</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Results table */}
        <div className="search-modal__results" style={{ gridTemplateRows: '2.25rem 1fr' }}>
          <div
            className="search-modal__results-header"
            style={{ gridTemplateColumns: '1fr 5rem minmax(0, 13rem) 5rem 7rem' }}
          >
            <span>Name</span>
            <span>Size</span>
            <span>Distributor</span>
            <span>Qty</span>
            <span>Price</span>
          </div>

          <div className="search-modal__results-body" data-testid="search-results">
            {!hasSearched ? (
              <div className="search-modal__result-empty">
                Type a search term or pick a filter, then press Go.
              </div>
            ) : results.length === 0 ? (
              <div className="search-modal__result-empty">
                No items found. Try a different search.
              </div>
            ) : (
              results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    'search-modal__result-row',
                    selectedProduct?.id === product.id && 'search-modal__result-row--selected'
                  )}
                  style={{ gridTemplateColumns: '1fr 5rem minmax(0, 13rem) 5rem 7rem' }}
                  onClick={() => handleRowClick(product)}
                  data-testid={`search-result-${product.id}`}
                >
                  <span className="search-modal__result-name">{product.name}</span>
                  <span className="search-modal__result-size">{product.size ?? '—'}</span>
                  <span
                    className="search-modal__result-distributor"
                    title={product.distributor_name ?? undefined}
                  >
                    {product.distributor_name ?? '—'}
                  </span>
                  <span className="search-modal__result-qty">{product.quantity}</span>
                  <span className="search-modal__result-price">{formatMoney(product.price)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Action buttons for selected item */}
        {selectedProduct && (
          <div className="search-modal__actions">
            <Button
              size="md"
              variant="success"
              className="search-modal__action-btn"
              onClick={handleAddToCart}
            >
              Add to Cart
            </Button>
            {onOpenInInventory && (
              <Button
                size="md"
                className="search-modal__action-btn"
                onClick={handleOpenInInventory}
              >
                Open in Inventory
              </Button>
            )}
          </div>
        )}

        {/* Search bar at bottom */}
        <form
          className="search-modal__search-form"
          style={{ gridTemplateColumns: '1fr auto' }}
          onSubmit={handleSubmit}
        >
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="search-modal__search-input"
          />
          <Button type="submit" size="lg" className="search-modal__go-btn">
            Go
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
