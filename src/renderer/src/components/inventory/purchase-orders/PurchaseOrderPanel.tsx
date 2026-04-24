import { useCallback, useEffect, useRef, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { InventoryInput } from '@renderer/components/common/InventoryInput'
import { SearchDropdown } from '@renderer/components/common/SearchDropdown'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { cn } from '@renderer/lib/utils'
import { formatCurrency } from '@renderer/utils/currency'
import { useDebounce } from '@renderer/hooks/useDebounce'
import type {
  Distributor,
  Product,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderItem,
  ReorderProduct,
  UpdatePurchaseOrderItemsInput
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

type DetailLineDraft = PurchaseOrderItem

type ReceiveDraft = {
  unitsReceived: number
  manualUnits: number
  receiveFull: boolean
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

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function getSafeBottlesPerCase(value: number | null | undefined): number {
  return normalizePositiveInt(value, 1)
}

function getCaseCost(unitCost: number, bottlesPerCase: number): number | null {
  if (bottlesPerCase <= 0) return null
  return roundTo4(unitCost * bottlesPerCase)
}

function formatCases(units: number, bottlesPerCase: number): string {
  if (bottlesPerCase <= 0) return '--'
  const cases = units / bottlesPerCase
  return Number.isInteger(cases) ? String(cases) : cases.toFixed(2)
}

function createReceiveDrafts(items: PurchaseOrderItem[]): Record<number, ReceiveDraft> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        unitsReceived: item.quantity_received,
        manualUnits: item.quantity_received,
        receiveFull: item.quantity_received >= item.quantity_ordered
      }
    ])
  )
}

function createDetailDrafts(items: PurchaseOrderItem[]): DetailLineDraft[] {
  return items.map((item) => ({ ...item }))
}

function buildChangedLines(
  originalItems: PurchaseOrderItem[],
  draftItems: DetailLineDraft[]
): UpdatePurchaseOrderItemsInput['lines'] {
  return draftItems
    .map((draft) => {
      const original = originalItems.find((item) => item.id === draft.id)
      if (!original) return null

      const changed: UpdatePurchaseOrderItemsInput['lines'][number] = { id: draft.id }
      let hasChanges = false

      if (draft.unit_cost !== original.unit_cost) {
        changed.unit_cost = roundTo4(draft.unit_cost)
        hasChanges = true
      }
      if (draft.quantity_ordered !== original.quantity_ordered) {
        changed.quantity_ordered = draft.quantity_ordered
        hasChanges = true
      }
      if (draft.quantity_received !== original.quantity_received) {
        changed.quantity_received = draft.quantity_received
        hasChanges = true
      }

      return hasChanges ? changed : null
    })
    .filter((line): line is UpdatePurchaseOrderItemsInput['lines'][number] => line !== null)
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
  const [editMode, setEditMode] = useState(false)
  const [detailDraftItems, setDetailDraftItems] = useState<DetailLineDraft[]>([])
  const [receiveDrafts, setReceiveDrafts] = useState<Record<number, ReceiveDraft>>({})

  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<number | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [createItems, setCreateItems] = useState<CreateItemRow[]>([])

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)
  const [showMarkReceivedConfirm, setShowMarkReceivedConfirm] = useState(false)
  const [showReductionConfirm, setShowReductionConfirm] = useState(false)

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
    if (!activeDetail) return
    setEditMode(false)
    setDetailDraftItems(createDetailDrafts(activeDetail.items))
    setReceiveDrafts(createReceiveDrafts(activeDetail.items))
  }, [activeDetail])

  useEffect(() => {
    if (!prefillItems || prefillItems.length === 0 || !api) return

    void (async () => {
      try {
        const dists = await api.getDistributors()
        setDistributors(dists)

        const items: CreateItemRow[] = prefillItems.map((item) => {
          const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
          const unitCost = roundTo4(normalizeNonNegativeNumber(item.cost))
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

  const refreshDetail = useCallback(
    async (poId: number) => {
      if (!api) return
      const detail = await api.getPurchaseOrderDetail(poId)
      if (detail) setActiveDetail(detail)
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
          bottles_per_case: getSafeBottlesPerCase(product.bottles_per_case)
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
        setItemSearchResults([])
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

  const handleCreateUnitCostChange = useCallback((index: number, value: number) => {
    setCreateItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, unit_cost: roundTo4(Math.max(0, value)) } : item
      )
    )
  }, [])

  const handleCreateCaseCostChange = useCallback((index: number, value: number) => {
    setCreateItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
        return {
          ...item,
          unit_cost: roundTo4(Math.max(0, value) / bottlesPerCase)
        }
      })
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
          getSafeBottlesPerCase(item.bottles_per_case),
        unit_cost: roundTo4(normalizeNonNegativeNumber(item.unit_cost))
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
      await refreshDetail(activeDetail.id)
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order')
    }
  }, [api, activeDetail, loadOrders, refreshDetail])

  const handleCancelOrder = useCallback(async () => {
    if (!api || !activeDetail) return
    try {
      setError(null)
      await api.updatePurchaseOrder({ id: activeDetail.id, status: 'cancelled' })
      setSuccess('Order cancelled')
      await refreshDetail(activeDetail.id)
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order')
    }
  }, [api, activeDetail, loadOrders, refreshDetail])

  const handleReceiveItem = useCallback(
    async (itemId: number, qtyReceived: number) => {
      if (!api || !activeDetail) return
      try {
        setError(null)
        await api.receivePurchaseOrderItem({ id: itemId, quantity_received: qtyReceived })
        await refreshDetail(activeDetail.id)
        void loadOrders()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to receive item')
      }
    },
    [api, activeDetail, loadOrders, refreshDetail]
  )

  const handleMarkFullyReceived = useCallback(async () => {
    if (!api || !activeDetail) return
    try {
      setError(null)
      const detail = await api.markPurchaseOrderReceived(activeDetail.id)
      setActiveDetail(detail)
      setShowMarkReceivedConfirm(false)
      setSuccess(`Purchase order ${detail.po_number} marked as received`)
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark purchase order received')
    }
  }, [api, activeDetail, loadOrders])

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
    setEditMode(false)
    setError(null)
    setSuccess(null)
  }, [])

  const handleReceiveDraftChange = useCallback((itemId: number, nextDraft: ReceiveDraft) => {
    setReceiveDrafts((prev) => ({ ...prev, [itemId]: nextDraft }))
  }, [])

  const handleReceiveUnitsChange = useCallback(
    (item: PurchaseOrderItem, value: number) => {
      const nextValue = Math.max(0, Math.floor(value))
      handleReceiveDraftChange(item.id, {
        unitsReceived: nextValue,
        manualUnits: nextValue,
        receiveFull: nextValue >= item.quantity_ordered
      })
    },
    [handleReceiveDraftChange]
  )

  const handleReceiveCasesChange = useCallback(
    (item: PurchaseOrderItem, value: number) => {
      const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
      const nextUnits = Math.max(0, Math.round(value * bottlesPerCase))
      handleReceiveDraftChange(item.id, {
        unitsReceived: nextUnits,
        manualUnits: nextUnits,
        receiveFull: nextUnits >= item.quantity_ordered
      })
    },
    [handleReceiveDraftChange]
  )

  const handleReceiveFullToggle = useCallback(
    (item: PurchaseOrderItem, checked: boolean) => {
      const currentDraft = receiveDrafts[item.id] ?? {
        unitsReceived: item.quantity_received,
        manualUnits: item.quantity_received,
        receiveFull: item.quantity_received >= item.quantity_ordered
      }
      const nextUnits = checked ? item.quantity_ordered : currentDraft.manualUnits

      handleReceiveDraftChange(item.id, {
        unitsReceived: nextUnits,
        manualUnits: currentDraft.manualUnits,
        receiveFull: checked
      })

      void handleReceiveItem(item.id, nextUnits)
    },
    [handleReceiveDraftChange, handleReceiveItem, receiveDrafts]
  )

  const handleReceiveCommit = useCallback(
    (item: PurchaseOrderItem) => {
      const draft = receiveDrafts[item.id]
      if (!draft || draft.unitsReceived === item.quantity_received) return
      void handleReceiveItem(item.id, draft.unitsReceived)
    },
    [handleReceiveItem, receiveDrafts]
  )

  const handleStartEdit = useCallback(() => {
    if (!activeDetail) return
    setDetailDraftItems(createDetailDrafts(activeDetail.items))
    setEditMode(true)
  }, [activeDetail])

  const handleCancelEdit = useCallback(() => {
    if (!activeDetail) return
    setDetailDraftItems(createDetailDrafts(activeDetail.items))
    setEditMode(false)
    setShowReductionConfirm(false)
  }, [activeDetail])

  const handleDetailLineChange = useCallback(
    (itemId: number, updater: (line: DetailLineDraft) => DetailLineDraft) => {
      setDetailDraftItems((prev) => prev.map((line) => (line.id === itemId ? updater(line) : line)))
    },
    []
  )

  const handleEditUnitCostChange = useCallback(
    (itemId: number, value: number) => {
      handleDetailLineChange(itemId, (line) => ({
        ...line,
        unit_cost: roundTo4(Math.max(0, value)),
        line_total: roundTo4(Math.max(0, value) * line.quantity_ordered)
      }))
    },
    [handleDetailLineChange]
  )

  const handleEditCaseCostChange = useCallback(
    (itemId: number, value: number) => {
      handleDetailLineChange(itemId, (line) => {
        const bottlesPerCase = getSafeBottlesPerCase(line.bottles_per_case)
        const unitCost = roundTo4(Math.max(0, value) / bottlesPerCase)
        return {
          ...line,
          unit_cost: unitCost,
          line_total: roundTo4(unitCost * line.quantity_ordered)
        }
      })
    },
    [handleDetailLineChange]
  )

  const handleEditOrderedChange = useCallback(
    (itemId: number, value: number) => {
      handleDetailLineChange(itemId, (line) => {
        const quantityOrdered = Math.max(1, Math.floor(value))
        return {
          ...line,
          quantity_ordered: quantityOrdered,
          line_total: roundTo4(line.unit_cost * quantityOrdered)
        }
      })
    },
    [handleDetailLineChange]
  )

  const handleEditReceivedChange = useCallback(
    (itemId: number, value: number) => {
      handleDetailLineChange(itemId, (line) => ({
        ...line,
        quantity_received: Math.max(0, Math.floor(value))
      }))
    },
    [handleDetailLineChange]
  )

  const filteredOrders =
    filterStatus === 'all' ? orders : orders.filter((order) => order.status === filterStatus)
  const distributorLocked = prefillDistributor != null && createItems.length > 0
  const changedLines = activeDetail ? buildChangedLines(activeDetail.items, detailDraftItems) : []
  const reducedUnits = activeDetail
    ? changedLines.reduce((sum, line) => {
        if (line.quantity_received == null) return sum
        const original = activeDetail.items.find((item) => item.id === line.id)
        if (!original || line.quantity_received >= original.quantity_received) return sum
        return sum + (original.quantity_received - line.quantity_received)
      }, 0)
    : 0

  const saveDetailChanges = useCallback(async () => {
    if (!api || !activeDetail) return

    if (changedLines.length === 0) {
      setEditMode(false)
      return
    }

    try {
      setError(null)
      const detail = await api.updatePurchaseOrderItems({
        po_id: activeDetail.id,
        lines: changedLines
      })
      setActiveDetail(detail)
      setEditMode(false)
      setShowReductionConfirm(false)
      setSuccess('Purchase order changes saved')
      void loadOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase order changes')
    }
  }, [api, activeDetail, changedLines, loadOrders])

  const handleSaveEdit = useCallback(() => {
    if (reducedUnits > 0) {
      setShowReductionConfirm(true)
      return
    }
    void saveDetailChanges()
  }, [reducedUnits, saveDetailChanges])

  if (view === 'list') {
    return (
      <div className="po-panel">
        <div className="po-panel__header">
          <span className="po-panel__header-title">Purchase Orders</span>
          <div className="po-panel__header-spacer" />
          <AppButton variant="success" onClick={() => void startCreate()}>
            New Order
          </AppButton>
        </div>

        <div className="po-panel__filters">
          <label className="po-panel__create-field">
            <span className="po-panel__create-label">Status</span>
            <select
              aria-label="Status Filter"
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
          </label>
        </div>

        {error ? <p className="po-panel__msg--error">{error}</p> : null}
        {success ? <p className="po-panel__msg--success">{success}</p> : null}

        {loading ? (
          <div className="po-panel__loading">Loading...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="po-panel__empty">No purchase orders found.</div>
        ) : (
          <div className="po-panel__list-wrap">
            <table className="po-panel__table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Distributor</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="po-panel__row--clickable"
                    onClick={() => void openDetail(order.id)}
                  >
                    <td className="po-panel__mono">{order.po_number}</td>
                    <td>{order.distributor_name}</td>
                    <td>
                      <span className={cn('po-panel__badge', `po-panel__badge--${order.status}`)}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.item_count}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{new Date(order.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
      const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
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
                aria-label="Distributor"
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

        <div className="po-panel__detail-actions">
          <span className="po-panel__create-items-title">Items</span>
          <span className="po-panel__create-field-note">({createItems.length})</span>
        </div>

        <div className="po-panel__create-item-search" ref={searchRef}>
          <SearchDropdown
            ariaLabel="Search products to add"
            value={itemSearchQuery}
            onValueChange={(value) => {
              setItemSearchQuery(value)
              if (!value.trim()) {
                setItemSearchOpen(false)
                setItemSearchResults([])
              }
            }}
            results={itemSearchResults}
            isOpen={itemSearchOpen}
            onOpenChange={setItemSearchOpen}
            onSelect={handleSelectSearchResult}
            getOptionKey={(product) => product.id}
            renderOption={(product) => (
              <>
                <span className="po-panel__create-item-search-name">
                  {product.name}
                  {product.size ? (
                    <span className="po-panel__create-item-search-size"> {product.size}</span>
                  ) : null}
                </span>
                <span className="po-panel__create-item-search-meta">
                  {product.sku} · {formatCurrency(product.price)}
                </span>
              </>
            )}
            inputVariant="plain"
            inputClassName="po-panel__create-item-search-input"
            listboxClassName="po-panel__create-item-search-dropdown"
            optionClassName="po-panel__create-item-search-option"
            placeholder={
              selectedDistributor
                ? 'Search products for this distributor...'
                : 'Select a distributor first'
            }
            disabled={!selectedDistributor}
          />
        </div>

        <div className="po-panel__create-items-header" aria-hidden>
          <span>SKU</span>
          <span>Item</span>
          <span>Size</span>
          <span>Unit Cost</span>
          <span>Case Cost</span>
          <span>Cases</span>
          <span>Units</span>
          <span>Total</span>
          <span />
        </div>

        <div>
          {createItems.map((item, index) => {
            const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
            const unitCount = item.quantity_cases * bottlesPerCase
            const caseCost = getCaseCost(item.unit_cost, bottlesPerCase) ?? 0

            return (
              <div key={item.product_id} className="po-panel__create-item-row">
                <span className="po-panel__create-item-sku">{item.sku}</span>
                <span className="po-panel__create-item-name">{item.name}</span>
                <span className="po-panel__create-item-size">{item.size ?? '--'}</span>
                <InventoryInput
                  type="number"
                  className="po-panel__create-item-cost-input"
                  min={0}
                  step="0.0001"
                  value={item.unit_cost}
                  aria-label={`Unit cost for ${item.name}`}
                  onChange={(event) =>
                    handleCreateUnitCostChange(index, Number(event.target.value) || 0)
                  }
                />
                <InventoryInput
                  type="number"
                  className="po-panel__create-item-cost-input"
                  min={0}
                  step="0.0001"
                  value={caseCost}
                  aria-label={`Case cost for ${item.name}`}
                  onChange={(event) =>
                    handleCreateCaseCostChange(index, Number(event.target.value) || 0)
                  }
                />
                <InventoryInput
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

  const submittedOrReceived =
    activeDetail.status === 'submitted' || activeDetail.status === 'received'

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
        <div className="po-panel__detail-actions">
          {activeDetail.status === 'submitted' && !editMode ? (
            <AppButton variant="success" onClick={() => setShowMarkReceivedConfirm(true)}>
              Mark Fully Received
            </AppButton>
          ) : null}
          {submittedOrReceived && !editMode ? (
            <AppButton variant="neutral" onClick={handleStartEdit}>
              Edit
            </AppButton>
          ) : null}
        </div>
        <span
          className={cn(
            'po-panel__badge',
            editMode ? 'po-panel__badge--editing' : `po-panel__badge--${activeDetail.status}`
          )}
        >
          {editMode ? 'editing' : activeDetail.status}
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
            {editMode ? (
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Unit Cost</th>
                <th>Case Cost</th>
                <th>Ordered</th>
                <th>Received</th>
                <th>Line Total</th>
              </tr>
            ) : submittedOrReceived ? (
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Unit Cost</th>
                <th>Cases Ordered</th>
                {activeDetail.status === 'submitted' ? <th>Receive Full Case Order</th> : null}
                <th>Cases Received</th>
                <th>Units Received</th>
                <th>Line Total</th>
              </tr>
            ) : (
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Unit Cost</th>
                <th>Ordered</th>
                <th>Line Total</th>
                <th />
              </tr>
            )}
          </thead>
          <tbody>
            {editMode
              ? detailDraftItems.map((item) => {
                  const caseCost = getCaseCost(item.unit_cost, item.bottles_per_case)
                  return (
                    <tr key={item.id}>
                      <td className="po-panel__mono">{item.sku}</td>
                      <td>{item.product_name}</td>
                      <td>
                        <InventoryInput
                          type="number"
                          className="po-panel__receive-input"
                          min={0}
                          step="0.0001"
                          value={item.unit_cost}
                          aria-label={`Unit cost for ${item.product_name}`}
                          onChange={(event) =>
                            handleEditUnitCostChange(item.id, Number(event.target.value) || 0)
                          }
                        />
                      </td>
                      <td>
                        {caseCost == null ? (
                          <span className="po-panel__create-item-disabled">--</span>
                        ) : (
                          <InventoryInput
                            type="number"
                            className="po-panel__receive-input"
                            min={0}
                            step="0.0001"
                            value={caseCost}
                            aria-label={`Case cost for ${item.product_name}`}
                            onChange={(event) =>
                              handleEditCaseCostChange(item.id, Number(event.target.value) || 0)
                            }
                          />
                        )}
                      </td>
                      <td>
                        <InventoryInput
                          type="number"
                          className="po-panel__receive-input"
                          min={1}
                          value={item.quantity_ordered}
                          aria-label={`Quantity ordered for ${item.product_name}`}
                          onChange={(event) =>
                            handleEditOrderedChange(item.id, Number(event.target.value) || 1)
                          }
                        />
                      </td>
                      <td>
                        <InventoryInput
                          type="number"
                          className="po-panel__receive-input"
                          min={0}
                          value={item.quantity_received}
                          aria-label={`Quantity received for ${item.product_name}`}
                          onChange={(event) =>
                            handleEditReceivedChange(item.id, Number(event.target.value) || 0)
                          }
                        />
                      </td>
                      <td>{formatCurrency(item.unit_cost * item.quantity_ordered)}</td>
                    </tr>
                  )
                })
              : activeDetail.items.map((item) => {
                  const receiveDraft = receiveDrafts[item.id] ?? {
                    unitsReceived: item.quantity_received,
                    manualUnits: item.quantity_received,
                    receiveFull: item.quantity_received >= item.quantity_ordered
                  }
                  const bottlesPerCase = getSafeBottlesPerCase(item.bottles_per_case)
                  const casesOrdered = formatCases(item.quantity_ordered, bottlesPerCase)
                  const casesReceivedValue = roundTo4(receiveDraft.unitsReceived / bottlesPerCase)

                  if (submittedOrReceived) {
                    return (
                      <tr key={item.id}>
                        <td className="po-panel__mono">{item.sku}</td>
                        <td>{item.product_name}</td>
                        <td>{formatCurrency(item.unit_cost)}</td>
                        <td>{casesOrdered}</td>
                        {activeDetail.status === 'submitted' ? (
                          <td>
                            <div className="po-panel__checkbox-wrap">
                              <Checkbox
                                checked={receiveDraft.receiveFull}
                                aria-label={`Receive full case order for ${item.product_name}`}
                                onCheckedChange={(checked) =>
                                  handleReceiveFullToggle(item, checked === true)
                                }
                              />
                            </div>
                          </td>
                        ) : null}
                        <td>
                          {activeDetail.status === 'submitted' ? (
                            <InventoryInput
                              type="number"
                              className="po-panel__receive-input"
                              min={0}
                              step="0.01"
                              value={casesReceivedValue}
                              aria-label={`Cases received for ${item.product_name}`}
                              onChange={(event) =>
                                handleReceiveCasesChange(item, Number(event.target.value) || 0)
                              }
                              onBlur={() => handleReceiveCommit(item)}
                            />
                          ) : (
                            formatCases(item.quantity_received, bottlesPerCase)
                          )}
                        </td>
                        <td>
                          {activeDetail.status === 'submitted' ? (
                            <InventoryInput
                              type="number"
                              className="po-panel__receive-input"
                              min={0}
                              value={receiveDraft.unitsReceived}
                              aria-label={`Units received for ${item.product_name}`}
                              onChange={(event) =>
                                handleReceiveUnitsChange(item, Number(event.target.value) || 0)
                              }
                              onBlur={() => handleReceiveCommit(item)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  ;(event.target as HTMLInputElement).blur()
                                }
                              }}
                            />
                          ) : (
                            `${item.quantity_received} / ${item.quantity_ordered}`
                          )}
                        </td>
                        <td>{formatCurrency(item.line_total)}</td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={item.id}>
                      <td className="po-panel__mono">{item.sku}</td>
                      <td>{item.product_name}</td>
                      <td>{formatCurrency(item.unit_cost)}</td>
                      <td>{item.quantity_ordered}</td>
                      <td>{formatCurrency(item.line_total)}</td>
                      <td>
                        <AppButton
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            api &&
                            void api
                              .removePurchaseOrderItem(activeDetail.id, item.id)
                              .then(() => refreshDetail(activeDetail.id))
                              .then(() => loadOrders())
                          }
                        >
                          Remove
                        </AppButton>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>

      <div className="po-panel__detail-footer">
        <AppButton variant="neutral" onClick={goBack}>
          Back to List
        </AppButton>

        {editMode ? (
          <>
            <AppButton variant="neutral" onClick={handleCancelEdit}>
              Cancel
            </AppButton>
            <AppButton variant="success" onClick={handleSaveEdit}>
              Save Changes
            </AppButton>
          </>
        ) : null}

        {activeDetail.status === 'draft' && !editMode ? (
          <>
            <AppButton variant="success" onClick={handleSubmitOrder}>
              Submit Order
            </AppButton>
            <AppButton variant="danger" onClick={() => setDeleteTarget(activeDetail)}>
              Delete
            </AppButton>
          </>
        ) : null}

        {activeDetail.status === 'submitted' && !editMode ? (
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

      <ConfirmDialog
        isOpen={showMarkReceivedConfirm}
        title="Mark Fully Received"
        message="Mark this purchase order as fully received and fill every outstanding line to the ordered quantity?"
        confirmLabel="Mark Received"
        variant="warning"
        onConfirm={handleMarkFullyReceived}
        onCancel={() => setShowMarkReceivedConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showReductionConfirm}
        title="Reduce On-Hand Stock"
        message={`This will reduce on-hand stock by ${reducedUnits} units. Continue?`}
        confirmLabel="Save Changes"
        variant="warning"
        onConfirm={() => void saveDetailChanges()}
        onCancel={() => setShowReductionConfirm(false)}
      />
    </div>
  )
}
