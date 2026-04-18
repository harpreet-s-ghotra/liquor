import { useCallback, useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { AppButton } from '@renderer/components/common/AppButton'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { formatCurrency } from '@renderer/utils/currency'
import type {
  PurchaseOrder,
  PurchaseOrderDetail,
  Distributor,
  LowStockProduct
} from '../../../../../shared/types'
import './purchase-order-panel.css'

type View = 'list' | 'create' | 'detail'

type PurchaseOrderPanelProps = {
  prefillItems: LowStockProduct[] | null
  onPrefillConsumed: () => void
}

export function PurchaseOrderPanel({
  prefillItems,
  onPrefillConsumed
}: PurchaseOrderPanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [view, setView] = useState<View>('list')
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Detail view state
  const [activeDetail, setActiveDetail] = useState<PurchaseOrderDetail | null>(null)

  // Create view state
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<number | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [createItems, setCreateItems] = useState<
    Array<{
      product_id: number
      sku: string
      name: string
      cost: number
      quantity_ordered: number
    }>
  >([])

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)

  // ── Load orders ──

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

  // ── Handle prefill from ReorderDashboard ──

  useEffect(() => {
    if (!prefillItems || prefillItems.length === 0 || !api) return

    // Load distributors, then set up create form
    void (async () => {
      try {
        const dists = await api.getDistributors()
        setDistributors(dists)

        // Group items by distributor — use the first distributor found, or none
        const items = prefillItems.map((p) => ({
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          cost: 0, // Will be fetched when creating
          quantity_ordered: Math.max(1, (p.reorder_point || 10) - p.in_stock)
        }))
        setCreateItems(items)
        setCreateNotes('')
        setSelectedDistributor(null)
        setView('create')
      } catch {
        // ignore
      }
    })()
    onPrefillConsumed()
  }, [prefillItems, api, onPrefillConsumed])

  // ── View order detail ──

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

  // ── Create order ──

  const startCreate = useCallback(async () => {
    if (!api) return
    try {
      const dists = await api.getDistributors()
      setDistributors(dists)
      setSelectedDistributor(null)
      setCreateNotes('')
      setCreateItems([])
      setView('create')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load distributors')
    }
  }, [api])

  const handleAddBlankItem = useCallback(() => {
    setCreateItems((prev) => [
      ...prev,
      { product_id: 0, sku: '', name: 'New item', cost: 0, quantity_ordered: 1 }
    ])
  }, [])

  const handleCreateItemQtyChange = useCallback((index: number, qty: number) => {
    setCreateItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity_ordered: qty } : it))
    )
  }, [])

  const handleRemoveCreateItem = useCallback((index: number) => {
    setCreateItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const submitCreate = useCallback(async () => {
    if (!api || !selectedDistributor) return
    const validItems = createItems.filter((it) => it.product_id > 0 && it.quantity_ordered > 0)
    if (validItems.length === 0) {
      setError('Add at least one item with a valid product')
      return
    }
    try {
      setError(null)
      const detail = await api.createPurchaseOrder({
        distributor_number: selectedDistributor,
        items: validItems.map((it) => ({
          product_id: it.product_id,
          quantity_ordered: it.quantity_ordered
        })),
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

  // ── Status transitions ──

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

  // ── Receive items ──

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

  // ── Delete ──

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

  // ── Back to list ──

  const goBack = useCallback(() => {
    setView('list')
    setActiveDetail(null)
    setError(null)
    setSuccess(null)
  }, [])

  // ── Filter ──

  const filteredOrders =
    filterStatus === 'all' ? orders : orders.filter((o) => o.status === filterStatus)

  // ── Render: List View ──

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
              onChange={(e) => setFilterStatus(e.target.value)}
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

        {error && <p className="po-panel__msg--error">{error}</p>}
        {success && <p className="po-panel__msg--success">{success}</p>}

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
                {filteredOrders.map((po) => (
                  <tr
                    key={po.id}
                    className="po-panel__row--clickable"
                    onClick={() => void openDetail(po.id)}
                  >
                    <td style={{ fontFamily: 'monospace' }}>{po.po_number}</td>
                    <td>{po.distributor_name}</td>
                    <td>
                      <span className={cn('po-panel__badge', `po-panel__badge--${po.status}`)}>
                        {po.status}
                      </span>
                    </td>
                    <td>{po.item_count}</td>
                    <td>{formatCurrency(po.total)}</td>
                    <td>{new Date(po.created_at).toLocaleDateString()}</td>
                    <td>
                      {(po.status === 'draft' || po.status === 'cancelled') && (
                        <AppButton
                          size="sm"
                          variant="danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(po)
                          }}
                        >
                          Delete
                        </AppButton>
                      )}
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

  // ── Render: Create View ──

  if (view === 'create') {
    const createTotal = createItems.reduce((sum, it) => sum + it.cost * it.quantity_ordered, 0)

    return (
      <div className="po-panel__create">
        <div className="po-panel__header">
          <AppButton size="sm" variant="neutral" onClick={goBack}>
            Back
          </AppButton>
          <span className="po-panel__header-title">New Purchase Order</span>
        </div>

        {error && <p className="po-panel__msg--error">{error}</p>}

        <div className="po-panel__create-form">
          <div className="po-panel__create-row">
            <div className="po-panel__create-field">
              <span className="po-panel__create-label">Distributor</span>
              <select
                className="po-panel__create-select"
                value={selectedDistributor ?? ''}
                onChange={(e) => setSelectedDistributor(Number(e.target.value) || null)}
              >
                <option value="">Select distributor...</option>
                {distributors
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.distributor_number} value={d.distributor_number}>
                      {d.distributor_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="po-panel__create-field po-panel__create-field--grow">
            <span className="po-panel__create-label">Notes (optional)</span>
            <textarea
              className="po-panel__create-textarea"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Add notes..."
            />
          </div>
        </div>

        <span className="po-panel__create-items-title">Items ({createItems.length})</span>

        <div className="po-panel__create-items-wrap">
          {createItems.map((item, idx) => (
            <div key={idx} className="po-panel__create-item-row">
              <span className="po-panel__create-item-sku">{item.sku || '--'}</span>
              <span className="po-panel__create-item-name">{item.name}</span>
              <span className="po-panel__create-item-cost">{formatCurrency(item.cost)}</span>
              <input
                type="number"
                className="po-panel__create-item-qty"
                min={1}
                value={item.quantity_ordered}
                onChange={(e) =>
                  handleCreateItemQtyChange(idx, Math.max(1, Number(e.target.value)))
                }
              />
              <span className="po-panel__create-item-total">
                {formatCurrency(item.cost * item.quantity_ordered)}
              </span>
              <AppButton size="sm" variant="danger" onClick={() => handleRemoveCreateItem(idx)}>
                X
              </AppButton>
            </div>
          ))}
          {createItems.length === 0 && (
            <p className="po-panel__empty">
              No items added. Items will be populated from product data.
            </p>
          )}
        </div>

        <div className="po-panel__create-summary">
          <AppButton size="sm" variant="neutral" onClick={handleAddBlankItem}>
            + Add Item
          </AppButton>
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

  // ── Render: Detail View ──

  if (!activeDetail) return <div className="po-panel__empty">Order not found.</div>

  return (
    <div className="po-panel__detail">
      <div className="po-panel__detail-header">
        <AppButton size="sm" variant="neutral" onClick={goBack}>
          Back
        </AppButton>
        <div className="po-panel__detail-info">
          <span className="po-panel__detail-po-number">{activeDetail.po_number}</span>
          <span className="po-panel__detail-distributor">
            {' '}
            &mdash; {activeDetail.distributor_name}
          </span>
        </div>
        <span className={cn('po-panel__badge', `po-panel__badge--${activeDetail.status}`)}>
          {activeDetail.status}
        </span>
      </div>

      {error && <p className="po-panel__msg--error">{error}</p>}
      {success && <p className="po-panel__msg--success">{success}</p>}

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
        {activeDetail.received_at && (
          <div className="po-panel__detail-meta-item">
            <span className="po-panel__detail-meta-label">Received</span>
            <span className="po-panel__detail-meta-value">
              {new Date(activeDetail.received_at).toLocaleDateString()}
            </span>
          </div>
        )}
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
              {activeDetail.status === 'draft' && <th />}
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
                      onBlur={(e) => {
                        const val = Math.min(
                          item.quantity_ordered,
                          Math.max(0, Number(e.target.value))
                        )
                        if (val !== item.quantity_received) {
                          void handleReceiveItem(item.id, val)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
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
                {activeDetail.status === 'draft' && (
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="po-panel__detail-footer">
        <AppButton variant="neutral" onClick={goBack}>
          Back to List
        </AppButton>

        {activeDetail.status === 'draft' && (
          <>
            <AppButton variant="success" onClick={handleSubmitOrder}>
              Submit Order
            </AppButton>
            <AppButton variant="danger" onClick={() => setDeleteTarget(activeDetail)}>
              Delete
            </AppButton>
          </>
        )}

        {activeDetail.status === 'submitted' && (
          <AppButton variant="warning" onClick={handleCancelOrder}>
            Cancel Order
          </AppButton>
        )}

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
