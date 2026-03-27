import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { formatCurrency } from '@renderer/utils/currency'
import { cn } from '@renderer/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import type {
  TransactionListFilter,
  TransactionSummary,
  TransactionDetail
} from '../../../../shared/types'
import './sales-history-modal.css'

type SalesHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  onRecallTransaction: (txnNumber: string) => void
}

type DatePreset = 'today' | 'yesterday' | 'last2days' | 'week' | 'month' | 'all'

function getDateRange(preset: DatePreset): { from: string | null; to: string | null } {
  if (preset === 'all') return { from: null, to: null }
  const now = new Date()
  let from: Date
  let to: Date
  if (preset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  } else if (preset === 'yesterday') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
  } else if (preset === 'last2days') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  } else if (preset === 'week') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const PAGE_SIZE = 25

export function SalesHistoryModal({
  isOpen,
  onClose,
  onRecallTransaction
}: SalesHistoryModalProps): React.JSX.Element {
  const [transactions, setTransactions] = useState<TransactionSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [statusFilter, setStatusFilter] = useState<'completed' | 'refund' | ''>('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<TransactionDetail | null>(null)

  const loadTransactions = useCallback(async () => {
    if (!window.api?.listTransactions) return
    setLoading(true)
    try {
      const range = getDateRange(datePreset)
      const filter: TransactionListFilter = {
        date_from: range.from,
        date_to: range.to,
        status: statusFilter || null,
        payment_method: paymentFilter || null,
        search: searchText || null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      }
      const result = await window.api.listTransactions(filter)
      setTransactions(result.transactions)
      setTotalCount(result.total_count)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [datePreset, statusFilter, paymentFilter, searchText, page])

  useEffect(() => {
    if (isOpen) {
      loadTransactions()
    }
  }, [isOpen, loadTransactions])

  useEffect(() => {
    if (isOpen) {
      setPage(0)
    }
  }, [isOpen, datePreset, statusFilter, paymentFilter, searchText])

  const handleExpand = useCallback(
    async (txn: TransactionSummary) => {
      if (expandedId === txn.id) {
        setExpandedId(null)
        setExpandedDetail(null)
        return
      }
      setExpandedId(txn.id)
      if (window.api?.getTransactionByNumber) {
        try {
          const detail = await window.api.getTransactionByNumber(txn.transaction_number)
          setExpandedDetail(detail)
        } catch {
          setExpandedDetail(null)
        }
      }
    },
    [expandedId]
  )

  const handleRecall = useCallback(
    (txnNumber: string) => {
      onRecallTransaction(txnNumber)
      onClose()
    },
    [onRecallTransaction, onClose]
  )

  const hasActiveFilters =
    datePreset !== 'today' || statusFilter !== '' || paymentFilter !== '' || searchText !== ''

  const clearFilters = (): void => {
    setDatePreset('today')
    setStatusFilter('')
    setPaymentFilter('')
    setSearchText('')
    setPage(0)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const startIdx = page * PAGE_SIZE + 1
  const endIdx = Math.min((page + 1) * PAGE_SIZE, totalCount)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sales-history" aria-label="Sales History">
        {/* Header */}
        <div className="sales-history__header">
          <h2 className="sales-history__title">Sales History</h2>
          <span className="sales-history__count">
            {totalCount} transaction{totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <div className="sales-history__filters">
          <select
            className="sales-history__filter"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            data-testid="sales-history-date-filter"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last2days">Last 2 Days</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          <select
            className="sales-history__filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'completed' | 'refund' | '')}
            data-testid="sales-history-status-filter"
          >
            <option value="">All Status</option>
            <option value="completed">Sales Only</option>
            <option value="refund">Refunds Only</option>
          </select>

          <select
            className="sales-history__filter"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            data-testid="sales-history-payment-filter"
          >
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>

          <input
            type="text"
            placeholder="Search TXN # or product..."
            className="sales-history__search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            data-testid="sales-history-search"
          />

          {hasActiveFilters && (
            <AppButton
              variant="neutral"
              size="sm"
              onClick={clearFilters}
              data-testid="sales-history-clear-filters"
            >
              Clear Filters
            </AppButton>
          )}
        </div>

        {/* Table */}
        <div className="sales-history__table-wrap">
          {loading ? (
            <p className="sales-history__loading" data-testid="sales-history-loading">
              Loading...
            </p>
          ) : transactions.length === 0 ? (
            <p className="sales-history__empty" data-testid="sales-history-empty">
              No transactions found.
            </p>
          ) : (
            <table className="sales-history__table">
              <thead>
                <tr>
                  <th>TXN #</th>
                  <th>Date/Time</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isRefund = txn.status === 'refund'
                  const isExpanded = expandedId === txn.id
                  return (
                    <TransactionRow
                      key={txn.id}
                      txn={txn}
                      isRefund={isRefund}
                      isExpanded={isExpanded}
                      expandedDetail={isExpanded ? expandedDetail : null}
                      onExpand={() => handleExpand(txn)}
                      onRecall={handleRecall}
                    />
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination — always rendered to keep modal height stable */}
        <div className="sales-history__footer">
          <span className="sales-history__footer-info">
            {totalCount > 0 ? `Showing ${startIdx}-${endIdx} of ${totalCount}` : ''}
          </span>
          <div className="sales-history__footer-nav">
            <AppButton
              variant="neutral"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || totalCount === 0}
            >
              Prev
            </AppButton>
            <AppButton
              variant="neutral"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages || totalCount === 0}
            >
              Next
            </AppButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Transaction Row (with expandable detail) ──

type TransactionRowProps = {
  txn: TransactionSummary
  isRefund: boolean
  isExpanded: boolean
  expandedDetail: TransactionDetail | null
  onExpand: () => void
  onRecall: (txnNumber: string) => void
}

function TransactionRow({
  txn,
  isRefund,
  isExpanded,
  expandedDetail,
  onExpand,
  onRecall
}: TransactionRowProps): React.JSX.Element {
  const paymentLabel = txn.payment_method || '-'
  const cardInfo =
    txn.card_type && txn.card_last_four ? ` (${txn.card_type} ****${txn.card_last_four})` : ''

  return (
    <>
      <tr
        className={cn(
          'sales-history__row',
          isRefund && 'sales-history__row--refund',
          isExpanded && 'sales-history__row--expanded'
        )}
        onClick={onExpand}
        data-testid={`sales-history-row-${txn.id}`}
      >
        <td className="sales-history__txn-number">{txn.transaction_number}</td>
        <td style={{ color: 'var(--text-primary)' }}>{formatDateTime(txn.created_at)}</td>
        <td style={{ color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-primary)' }}>
          {isRefund ? `-${txn.item_count}` : txn.item_count}
        </td>
        <td style={{ color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-primary)' }}>
          {isRefund ? `(${formatCurrency(txn.total)})` : formatCurrency(txn.total)}
        </td>
        <td style={{ color: 'var(--text-primary)' }}>
          {paymentLabel}
          {cardInfo}
        </td>
        <td style={{ textAlign: 'center' }}>
          <span
            className={cn(
              'sales-history__badge',
              isRefund ? 'sales-history__badge--refund' : 'sales-history__badge--sale'
            )}
          >
            {isRefund ? 'Refund' : 'Sale'}
          </span>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="sales-history__detail">
            {expandedDetail ? (
              <div className="sales-history__detail-inner">
                {/* Line items */}
                <table
                  className="sales-history__detail-table"
                  data-testid="sales-history-detail-items"
                >
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedDetail.items.map((item) => {
                      const refundColor = 'var(--semantic-danger-text)'
                      return (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-primary)' }}>{item.product_name}</td>
                          <td
                            style={
                              isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }
                            }
                          >
                            {isRefund ? `-${item.quantity}` : item.quantity}
                          </td>
                          <td
                            style={
                              isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }
                            }
                          >
                            {isRefund
                              ? `(${formatCurrency(item.unit_price)})`
                              : formatCurrency(item.unit_price)}
                          </td>
                          <td
                            style={
                              isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }
                            }
                          >
                            {isRefund
                              ? `(${formatCurrency(item.total_price)})`
                              : formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Totals summary */}
                <div className="sales-history__totals-row">
                  <span
                    style={{
                      color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-muted)'
                    }}
                  >
                    Subtotal:{' '}
                    {isRefund
                      ? `(${formatCurrency(expandedDetail.subtotal)})`
                      : formatCurrency(expandedDetail.subtotal)}
                  </span>
                  <span
                    style={{
                      color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-muted)'
                    }}
                  >
                    Tax:{' '}
                    {isRefund
                      ? `(${formatCurrency(expandedDetail.tax_amount)})`
                      : formatCurrency(expandedDetail.tax_amount)}
                  </span>
                  <span
                    className="sales-history__totals-total"
                    style={{
                      color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-primary)'
                    }}
                  >
                    Total:{' '}
                    {isRefund
                      ? `(${formatCurrency(expandedDetail.total)})`
                      : formatCurrency(expandedDetail.total)}
                  </span>
                </div>

                {/* Notes / linked transaction */}
                {txn.notes && <p className="sales-history__notes">{txn.notes}</p>}

                {/* Actions */}
                <div className="sales-history__detail-actions">
                  {!isRefund && (
                    <AppButton
                      variant="warning"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRecall(txn.transaction_number)
                      }}
                      data-testid="sales-history-recall-btn"
                    >
                      Recall for Return
                    </AppButton>
                  )}
                </div>
              </div>
            ) : (
              <span className="sales-history__detail-loading">Loading details...</span>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
