import { useState } from 'react'
import type { DiffRow, FilterMode, CuratedField } from '../types'
import { promoteField, clearCuratedField, bulkPromoteEmptyCatalogFields } from '../lib/api'

const PAGE_SIZE = 50

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All diffs' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'size', label: 'Size' },
  { key: 'cost', label: 'Cost' },
  { key: 'no_match', label: 'No catalog match' },
]

const FIELD_LABELS: Record<CuratedField, string> = {
  sku: 'SKU',
  barcode: 'Barcode',
  size: 'Size',
  cost: 'Cost',
}

const STATUS_LABELS: Record<string, string> = {
  differs: 'Differs',
  merchant_has_value_catalog_missing: 'Missing in catalog',
  no_catalog_match: 'No catalog match',
}

type Props = {
  rows: DiffRow[]
  allRows: DiffRow[]
  filter: FilterMode
  onFilterChange: (f: FilterMode) => void
  page: number
  onPageChange: (p: number) => void
  selectedMerchantId: string
  operatorEmail: string
  onMutated: () => void
}

export default function DiffTable({
  rows,
  allRows,
  filter,
  onFilterChange,
  page,
  onPageChange,
  selectedMerchantId,
  operatorEmail,
  onMutated,
}: Props): React.JSX.Element {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Count per-filter for badges
  function countForFilter(f: FilterMode): number {
    if (f === 'all') return allRows.length
    if (f === 'no_match') return allRows.filter((r) => r.status === 'no_catalog_match').length
    return allRows.filter((r) => r.field === f).length
  }

  async function handlePromote(row: DiffRow): Promise<void> {
    if (!row.catalog_product_id || !row.merchant_value) return
    setPendingKey(row.key)
    setActionError(null)
    try {
      await promoteField(
        row.catalog_product_id,
        row.field,
        row.effective_catalog_value,
        row.merchant_value,
        selectedMerchantId,
        operatorEmail,
      )
      onMutated()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingKey(null)
    }
  }

  async function handleClear(row: DiffRow): Promise<void> {
    if (!row.catalog_product_id || !row.curated_value) return
    if (
      !window.confirm(
        `Clear the curated ${FIELD_LABELS[row.field]} override for "${row.product_name}"?\n\nThis will revert the catalog to the original NYSLA value.`,
      )
    ) {
      return
    }
    setPendingKey(row.key)
    setActionError(null)
    try {
      await clearCuratedField(
        row.catalog_product_id,
        row.field,
        row.curated_value,
        operatorEmail,
      )
      onMutated()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingKey(null)
    }
  }

  // Bulk: promote all rows of the active field filter where catalog value is empty
  async function handleBulkPromote(): Promise<void> {
    const field = filter as CuratedField
    if (!['sku', 'barcode', 'size', 'cost'].includes(field)) return

    const eligibleRows = allRows.filter(
      (r) =>
        r.field === field &&
        r.status === 'merchant_has_value_catalog_missing' &&
        r.catalog_product_id != null &&
        r.merchant_value != null,
    )

    if (eligibleRows.length === 0) {
      setBulkResult('No eligible rows to promote.')
      return
    }

    if (
      !window.confirm(
        `Promote ${eligibleRows.length} merchant ${FIELD_LABELS[field]} values to catalog (where catalog is currently empty)?`,
      )
    ) {
      return
    }

    setBulkRunning(true)
    setBulkResult(null)
    setActionError(null)

    try {
      const { promoted, errors } = await bulkPromoteEmptyCatalogFields(
        eligibleRows.map((r) => ({
          catalog_product_id: r.catalog_product_id!,
          merchant_value: r.merchant_value!,
          merchant_product_id: r.merchant_product_id,
        })),
        field,
        selectedMerchantId,
        operatorEmail,
      )
      setBulkResult(
        errors.length === 0
          ? `Promoted ${promoted} rows.`
          : `Promoted ${promoted} rows. ${errors.length} errors: ${errors.slice(0, 3).join('; ')}`,
      )
      onMutated()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setBulkRunning(false)
    }
  }

  const showBulkButton =
    ['sku', 'barcode', 'size', 'cost'].includes(filter) &&
    rows.some((r) => r.status === 'merchant_has_value_catalog_missing')

  if (rows.length === 0) {
    return (
      <div>
        {/* Filter bar */}
        <div className="filter-bar">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`filter-bar__btn${filter === opt.key ? ' filter-bar__btn--active' : ''}`}
              onClick={() => onFilterChange(opt.key)}
            >
              {opt.label}
              <span className="filter-bar__count">{countForFilter(opt.key)}</span>
            </button>
          ))}
        </div>
        <div className="dashboard__empty">No diffs for the current filter.</div>
      </div>
    )
  }

  return (
    <div className="diff-table-wrap">
      {/* Filter bar */}
      <div className="filter-bar">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`filter-bar__btn${filter === opt.key ? ' filter-bar__btn--active' : ''}`}
            onClick={() => onFilterChange(opt.key)}
          >
            {opt.label}
            <span className="filter-bar__count">{countForFilter(opt.key)}</span>
          </button>
        ))}
      </div>

      {/* Bulk action row */}
      {showBulkButton && (
        <div className="diff-table-wrap__bulk">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={bulkRunning}
            onClick={handleBulkPromote}
          >
            {bulkRunning
              ? 'Promoting…'
              : `Bulk promote all empty catalog ${FIELD_LABELS[filter as CuratedField]} values`}
          </button>
          {bulkResult && <span className="diff-table-wrap__bulk-result">{bulkResult}</span>}
        </div>
      )}

      {actionError && (
        <div className="diff-table-wrap__error">
          <strong>Action failed:</strong> {actionError}
        </div>
      )}

      {/* Pagination info */}
      <div className="diff-table-wrap__pagination-info">
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of{' '}
        {rows.length} rows
        {totalPages > 1 && (
          <>
            <button
              type="button"
              className="btn btn--neutral btn--sm"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              ← Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--neutral btn--sm"
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next →
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <table className="diff-table">
        <thead>
          <tr>
            <th className="diff-table__th diff-table__th--product">Product</th>
            <th className="diff-table__th diff-table__th--field">Field</th>
            <th className="diff-table__th diff-table__th--catalog">Catalog value</th>
            <th className="diff-table__th diff-table__th--merchant">Merchant value</th>
            <th className="diff-table__th diff-table__th--status">Status</th>
            <th className="diff-table__th diff-table__th--actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const isPending = pendingKey === row.key
            const canPromote =
              row.status !== 'no_catalog_match' &&
              row.catalog_product_id != null &&
              row.merchant_value != null
            const canClear = row.curated_value != null && row.catalog_product_id != null

            return (
              <tr
                key={row.key}
                className={`diff-table__row diff-table__row--${row.status.replace(/_/g, '-')}`}
              >
                <td className="diff-table__td diff-table__td--product" title={row.product_name}>
                  {row.product_name}
                </td>
                <td className="diff-table__td diff-table__td--field">
                  {row.status === 'no_catalog_match' ? (
                    <span className="badge badge--danger">No match</span>
                  ) : (
                    <span className="field-badge">{FIELD_LABELS[row.field]}</span>
                  )}
                </td>
                <td className="diff-table__td diff-table__td--catalog">
                  {row.status === 'no_catalog_match' ? (
                    <span className="diff-table__null">—</span>
                  ) : (
                    <>
                      <span className="diff-table__effective">
                        {row.effective_catalog_value ?? (
                          <span className="diff-table__null">empty</span>
                        )}
                      </span>
                      {row.curated_value && (
                        <span className="diff-table__curated-badge" title="Curated override active">
                          curated
                        </span>
                      )}
                      {row.original_catalog_value && row.curated_value && (
                        <span className="diff-table__original">
                          orig: {row.original_catalog_value}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="diff-table__td diff-table__td--merchant">
                  {row.merchant_value ?? <span className="diff-table__null">—</span>}
                </td>
                <td className="diff-table__td diff-table__td--status">
                  <span className={`badge badge--${statusBadgeVariant(row.status)}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </td>
                <td className="diff-table__td diff-table__td--actions">
                  {canPromote && (
                    <button
                      type="button"
                      className="btn btn--success btn--sm"
                      disabled={isPending}
                      onClick={() => handlePromote(row)}
                    >
                      {isPending ? '…' : 'Promote'}
                    </button>
                  )}
                  {canClear && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      disabled={isPending}
                      onClick={() => handleClear(row)}
                    >
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="diff-table-wrap__pagination-bottom">
          <button
            type="button"
            className="btn btn--neutral btn--sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            ← Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn--neutral btn--sm"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function statusBadgeVariant(status: string): string {
  switch (status) {
    case 'differs':
      return 'warning'
    case 'merchant_has_value_catalog_missing':
      return 'info'
    case 'no_catalog_match':
      return 'danger'
    default:
      return 'neutral'
  }
}
