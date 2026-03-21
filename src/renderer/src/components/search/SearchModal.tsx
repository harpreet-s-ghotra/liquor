import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import type { Product, Department, Vendor } from '@renderer/types/pos'

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
        className="w-[min(60rem,95%)] h-[min(80vh,44rem)] grid gap-3 grid-rows-[auto_auto_1fr_auto_auto] p-3"
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
        <div className="grid grid-cols-2 gap-3">
          <select
            value={departmentId ?? ''}
            onChange={(e) =>
              handleDepartmentChange(e.target.value ? Number(e.target.value) : undefined)
            }
            className="h-10 rounded-(--radius) border border-(--border-default) bg-(--bg-input) px-3 text-base text-(--text-primary)"
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
            className="h-10 rounded-(--radius) border border-(--border-default) bg-(--bg-input) px-3 text-base text-(--text-primary)"
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
        <div
          className="grid overflow-hidden rounded-(--radius) bg-(--bg-surface)"
          style={{ gridTemplateRows: '2.25rem 1fr' }}
        >
          <div
            className="grid items-center gap-x-4 border-b border-(--border-soft) bg-(--bg-surface-soft) px-3 text-base font-bold text-(--text-primary)"
            style={{ gridTemplateColumns: '1fr 6rem 7rem' }}
          >
            <span>Name</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
          </div>

          <div className="overflow-auto" data-testid="search-results">
            {!hasSearched ? (
              <div className="p-4 text-base text-(--text-muted)">
                Type a search term to find items.
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-base text-(--text-muted)">
                No items found. Try a different search.
              </div>
            ) : (
              results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={`w-full grid items-center gap-x-4 border-b border-(--border-soft) bg-(--bg-surface) min-h-11 px-3 text-base text-(--text-primary) cursor-pointer text-left hover:bg-(--bg-surface-soft) ${
                    selectedProduct?.id === product.id ? 'bg-(--accent-blue-soft)' : ''
                  }`}
                  style={{ gridTemplateColumns: '1fr 6rem 7rem' }}
                  onClick={() => handleRowClick(product)}
                  data-testid={`search-result-${product.id}`}
                >
                  <span className="font-medium truncate">{product.name}</span>
                  <span className="text-right">{product.quantity}</span>
                  <span className="text-right font-medium">{formatMoney(product.price)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Action buttons for selected item */}
        {selectedProduct && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="md"
              variant="success"
              className="min-h-[3rem] text-base font-bold"
              onClick={handleAddToCart}
            >
              Add to Cart
            </Button>
            <Button
              size="md"
              className="min-h-[3rem] text-base font-bold"
              onClick={handleOpenInInventory}
            >
              Open in Inventory
            </Button>
          </div>
        )}

        {/* Search bar at bottom */}
        <form
          className="grid gap-2"
          style={{ gridTemplateColumns: '1fr auto' }}
          onSubmit={handleSubmit}
        >
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="text-lg"
          />
          <Button type="submit" size="md">
            Go
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
