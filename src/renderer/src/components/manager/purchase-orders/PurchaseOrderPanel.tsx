import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { AppButton } from '@renderer/components/common/AppButton'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { formatCurrency } from '@renderer/utils/currency'
import { useDebounce } from '@renderer/hooks/useDebounce'
import type {
  Distributor,
  Product,
  PurchaseOrder,
  PurchaseOrderDetail,
  ReorderProduct
} from '../../../../../shared/types'
import './purchase-order-panel.css'

type View = 'list' | 'create' | 'detail'

type CreateItemRow = {
  product_id: number
  sku: string
  name: string
  size: string | null
  unit_cost: number
  quantity_cases: number
  bottles_per_case: number
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function normalizeNonNegativeNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

type PurchaseOrderPanelProps = {
  prefillItems: ReorderProduct[] | null
  prefillDistributor: number | null
  prefillUnitThreshold?: number
  onPrefillConsumed: () => void
}

export function PurchaseOrderPanel({
  prefillItems,
  prefillDistributor,
  prefillUnitThreshold = 10,
  onPrefillConsumed
}: PurchaseOrderPanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [view, setView] = useState<View>('list')
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [activeDetail, setActiveDetail] = useState<PurchaseOrderDetail | null>(null)

  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<number | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [createItems, setCreateItems] = useState<CreateItemRow[]>([])

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)

  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [itemSearchResults, setItemSearchResults] = useState<Product[]>([])
  const [itemSearchOpen, setItemSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(itemSearchQuery, 300)

  const loadOrders = useCallback(async () => {
    if (!api) return
    try {
      setLoading(true)
      setError(null)
      const data = await api.getPurchaseOrders()
      setOrders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!prefillItems || prefillItems.length === 0 || !api) return

    void (async () => {
      try {
        const dists = await api.getDistributors()
        setDistributors(dists)

        const items: CreateItemRow[] = prefillItems.map((item) => {
          const bottlesPerCase = normalizePositiveInt(item.bottles_per_case, 12)
          const unitCost = normalizeNonNegativeNumber(item.cost)
          const targetUnits = Math.max(item.reorder_point || 0, prefillUnitThreshold)
          const unitsToOrder = Math.max(1, Math.ceil(targetUnits - item.projected_stock))
          return {
            product_id: item.id,
            sku: item.sku,
            name: item.name,
            size: null,
            unit_cost: unitCost,
            quantity_cases: Math.max(1, Math.ceil(unitsToOrder / bottlesPerCase)),
            bottles_per_case: bottlesPerCase
          }
        })

        const firstItemDistributor = prefillItems.find(
          (item) => item.distributor_number != null
        )?.distributor_number

        setCreateItems(items)
        setCreateNotes('')
        setSelectedDistributor(prefillDistributor ?? firstItemDistributor ?? null)
        setView('create')
        setError(null)
      } catch {
        // ignore prefill load failures
      }
    })()

    onPrefillConsumed()
  }, [prefillItems, prefillDistributor, prefillUnitThreshold, api, onPrefillConsumed])

  const openDetail = useCallback(
    async (poId: number) => {
      if (!api) return
      try {
        const detail = await api.getPurchaseOrderDetail(poId)
        if (detail) {
          setActiveDetail(detail)
          setView('detail')
          setError(null)
          setSuccess(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order')
      }
    },
    [api]
  )

  const startCreate = useCallback(async () => {
    if (!api) return
    try {
      const dists = await api.getDistributors()
      setDistributors(dists)
      setSelectedDistributor(null)
      setCreateNotes('')
      setCreateItems([])
      setView('create')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load distributors')
    }
  }, [api])

  const handleSelectSearchResult = useCallback((product: Product) => {
    setCreateItems((prev) => {
      const already = prev.find((row) => row.product_id === product.id)
      if (already) return prev
      return [
        ...prev,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          size: product.size ?? null,
          unit_cost: 0,
          quantity_cases: 1,
          bottles_per_case: normalizePositiveInt(product.bottles_per_case, 12)
        }
      ]
    })
    setItemSearchQuery('')
    setItemSearchResults([])
    setItemSearchOpen(false)
  }, [])

  useEffect(() => {
    if (!api || !debouncedSearch.trim() || !selectedDistributor) {
      setItemSearchResults([])
      setItemSearchOpen(false)
      return
    }
    void (async () => {
      try {
        const results = await api.searchProducts(debouncedSearch, {
          distributorNumber: selectedDistributor
        })
        setItemSearchResults(results.slice(0, 20))
        setItemSearchOpen(results.length > 0)
      } catch {
        // ignore search errors
      }
    })()
  }, [api, debouncedSearch, selectedDistributor])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setItemSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreateItemCasesChange = useCallback((index: number, value: number) => {
    setCreateItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity_cases: Math.max(1, value) } : item
      )
    )
  }, [])

  const handleCreateItemCostChange = useCallback((index: number, value: number) => {
    setCreateItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, unit_cost: Math.max(0, value) } : item
      )
    )
  }, [])

  const handleRemoveCreateItem = useCallback((index: number) => {
    setCreateItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }, [])

  const submitCreate = useCallback(async () => {
    if (!api || !selectedDistributor) return

    const validItems = createItems
      .filter((item) => item.product_id > 0 && item.quantity_cases > 0)
      .map((item) => ({
        product_id: item.product_id,
        quantity_ordered:
          normalizePositiveInt(item.quantity_cases, 1) *
          normalizePositiveInt(item.bottles_per_case, 12),
        unit_cost: normalizeNonNegativeNumber(item.unit_cost)
      }))

    if (validItems.length === 0) {
      setError('Add at least one item with a valid product')
      return
    }

    try {
      setError(null)
      const detail = await api.createPurchaseOrder({
        distributor_number: selectedDistributor,
        items: validItems,
        notes: createNotes || undefined
      })
      setActiveDetail(detail)
      setView('detail')
      setSuccess(`Purchase order ${detail.po_number} created`)
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order')
    }
  }, [api, selectedDistributor, createItems, createNotes, loadOrders])

  const handleSubmitOrder = useCallback(async () => {
    if (!api || !activeDetail) return
    try {
      setError(null)
      await api.updatePurchaseOrder({ id: activeDetail.id, status: 'submitted' })
      setSuccess('Order submitted')
      void loadOrders()
      void openDetail(activeDetail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order')
    }
  }, [api, activeDetail, loadOrders, openDetail])

  const handleCancelOrder = useCallback(async () => {
    if (!api || !activeDetail) return
    try {
      setError(null)
      await api.updatePurchaseOrder({ id: activeDetail.id, status: 'cancelled' })
      setSuccess('Order cancelled')
      void loadOrders()
      void openDetail(activeDetail.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order')
    }
  }, [api, activeDetail, loadOrders, openDetail])

  const handleReceiveItem = useCallback(
    async (itemId: number, qtyReceived: number) => {
      if (!api || !activeDetail) return
      try {
        setError(null)
        await api.receivePurchaseOrderItem({ id: itemId, quantity_received: qtyReceived })
        void openDetail(activeDetail.id)
        void loadOrders()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to receive item')
      }
    },
    [api, activeDetail, openDetail, loadOrders]
  )

  const confirmDelete = useCallback(async () => {
    if (!api || !deleteTarget) return
    try {
      setError(null)
      await api.deletePurchaseOrder(deleteTarget.id)
      setSuccess(`Order ${deleteTarget.po_number} deleted`)
      setDeleteTarget(null)
      if (view === 'detail') {
        setView('list')
        setActiveDetail(null)
      }
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order')
    }
  }, [api, deleteTarget, view, loadOrders])

  const goBack = useCallback(() => {
    setView('list')
    setActiveDetail(null)
    setError(null)
    setSuccess(null)
  }, [])

  const filteredOrders =
    filterStatus === 'all' ? orders : orders.filter((order) => order.status === filterStatus)
  const distributorLocked = prefillDistributor != null && createItems.length > 0

  if (view === 'list') {
    return (
      <div className="po-panel">
        <div className="po-panel__header">
          <span className="po-panel__header-title">Purchase Orders</span>
          <div className="po-panel__header-spacer" />
          <div className="po-panel__filters">
            <select
              className="po-panel__filter-select"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <AppButton size="sm" onClick={startCreate}>
            New Order
          </AppButton>
        </div>

        {error ? <p className="po-panel__msg--error">{error}</p> : null}
        {success ? <p className="po-panel__msg--success">{success}</p> : null}

        <div className="po-panel__list-wrap">
          {loading ? (
            <div className="po-panel__loading">Loading...</div>
          ) : filteredOrders.length === 0 ? (
            <p className="po-panel__empty">No purchase orders found.</p>
          ) : (
            <table className="po-panel__table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Distributor</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="po-panel__row--clickable"
                    onClick={() => void openDetail(order.id)}
                  >
                    <td style={{ fontFamily: 'monospace' }}>{order.po_number}</td>
                    <td>{order.distributor_name}</td>
                    <td>
                      <span className={cn('po-panel__badge', `po-panel__badge--${order.status}`)}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.item_count}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                      {order.status === 'draft' || order.status === 'cancelled' ? (
                        <AppButton
                          size="sm"
                          variant="danger"
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeleteTarget(order)
                          }}
                        >
                          Delete
                        </AppButton>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <ConfirmDialog
          isOpen={deleteTarget !== null}
          title="Delete Purchase Order"
          message={`Delete ${deleteTarget?.po_number}? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    )
  }

  if (view === 'create') {
    const createTotal = createItems.reduce((sum, item) => {
      const unitCost = normalizeNonNegativeNumber(item.unit_cost)
      const cases = normalizePositiveInt(item.quantity_cases, 1)
      const bottlesPerCase = normalizePositiveInt(item.bottles_per_case, 12)
      return sum + unitCost * cases * bottlesPerCase
    }, 0)

    return (
      <div className="po-panel__create">
        <div className="po-panel__header">
          <AppButton size="sm" variant="neutral" onClick={goBack}>
            Back
          </AppButton>
          <span className="po-panel__header-title">New Purchase Order</span>
        </div>

        {error ? <p className="po-panel__msg--error">{error}</p> : null}

        <div className="po-panel__create-form">
          <div className="po-panel__create-row">
            <div className="po-panel__create-field">
              <span className="po-panel__create-label">Distributor</span>
              <select
                className="po-panel__create-select"
                value={selectedDistributor ?? ''}
                onChange={(event) => setSelectedDistributor(Number(event.target.value) || null)}
                disabled={distributorLocked}
              >
                <option value="">Select distributor...</option>
                {distributors
                  .filter((dist) => dist.is_active)
                  .map((dist) => (
                    <option key={dist.distributor_number} value={dist.distributor_number}>
                      {dist.distributor_name}
                    </option>
                  ))}
              </select>
              {distributorLocked ? (
                <span className="po-panel__create-field-note">
                  Distributor is locked to match the reorder selection.
                </span>
              ) : null}
            </div>
          </div>

          <div className="po-panel__create-field po-panel__create-field--grow">
            <span className="po-panel__create-label">Notes (optional)</span>
            <textarea
              className="po-panel__create-textarea"
              value={createNotes}
              onChange={(event) => setCreateNotes(event.target.value)}
              placeholder="Add notes..."
            />
          </div>
        </div>

        <span className="po-panel__create-items-title">Items ({createItems.length})</span>

        <div className="po-panel__create-item-search" ref={searchRef}>
          <input
            type="text"
            className="po-panel__create-item-search-input"
            placeholder={
              selectedDistributor
                ? 'Search products for this distributor...'
                : 'Select a distributor first'
            }
            disabled={!selectedDistributor}
            value={itemSearchQuery}
            aria-label="Search products to add"
            onChange={(event) => {
              setItemSearchQuery(event.target.value)
              if (!event.target.value.trim()) {
                setItemSearchOpen(false)
                setItemSearchResults([])
              }
            }}
            onFocus={() => {
              if (itemSearchResults.length > 0) setItemSearchOpen(true)
            }}
          />
          {itemSearchOpen && itemSearchResults.length > 0 ? (
            <ul className="po-panel__create-item-search-dropdown" role="listbox">
              {itemSearchResults.map((product) => (
                <li
                  key={product.id}
                  className="po-panel__create-item-search-option"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    handleSelectSearchResult(product)
                  }}
                >
                  <span className="po-panel__create-item-search-name">
                    {product.name}
                    {product.size ? (
                      <span className="po-panel__create-item-search-size"> {product.size}</span>
                    ) : null}
                  </span>
                  <span className="po-panel__create-item-search-meta">
                    {product.sku} &middot; {formatCurrency(product.price)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="po-panel__create-items-header" aria-hidden>
          <span>SKU</span>
          <span>Product</span>
          <span>Size</span>
          <span>Unit Cost</span>
          <span>Cases</span>
          <span>Items</span>
          <span>Line Total</span>
          <span />
        </div>

        <div className="po-panel__create-items-wrap">
          {createItems.map((item, index) => {
            const unitCount = item.quantity_cases * Math.max(1, item.bottles_per_case)
            return (
              <div key={`${item.product_id}-${index}`} className="po-panel__create-item-row">
                <span className="po-panel__create-item-sku">{item.sku || '--'}</span>
                <span className="po-panel__create-item-name">{item.name}</span>
                <span className="po-panel__create-item-size">{item.size || '--'}</span>
                <input
                  type="number"
                  className="po-panel__create-item-cost-input"
                  min={0}
                  step="0.01"
                  value={item.unit_cost}
                  aria-label={`Unit cost for ${item.name}`}
                  onChange={(event) =>
                    handleCreateItemCostChange(index, Number(event.target.value) || 0)
                  }
                />
                <input
                  type="number"
                  className="po-panel__create-item-cases"
                  min={1}
                  value={item.quantity_cases}
                  aria-label={`Cases for ${item.name}`}
                  onChange={(event) =>
                    handleCreateItemCasesChange(index, Number(event.target.value) || 1)
                  }
                />
                <span className="po-panel__create-item-units">{unitCount}</span>
                <span className="po-panel__create-item-total">
                  {formatCurrency(item.unit_cost * unitCount)}
                </span>
                <AppButton size="sm" variant="danger" onClick={() => handleRemoveCreateItem(index)}>
                  X
                </AppButton>
              </div>
            )
          })}
          {createItems.length === 0 ? (
            <p className="po-panel__empty">
              No items added. Items will be populated from product data.
            </p>
          ) : null}
        </div>

        <div className="po-panel__create-summary">
          <span className="po-panel__create-total">Total: {formatCurrency(createTotal)}</span>
        </div>

        <div className="po-panel__detail-footer">
          <AppButton variant="neutral" onClick={goBack}>
            Cancel
          </AppButton>
          <div className="po-panel__header-spacer" />
          <AppButton
            variant="success"
            onClick={submitCreate}
            disabled={!selectedDistributor || createItems.length === 0}
          >
            Create Order
          </AppButton>
        </div>
      </div>
    )
  }

  if (!activeDetail) return <div className="po-panel__empty">Order not found.</div>

  return (
    <div className="po-panel__detail">
      <div className="po-panel__detail-header">
        <AppButton size="sm" variant="neutral" onClick={goBack}>
          Back
        </AppButton>
        <div className="po-panel__detail-info">
          <span className="po-panel__detail-po-number">{activeDetail.po_number}</span>
          <span className="po-panel__detail-distributor"> - {activeDetail.distributor_name}</span>
        </div>
        <span className={cn('po-panel__badge', `po-panel__badge--${activeDetail.status}`)}>
          {activeDetail.status}
        </span>
      </div>

      {error ? <p className="po-panel__msg--error">{error}</p> : null}
      {success ? <p className="po-panel__msg--success">{success}</p> : null}

      <div className="po-panel__detail-meta">
        <div className="po-panel__detail-meta-item">
          <span className="po-panel__detail-meta-label">Created</span>
          <span className="po-panel__detail-meta-value">
            {new Date(activeDetail.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="po-panel__detail-meta-item">
          <span className="po-panel__detail-meta-label">Items</span>
          <span className="po-panel__detail-meta-value">{activeDetail.items.length}</span>
        </div>
        <div className="po-panel__detail-meta-item">
          <span className="po-panel__detail-meta-label">Total</span>
          <span className="po-panel__detail-meta-value">{formatCurrency(activeDetail.total)}</span>
        </div>
        {activeDetail.received_at ? (
          <div className="po-panel__detail-meta-item">
            <span className="po-panel__detail-meta-label">Received</span>
            <span className="po-panel__detail-meta-value">
              {new Date(activeDetail.received_at).toLocaleDateString()}
            </span>
          </div>
        ) : null}
      </div>

      {activeDetail.notes ? (
        <div className="po-panel__detail-notes">{activeDetail.notes}</div>
      ) : (
        <div className="po-panel__detail-notes po-panel__detail-notes--empty">No notes</div>
      )}

      <div className="po-panel__detail-table-wrap">
        <table className="po-panel__detail-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Unit Cost</th>
              <th>Ordered</th>
              {activeDetail.status === 'submitted' || activeDetail.status === 'received' ? (
                <th>Received</th>
              ) : null}
              <th>Line Total</th>
              {activeDetail.status === 'draft' ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {activeDetail.items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontFamily: 'monospace' }}>{item.sku}</td>
                <td>{item.product_name}</td>
                <td>{formatCurrency(item.unit_cost)}</td>
                <td>{item.quantity_ordered}</td>
                {activeDetail.status === 'submitted' ? (
                  <td>
                    <input
                      type="number"
                      className="po-panel__receive-input"
                      min={0}
                      max={item.quantity_ordered}
                      defaultValue={item.quantity_received}
                      onBlur={(event) => {
                        const value = Math.min(
                          item.quantity_ordered,
                          Math.max(0, Number(event.target.value))
                        )
                        if (value !== item.quantity_received) {
                          void handleReceiveItem(item.id, value)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          ;(event.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                    <span
                      style={{
                        marginLeft: '0.25rem',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem'
                      }}
                    >
                      / {item.quantity_ordered}
                    </span>
                  </td>
                ) : activeDetail.status === 'received' ? (
                  <td>
                    {item.quantity_received} / {item.quantity_ordered}
                  </td>
                ) : null}
                <td>{formatCurrency(item.line_total)}</td>
                {activeDetail.status === 'draft' ? (
                  <td>
                    <AppButton
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        api &&
                        void api
                          .removePurchaseOrderItem(activeDetail.id, item.id)
                          .then(() => openDetail(activeDetail.id))
                          .then(() => loadOrders())
                      }
                    >
                      Remove
                    </AppButton>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="po-panel__detail-footer">
        <AppButton variant="neutral" onClick={goBack}>
          Back to List
        </AppButton>

        {activeDetail.status === 'draft' ? (
          <>
            <AppButton variant="success" onClick={handleSubmitOrder}>
              Submit Order
            </AppButton>
            <AppButton variant="danger" onClick={() => setDeleteTarget(activeDetail)}>
              Delete
            </AppButton>
          </>
        ) : null}

        {activeDetail.status === 'submitted' ? (
          <AppButton variant="warning" onClick={handleCancelOrder}>
            Cancel Order
          </AppButton>
        ) : null}

        <span className="po-panel__detail-total">Total: {formatCurrency(activeDetail.total)}</span>
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Purchase Order"
        message={`Delete ${deleteTarget?.po_number}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
