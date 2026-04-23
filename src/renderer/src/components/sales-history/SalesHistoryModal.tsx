import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { SalesHistoryIcon } from '@renderer/components/common/modal-icons'
import { AppButton } from '@renderer/components/common/AppButton'
import { formatCurrency } from '@renderer/utils/currency'
import { cn } from '@renderer/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { useAlertStore } from '@renderer/store/useAlertStore'
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

function trackSalesHistoryEvent(event: {
  type: 'error' | 'performance' | 'behavior' | 'system'
  name: string
  payload?: Record<string, unknown>
  sampleRate?: number
}): void {
  if (!window.api?.trackEvent) return
  void window.api.trackEvent(event)
}

export function SalesHistoryModal({
  isOpen,
  onClose,
  onRecallTransaction
}: SalesHistoryModalProps): React.JSX.Element {
  const merchantConfig = useAuthStore((s) => s.merchantConfig)
  const currentCashier = useAuthStore((s) => s.currentCashier)
  const showError = useAlertStore((s) => s.showError)
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
    const startedAt = performance.now()
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
      trackSalesHistoryEvent({
        type: 'performance',
        name: 'sales_history_list_loaded',
        payload: {
          page,
          page_size: PAGE_SIZE,
          row_count: result.transactions.length,
          total_count: result.total_count,
          duration_ms: Math.round((performance.now() - startedAt) * 1000) / 1000,
          date_preset: datePreset,
          status_filter: statusFilter || 'all',
          payment_filter: paymentFilter || 'all',
          has_search: Boolean(searchText)
        },
        sampleRate: 1
      })
    } catch (err) {
      trackSalesHistoryEvent({
        type: 'error',
        name: 'sales_history_list_failed',
        payload: {
          page,
          date_preset: datePreset,
          status_filter: statusFilter || 'all',
          payment_filter: paymentFilter || 'all',
          has_search: Boolean(searchText),
          message: err instanceof Error ? err.message : String(err)
        },
        sampleRate: 1
      })
      console.error('Failed to load transactions:', err)
    } finally {
      setLoading(false)
    }
  }, [datePreset, statusFilter, paymentFilter, searchText, page])

  useEffect(() => {
    if (!isOpen) return
    trackSalesHistoryEvent({
      type: 'behavior',
      name: 'sales_history_opened',
      payload: {
        page,
        date_preset: datePreset,
        status_filter: statusFilter || 'all',
        payment_filter: paymentFilter || 'all'
      },
      sampleRate: 1
    })
  }, [isOpen, page, datePreset, statusFilter, paymentFilter])

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

  const handlePrintReceipt = useCallback(
    async (detail: TransactionDetail) => {
      if (!window.api?.printReceipt) return
      try {
        await window.api.printReceipt({
          transaction_number: detail.transaction_number,
          store_name: merchantConfig?.merchant_name ?? 'Liquor Store',
          cashier_name: currentCashier?.name ?? '',
          items: detail.items.map((li) => ({
            product_name: li.product_name,
            quantity: li.quantity,
            unit_price: li.unit_price,
            total_price: li.total_price
          })),
          subtotal: detail.subtotal,
          tax_amount: detail.tax_amount,
          total: detail.total,
          payment_method: detail.payment_method,
          card_last_four: detail.card_last_four ?? null,
          card_type: detail.card_type ?? null,
          payments: detail.payments.length > 0 ? detail.payments : undefined
        })
      } catch (err) {
        console.error('Receipt print failed:', err)
        showError('Failed to print receipt.')
      }
    },
    [merchantConfig, currentCashier, showError]
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

  const goToPreviousPage = useCallback(() => {
    setPage((current) => {
      const next = Math.max(0, current - 1)
      if (next !== current) {
        trackSalesHistoryEvent({
          type: 'behavior',
          name: 'sales_history_page_changed',
          payload: {
            action: 'prev',
            from_page: current,
            to_page: next,
            total_count: totalCount
          },
          sampleRate: 1
        })
      }
      return next
    })
  }, [totalCount])

  const goToNextPage = useCallback(() => {
    setPage((current) => {
      const next = current + 1
      if (next !== current) {
        trackSalesHistoryEvent({
          type: 'behavior',
          name: 'sales_history_page_changed',
          payload: {
            action: 'next',
            from_page: current,
            to_page: next,
            total_count: totalCount
          },
          sampleRate: 1
        })
      }
      return next
    })
  }, [totalCount])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sales-history"
        aria-label="Sales History"
        aria-describedby={undefined}
      >
        <DialogTitle className="dialog__sr-only">Sales History dialog</DialogTitle>
        <AppModalHeader
          icon={<SalesHistoryIcon />}
          label="Sales"
          title="Sales History"
          onClose={onClose}
          actions={
            <span className="sales-history__count">
              {totalCount} transaction{totalCount !== 1 ? 's' : ''}
            </span>
          }
        />

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
                      onPrint={handlePrintReceipt}
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
              onClick={goToPreviousPage}
              disabled={page === 0 || totalCount === 0}
            >
              Prev
            </AppButton>
            <AppButton
              variant="neutral"
              size="sm"
              onClick={goToNextPage}
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
  onPrint: (detail: TransactionDetail) => void
}

function TransactionRow({
  txn,
  isRefund,
  isExpanded,
  expandedDetail,
  onExpand,
  onRecall,
  onPrint
}: TransactionRowProps): React.JSX.Element {
  const paymentLabel = txn.payment_method === 'split' ? 'Split' : txn.payment_method || '-'
  const cardInfo =
    txn.payment_method !== 'split' && txn.card_type && txn.card_last_four
      ? ` (${txn.card_type} ****${txn.card_last_four})`
      : ''

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

                {/* Payment tenders */}
                {expandedDetail.payments.length > 0 && (
                  <div className="sales-history__tenders" data-testid="sales-history-tenders">
                    {expandedDetail.payments.map((p, i) => {
                      let label = p.method.charAt(0).toUpperCase() + p.method.slice(1)
                      if ((p.method === 'credit' || p.method === 'debit') && p.card_last_four) {
                        const brand = p.card_type
                          ? p.card_type.charAt(0).toUpperCase() + p.card_type.slice(1) + ' '
                          : ''
                        label = `${label} (${brand}****${p.card_last_four})`
                      }
                      return (
                        <span key={i} className="sales-history__tender-entry">
                          {label}: {formatCurrency(p.amount)}
                        </span>
                      )
                    })}
                  </div>
                )}

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
                  <AppButton
                    variant="neutral"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (expandedDetail) onPrint(expandedDetail)
                    }}
                    data-testid="sales-history-print-btn"
                  >
                    Print Receipt
                  </AppButton>
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
