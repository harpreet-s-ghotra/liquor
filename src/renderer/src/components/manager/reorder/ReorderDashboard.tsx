import { useCallback, useEffect, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { AppButton } from '@renderer/components/common/AppButton'
import type { LowStockProduct } from '../../../../../shared/types'
import './reorder-dashboard.css'

const THRESHOLD_OPTIONS = [5, 10, 20, 50, 100]

type ReorderDashboardProps = {
  onCreateOrder?: (items: LowStockProduct[]) => void
}

export function ReorderDashboard({ onCreateOrder }: ReorderDashboardProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [threshold, setThreshold] = useState(10)
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    if (!api) return
    try {
      setLoading(true)
      setError(null)
      const data = await api.getLowStockProducts(threshold)
      setProducts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load low-stock products')
    } finally {
      setLoading(false)
    }
  }, [api, threshold])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const zeroCount = products.filter((p) => p.in_stock <= 0).length
  const belowReorderCount = products.filter(
    (p) => p.in_stock > 0 && p.reorder_point > 0 && p.in_stock <= p.reorder_point
  ).length

  const getRowClass = (p: LowStockProduct): string => {
    if (p.in_stock <= 0) return 'reorder-dashboard__row--zero'
    if (p.reorder_point > 0 && p.in_stock <= p.reorder_point)
      return 'reorder-dashboard__row--below-reorder'
    return 'reorder-dashboard__row--at-threshold'
  }

  return (
    <div className="reorder-dashboard">
      {/* Controls */}
      <div className="reorder-dashboard__controls">
        <span className="reorder-dashboard__threshold-label">Stock threshold:</span>
        <select
          className="reorder-dashboard__threshold-select"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        >
          {THRESHOLD_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t} units
            </option>
          ))}
        </select>
        {onCreateOrder && products.length > 0 && (
          <AppButton size="sm" onClick={() => onCreateOrder(products)}>
            Create Order
          </AppButton>
        )}
      </div>

      {/* Summary cards */}
      <div className="reorder-dashboard__summary">
        <div className="reorder-dashboard__summary-card">
          <span className="reorder-dashboard__summary-count reorder-dashboard__summary-count--danger">
            {zeroCount}
          </span>
          <span className="reorder-dashboard__summary-label">Out of stock</span>
        </div>
        <div className="reorder-dashboard__summary-card">
          <span className="reorder-dashboard__summary-count reorder-dashboard__summary-count--warning">
            {belowReorderCount}
          </span>
          <span className="reorder-dashboard__summary-label">Below reorder point</span>
        </div>
        <div className="reorder-dashboard__summary-card">
          <span className="reorder-dashboard__summary-count">{products.length}</span>
          <span className="reorder-dashboard__summary-label">Total low stock</span>
        </div>
      </div>

      {/* Table */}
      <div className="reorder-dashboard__list-wrap">
        {loading ? (
          <div className="reorder-dashboard__loading">Loading...</div>
        ) : error ? (
          <p className="reorder-dashboard__msg--error">{error}</p>
        ) : products.length === 0 ? (
          <p className="reorder-dashboard__empty">No products below {threshold} units in stock.</p>
        ) : (
          <table className="reorder-dashboard__table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>In Stock</th>
                <th>Reorder Pt</th>
                <th>Distributor</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={cn(getRowClass(p))}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.item_type ?? '--'}</td>
                  <td>{p.in_stock}</td>
                  <td>{p.reorder_point > 0 ? p.reorder_point : '--'}</td>
                  <td>{p.distributor_name ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
