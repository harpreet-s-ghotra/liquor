import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { InventorySelect } from '@renderer/components/common/InventoryInput'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { useSearchDropdown } from '@renderer/hooks/useSearchDropdown'
import { cn } from '@renderer/lib/utils'
import { formatCurrency } from '@renderer/utils/currency'
import type {
  DistributorFilter,
  InventoryProduct,
  ReorderDistributorRow,
  ReorderProduct
} from '@renderer/types/pos'
import './reorder-dashboard.css'

const THRESHOLD_OPTIONS = [5, 10, 20, 50, 100]
const WINDOW_OPTIONS = [7, 14, 30, 60, 90]
const DRAFT_KEY = 'reorder-dashboard-draft'

type ReorderDraft = {
  distributor: DistributorFilter | null
  unitThreshold: number
  windowDays: number
  manuallyAdded: ReorderProduct[]
  selectedIds: number[]
}

function loadDraft(): Partial<ReorderDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<ReorderDraft>) : {}
  } catch {
    return {}
  }
}

function saveDraft(draft: ReorderDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // ignore storage quota errors
  }
}

type ReorderDashboardProps = {
  onCreateOrder?: (
    items: ReorderProduct[],
    distributor: DistributorFilter | null,
    unitThreshold: number
  ) => void
}

function getDistributorLabel(row: ReorderDistributorRow): string {
  return row.distributor_name ?? 'Unassigned'
}

function formatDays(days: number | null): string {
  return days == null ? '--' : days.toFixed(1)
}

function formatProjectedStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function inventoryProductToReorderProduct(product: InventoryProduct): ReorderProduct {
  return {
    id: product.item_number,
    sku: product.sku,
    name: product.item_name,
    item_type: product.item_type,
    in_stock: product.in_stock,
    reorder_point: 0,
    distributor_number: product.distributor_number,
    distributor_name: product.distributor_name,
    cost: product.cost,
    bottles_per_case: product.bottles_per_case,
    price: product.retail_price,
    velocity_per_day: 0,
    days_of_supply: null,
    projected_stock: product.in_stock
  }
}

export function ReorderDashboard({ onCreateOrder }: ReorderDashboardProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const draft = useMemo(() => loadDraft(), [])

  const [distributors, setDistributors] = useState<ReorderDistributorRow[]>([])
  const [distributor, setDistributor] = useState<DistributorFilter | null>(
    draft.distributor ?? null
  )
  const [unitThreshold, setUnitThreshold] = useState(draft.unitThreshold ?? 10)
  const [windowDays, setWindowDays] = useState(draft.windowDays ?? 30)
  const [products, setProducts] = useState<ReorderProduct[]>([])
  const [manuallyAdded, setManuallyAdded] = useState<ReorderProduct[]>(draft.manuallyAdded ?? [])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(draft.selectedIds ?? []))
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [velocityOffline, setVelocityOffline] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<InventoryProduct[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const hasDraftDistributor = draft.distributor != null
  const [lastLoadedDistributor, setLastLoadedDistributor] = useState<DistributorFilter | null>(null)

  // Load distributors
  useEffect(() => {
    if (!api) return
    let active = true
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const rows = await api.getReorderDistributors()
        if (!active) return
        const sorted = [...rows].sort((a, b) => {
          if (a.distributor_number == null && b.distributor_number != null) return 1
          if (a.distributor_number != null && b.distributor_number == null) return -1
          return getDistributorLabel(a).localeCompare(getDistributorLabel(b))
        })
        setDistributors(sorted)
        if (!hasDraftDistributor && sorted[0]) {
          setDistributor(
            sorted[0].distributor_number == null ? 'unassigned' : sorted[0].distributor_number
          )
        } else if (!sorted[0]) {
          setLoading(false)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load reorder distributors')
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [api, hasDraftDistributor])

  // Load products
  useEffect(() => {
    if (!api || distributor == null) return
    let active = true
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await api.getReorderProducts({
          distributor,
          unit_threshold: unitThreshold,
          window_days: windowDays
        })
        if (!active) return
        setProducts(result.rows)
        setVelocityOffline(result.velocityOffline)
        setLastLoadedDistributor(distributor)
      } catch (err) {
        if (!active) return
        setProducts([])
        setVelocityOffline(true)
        setError(err instanceof Error ? err.message : 'Failed to load reorder products')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [api, distributor, unitThreshold, windowDays])

  // Persist draft on any state change
  useEffect(() => {
    saveDraft({
      distributor,
      unitThreshold,
      windowDays,
      manuallyAdded,
      selectedIds: [...selectedIds]
    })
  }, [distributor, unitThreshold, windowDays, manuallyAdded, selectedIds])

  // Search inventory products
  useEffect(() => {
    if (!api || debouncedSearch.trim().length < 2) {
      setSearchResults([])
      return
    }
    let active = true
    setSearchLoading(true)
    void (async () => {
      try {
        const results = await api.searchInventoryProducts(debouncedSearch)
        if (!active) return
        const distributorMatches = results.filter((result) => {
          if (distributor === 'unassigned') return result.distributor_number == null
          if (typeof distributor === 'number') return result.distributor_number === distributor
          return true
        })
        const existingIds = new Set([
          ...products.map((p) => p.id),
          ...manuallyAdded.map((p) => p.id)
        ])
        const filtered = distributorMatches
          .filter((result) => !existingIds.has(result.item_number))
          .slice(0, 8)
        setSearchResults(filtered)
        setSearchOpen(filtered.length > 0)
      } catch {
        if (!active) return
        setSearchResults([])
      } finally {
        if (active) setSearchLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [api, debouncedSearch, distributor, products, manuallyAdded])

  useEffect(() => {
    if (lastLoadedDistributor == null || distributor === lastLoadedDistributor) return

    setManuallyAdded((prev) =>
      prev.filter((product) => {
        if (distributor === 'unassigned') return product.distributor_number == null
        return product.distributor_number === distributor
      })
    )
    setSelectedIds(new Set())
    setExpandedIds(new Set())
  }, [distributor, lastLoadedDistributor])

  // Close search dropdown on outside click
  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const allProducts = useMemo(() => {
    const existingIds = new Set(products.map((p) => p.id))
    const uniqueManual = manuallyAdded.filter((p) => !existingIds.has(p.id))
    return [...products, ...uniqueManual]
  }, [products, manuallyAdded])

  const summary = useMemo(() => {
    const outOfStock = allProducts.filter((p) => p.projected_stock <= 0).length
    const belowReorder = allProducts.filter(
      (p) => p.projected_stock > 0 && p.projected_stock < p.reorder_point
    ).length
    return { outOfStock, belowReorder, total: allProducts.length }
  }, [allProducts])

  const getStatusClass = useCallback(
    (product: ReorderProduct): string => {
      if (product.projected_stock <= 0) return 'reorder-dashboard__row--out'
      if (product.projected_stock < product.reorder_point)
        return 'reorder-dashboard__row--below-reorder'
      if (product.projected_stock < unitThreshold) return 'reorder-dashboard__row--below-threshold'
      return ''
    },
    [unitThreshold]
  )

  const getStatusBadge = useCallback(
    (product: ReorderProduct): { label: string; mod: string } => {
      if (product.projected_stock <= 0) return { label: 'Out', mod: 'danger' }
      if (product.projected_stock < product.reorder_point) return { label: 'Low', mod: 'warning' }
      if (product.projected_stock < unitThreshold) return { label: 'Below min', mod: 'caution' }
      return { label: 'OK', mod: 'ok' }
    },
    [unitThreshold]
  )

  const toggleExpanded = useCallback((id: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelected = useCallback((id: number): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAddFromSearch = useCallback((inventoryProduct: InventoryProduct): void => {
    const reorderProduct = inventoryProductToReorderProduct(inventoryProduct)
    setManuallyAdded((prev) => {
      if (prev.some((p) => p.id === reorderProduct.id)) return prev
      return [...prev, reorderProduct]
    })
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
  }, [])

  const handleRemoveManual = useCallback((id: number): void => {
    setManuallyAdded((prev) => prev.filter((p) => p.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const handleCreateOrder = useCallback((): void => {
    if (!onCreateOrder) return
    const items =
      selectedIds.size > 0 ? allProducts.filter((p) => selectedIds.has(p.id)) : allProducts
    onCreateOrder(items, distributor, unitThreshold)
  }, [onCreateOrder, allProducts, selectedIds, distributor, unitThreshold])

  const manuallyAddedIds = useMemo(() => new Set(manuallyAdded.map((p) => p.id)), [manuallyAdded])
  const searchDropdown = useSearchDropdown({
    results: searchResults,
    isOpen: searchOpen,
    onSelect: handleAddFromSearch,
    onOpenChange: setSearchOpen
  })
  const searchInputProps = searchDropdown.getInputProps()

  return (
    <div className="reorder-dashboard">
      {/* Controls */}
      <div className="reorder-dashboard__controls">
        <div className="reorder-dashboard__control-group">
          <label className="reorder-dashboard__label" htmlFor="reorder-distributor-select">
            Distributor
          </label>
          <InventorySelect
            id="reorder-distributor-select"
            aria-label="Distributor"
            value={distributor == null ? '' : String(distributor)}
            onChange={(event) => {
              const value = event.target.value
              setDistributor(value === 'unassigned' ? 'unassigned' : Number.parseInt(value, 10))
            }}
          >
            {distributors.map((row) => {
              const value =
                row.distributor_number == null ? 'unassigned' : String(row.distributor_number)
              return (
                <option key={value} value={value}>
                  {getDistributorLabel(row)}
                </option>
              )
            })}
          </InventorySelect>
        </div>

        <div className="reorder-dashboard__control-group">
          <label className="reorder-dashboard__label" htmlFor="reorder-threshold-select">
            Min Units
          </label>
          <InventorySelect
            id="reorder-threshold-select"
            aria-label="Unit Threshold"
            value={String(unitThreshold)}
            onChange={(event) => setUnitThreshold(Number.parseInt(event.target.value, 10))}
          >
            {THRESHOLD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} units
              </option>
            ))}
          </InventorySelect>
        </div>

        <div className="reorder-dashboard__control-group">
          <label className="reorder-dashboard__label" htmlFor="reorder-window-select">
            Window
          </label>
          <InventorySelect
            id="reorder-window-select"
            aria-label="Time Window"
            value={String(windowDays)}
            onChange={(event) => setWindowDays(Number.parseInt(event.target.value, 10))}
          >
            {WINDOW_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} days
              </option>
            ))}
          </InventorySelect>
        </div>

        {onCreateOrder && allProducts.length > 0 ? (
          <AppButton
            className="reorder-dashboard__create-button"
            size="sm"
            onClick={handleCreateOrder}
            disabled={distributor === 'unassigned'}
          >
            {selectedIds.size > 0 ? `Create Order (${selectedIds.size})` : 'Create Order'}
          </AppButton>
        ) : null}
      </div>

      {/* Summary cards */}
      <div className="reorder-dashboard__summary">
        <div className="reorder-dashboard__summary-card">
          <span
            className={cn(
              'reorder-dashboard__summary-count',
              summary.outOfStock > 0 && 'reorder-dashboard__summary-count--danger'
            )}
          >
            {summary.outOfStock}
          </span>
          <span className="reorder-dashboard__summary-label">Will run out in {windowDays}d</span>
        </div>
        <div className="reorder-dashboard__summary-card">
          <span
            className={cn(
              'reorder-dashboard__summary-count',
              summary.belowReorder > 0 && 'reorder-dashboard__summary-count--warning'
            )}
          >
            {summary.belowReorder}
          </span>
          <span className="reorder-dashboard__summary-label">
            Below reorder point in {windowDays}d
          </span>
        </div>
        <div className="reorder-dashboard__summary-card">
          <span className="reorder-dashboard__summary-count">{summary.total}</span>
          <span className="reorder-dashboard__summary-label">Total flagged</span>
        </div>
      </div>

      {velocityOffline ? (
        <p className="reorder-dashboard__empty">Velocity offline — using cached data.</p>
      ) : null}

      {/* Accordion list */}
      <div className="reorder-dashboard__list-wrap">
        {loading ? (
          <div className="reorder-dashboard__loading">Loading...</div>
        ) : error ? (
          <p className="reorder-dashboard__msg--error">{error}</p>
        ) : distributor == null ? (
          <p className="reorder-dashboard__empty">No reorderable distributors found.</p>
        ) : allProducts.length === 0 ? (
          <p className="reorder-dashboard__empty">
            No products are projected below the selected threshold in this window.
          </p>
        ) : (
          <>
            <div className="reorder-dashboard__col-headers" aria-hidden>
              <span />
              <span />
              <span>Product</span>
              <span>In Stock</span>
              <span>Days Supply</span>
              <span>Est. at {windowDays}d</span>
              <span />
            </div>
            <div className="reorder-dashboard__rows">
              {allProducts.map((product) => {
                const isExpanded = expandedIds.has(product.id)
                const isSelected = selectedIds.has(product.id)
                const isManual = manuallyAddedIds.has(product.id)
                const badge = getStatusBadge(product)
                const projectedSold = (product.velocity_per_day * windowDays).toFixed(1)
                return (
                  <div
                    key={product.id}
                    className={cn(
                      'reorder-dashboard__row',
                      getStatusClass(product),
                      isExpanded && 'reorder-dashboard__row--expanded',
                      isManual && 'reorder-dashboard__row--manual'
                    )}
                  >
                    {/* Collapsed header */}
                    <div
                      className="reorder-dashboard__row-head"
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpanded(product.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleExpanded(product.id)
                        }
                      }}
                    >
                      <span
                        className={cn(
                          'reorder-dashboard__expand-icon',
                          isExpanded && 'reorder-dashboard__expand-icon--open'
                        )}
                        aria-hidden
                      >
                        ▶
                      </span>
                      <input
                        type="checkbox"
                        className="reorder-dashboard__checkbox"
                        checked={isSelected}
                        aria-label={`Select ${product.name}`}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelected(product.id)}
                      />
                      <div className="reorder-dashboard__name-cell">
                        <span className="reorder-dashboard__name" title={product.name}>
                          {product.name}
                        </span>
                        <span className="reorder-dashboard__sku">{product.sku}</span>
                      </div>
                      <span className="reorder-dashboard__cell">{product.in_stock}</span>
                      <span className="reorder-dashboard__cell">
                        {formatDays(product.days_of_supply)}
                      </span>
                      <span
                        className={cn(
                          'reorder-dashboard__cell',
                          product.projected_stock <= 0 && 'reorder-dashboard__cell--danger',
                          product.projected_stock > 0 &&
                            product.projected_stock < product.reorder_point &&
                            'reorder-dashboard__cell--warning'
                        )}
                      >
                        {formatProjectedStock(product.projected_stock)}
                      </span>
                      <span
                        className={cn(
                          'reorder-dashboard__badge',
                          `reorder-dashboard__badge--${isManual ? 'manual' : badge.mod}`
                        )}
                      >
                        {isManual ? 'Manual' : badge.label}
                      </span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded ? (
                      <div className="reorder-dashboard__row-body">
                        <div className="reorder-dashboard__detail-grid">
                          <div className="reorder-dashboard__detail-item">
                            <span className="reorder-dashboard__detail-label">Category</span>
                            <span className="reorder-dashboard__detail-value">
                              {product.item_type ?? '--'}
                            </span>
                          </div>
                          <div className="reorder-dashboard__detail-item">
                            <span className="reorder-dashboard__detail-label">Velocity/day</span>
                            <span className="reorder-dashboard__detail-value">
                              {product.velocity_per_day > 0
                                ? product.velocity_per_day.toFixed(2)
                                : '--'}
                            </span>
                          </div>
                          <div className="reorder-dashboard__detail-item">
                            <span className="reorder-dashboard__detail-label">Reorder Point</span>
                            <span className="reorder-dashboard__detail-value">
                              {product.reorder_point > 0 ? `${product.reorder_point} units` : '--'}
                            </span>
                          </div>
                          <div className="reorder-dashboard__detail-item">
                            <span className="reorder-dashboard__detail-label">Price</span>
                            <span className="reorder-dashboard__detail-value">
                              {formatCurrency(product.price)}
                            </span>
                          </div>
                        </div>
                        <p className="reorder-dashboard__projection-note">
                          {product.velocity_per_day > 0
                            ? `At ${product.velocity_per_day.toFixed(2)}/day \u00d7 ${windowDays} days \u2248 ${projectedSold} units sold. Est. remaining: ${formatProjectedStock(product.projected_stock)} units${product.projected_stock < 0 ? ' \u2014 will run out before window ends' : ''}.`
                            : `No sales recorded in the last 365 days. Current stock: ${product.in_stock} units.`}
                        </p>
                        {isManual ? (
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveManual(product.id)
                            }}
                          >
                            Remove from list
                          </AppButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Search bar — add items not in the current filtered list */}
      <div className="reorder-dashboard__search-bar" ref={searchRef}>
        <input
          type="text"
          className="reorder-dashboard__search-input"
          placeholder="Search by SKU or name to add an item to this list\u2026"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            if (e.target.value.trim().length >= 2) setSearchOpen(true)
          }}
          onKeyDown={searchDropdown.handleKeyDown}
          onFocus={() => {
            if (searchResults.length > 0) setSearchOpen(true)
          }}
          role={searchInputProps.role}
          aria-expanded={searchInputProps['aria-expanded']}
          aria-controls={searchInputProps['aria-controls']}
          aria-autocomplete={searchInputProps['aria-autocomplete']}
          aria-activedescendant={searchInputProps['aria-activedescendant']}
          aria-label="Search reorder items"
        />
        {searchOpen && (searchLoading || searchResults.length > 0) ? (
          <div
            id={searchDropdown.listboxId}
            role="listbox"
            className="reorder-dashboard__search-results"
          >
            {searchLoading ? (
              <div className="reorder-dashboard__search-loading">Searching...</div>
            ) : (
              searchResults.map((result, index) => {
                const optionProps = searchDropdown.getOptionProps(index)
                return (
                  <div
                    key={result.item_number}
                    {...optionProps}
                    className={cn(
                      'reorder-dashboard__search-result',
                      optionProps['aria-selected'] && 'search-dropdown__option--highlighted'
                    )}
                  >
                    <span
                      className="reorder-dashboard__search-result-name"
                      title={result.item_name}
                    >
                      {result.item_name}
                    </span>
                    <span className="reorder-dashboard__search-result-meta">
                      {result.sku} &middot; {result.item_type ?? 'No category'} &middot;{' '}
                      {result.in_stock} in stock
                    </span>
                  </div>
                )
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
