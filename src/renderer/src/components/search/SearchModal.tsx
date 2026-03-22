import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { Product, Department, Vendor } from '@renderer/types/pos'
import './search-modal.css'

type SearchModalProps = {
  isOpen: boolean
  onClose: () => void
  onAddToCart: (product: Product) => void
  onOpenInInventory: (product: Product) => void
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
  const [departments, setDepartments] = useState<Department[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined)
  const [vendorNumber, setVendorNumber] = useState<number | undefined>(undefined)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastFiltersRef = useRef({
    departmentId: undefined as number | undefined,
    vendorNumber: undefined as number | undefined
  })

  // Load filter options on mount
  useEffect(() => {
    const api = window.api
    if (!api) return
    api
      .getDepartments()
      .then(setDepartments)
      .catch(() => {})
    api
      .getVendors()
      .then(setVendors)
      .catch(() => {})
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const runSearch = useCallback(
    async (searchQuery: string, filters?: { departmentId?: number; vendorNumber?: number }) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) {
        setResults([])
        setHasSearched(false)
        return
      }
      const api = window.api
      if (!api?.searchProducts) return
      const f = filters ?? { departmentId, vendorNumber }
      try {
        const data = await api.searchProducts(trimmed, f)
        setResults(data)
        setSelectedProduct(null)
        setHasSearched(true)
      } catch {
        setResults([])
        setHasSearched(true)
      }
    },
    [departmentId, vendorNumber]
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      runSearch(query)
    },
    [query, runSearch]
  )

  const handleDepartmentChange = useCallback(
    (value: number | undefined) => {
      setDepartmentId(value)
      lastFiltersRef.current.departmentId = value
      if (hasSearched && query.trim()) {
        runSearch(query, { departmentId: value, vendorNumber: lastFiltersRef.current.vendorNumber })
      }
    },
    [hasSearched, query, runSearch]
  )

  const handleVendorChange = useCallback(
    (value: number | undefined) => {
      setVendorNumber(value)
      lastFiltersRef.current.vendorNumber = value
      if (hasSearched && query.trim()) {
        runSearch(query, { departmentId: lastFiltersRef.current.departmentId, vendorNumber: value })
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
    if (selectedProduct) {
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
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle>Product Search</DialogTitle>
          <Button size="md" variant="danger" onClick={onClose}>
            Close
          </Button>
        </DialogHeader>

        {/* Filters */}
        <div className="search-modal__filters">
          <select
            value={departmentId ?? ''}
            onChange={(e) =>
              handleDepartmentChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="search-modal__filter-select"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={vendorNumber ?? ''}
            onChange={(e) =>
              handleVendorChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="search-modal__filter-select"
            aria-label="Filter by vendor"
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.vendor_number} value={v.vendor_number}>
                {v.vendor_name}
              </option>
            ))}
          </select>
        </div>

        {/* Results table */}
        <div className="search-modal__results" style={{ gridTemplateRows: '2.25rem 1fr' }}>
          <div
            className="search-modal__results-header"
            style={{ gridTemplateColumns: '1fr 6rem 7rem' }}
          >
            <span>Name</span>
            <span>Qty</span>
            <span>Price</span>
          </div>

          <div className="search-modal__results-body" data-testid="search-results">
            {!hasSearched ? (
              <div className="search-modal__result-empty">
                Type a search term to find items.
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
                  style={{ gridTemplateColumns: '1fr 6rem 7rem' }}
                  onClick={() => handleRowClick(product)}
                  data-testid={`search-result-${product.id}`}
                >
                  <span className="search-modal__result-name">{product.name}</span>
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
            <Button
              size="md"
              className="search-modal__action-btn"
              onClick={handleOpenInInventory}
            >
              Open in Inventory
            </Button>
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
          <Button type="submit" size="md">
            Go
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
