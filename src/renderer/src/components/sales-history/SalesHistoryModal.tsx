import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { formatCurrency } from '@renderer/utils/currency'
import { useState, useEffect, useCallback } from 'react'
import type {
  TransactionListFilter,
  TransactionSummary,
  TransactionDetail
} from '../../../../shared/types'

type SalesHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  onRecallTransaction: (txnNumber: string) => void
}

type DatePreset = 'today' | 'week' | 'month' | 'all'

function getDateRange(preset: DatePreset): { from: string | null; to: string | null } {
  if (preset === 'all') return { from: null, to: null }
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  let from: Date
  if (preset === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (preset === 'week') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
  } else {
    from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
  }
  return { from: from.toISOString(), to }
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const startIdx = page * PAGE_SIZE + 1
  const endIdx = Math.min((page + 1) * PAGE_SIZE, totalCount)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[800px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.4)]"
        style={{
          background: 'var(--bg-panel)',
          borderColor: 'var(--border-default)'
        }}
        aria-label="Sales History"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ background: '#2d3133', borderColor: 'var(--border-default)' }}
        >
          <h2 className="text-[15px] font-black text-[#e8ecf0] m-0">Sales History</h2>
          <span className="ml-auto text-[0.75rem] font-bold" style={{ color: 'var(--text-muted)' }}>
            {totalCount} transaction{totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Filters */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b flex-wrap"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <select
            className="px-3 py-2 border text-sm cursor-pointer"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)'
            }}
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            data-testid="sales-history-date-filter"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          <select
            className="px-3 py-2 border text-sm cursor-pointer"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)'
            }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'completed' | 'refund' | '')}
            data-testid="sales-history-status-filter"
          >
            <option value="">All Status</option>
            <option value="completed">Sales Only</option>
            <option value="refund">Refunds Only</option>
          </select>

          <select
            className="px-3 py-2 border text-sm cursor-pointer"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)'
            }}
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
            className="flex-1 px-3 py-2 border text-sm min-w-[180px]"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)'
            }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            data-testid="sales-history-search"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <p
              className="text-center py-12 m-0 text-sm"
              style={{ color: 'var(--text-muted)' }}
              data-testid="sales-history-loading"
            >
              Loading...
            </p>
          ) : transactions.length === 0 ? (
            <p
              className="text-center py-12 m-0 text-sm"
              style={{ color: 'var(--text-muted)' }}
              data-testid="sales-history-empty"
            >
              No transactions found.
            </p>
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
                >
                  <th
                    className="text-left px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    TXN #
                  </th>
                  <th
                    className="text-left px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    Date/Time
                  </th>
                  <th
                    className="text-center px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    Items
                  </th>
                  <th
                    className="text-right px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    Total
                  </th>
                  <th
                    className="text-left px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    Payment
                  </th>
                  <th
                    className="text-center px-4 py-2 font-bold"
                    style={{ color: 'var(--text-label)' }}
                  >
                    Status
                  </th>
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

        {/* Footer / Pagination */}
        {totalCount > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--border-default)', background: '#2d3133' }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              Showing {startIdx}-{endIdx} of {totalCount}
            </span>
            <div className="flex gap-2">
              <AppButton
                variant="neutral"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </AppButton>
              <AppButton
                variant="neutral"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
              >
                Next
              </AppButton>
            </div>
          </div>
        )}
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
        className="border-b cursor-pointer"
        style={{
          borderColor: 'var(--border-soft)',
          background: isRefund
            ? isExpanded
              ? 'rgba(127, 29, 29, 0.25)'
              : 'rgba(127, 29, 29, 0.1)'
            : isExpanded
              ? 'var(--bg-surface-soft)'
              : 'transparent'
        }}
        onClick={onExpand}
        data-testid={`sales-history-row-${txn.id}`}
      >
        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--accent-blue)' }}>
          {txn.transaction_number}
        </td>
        <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
          {formatDateTime(txn.created_at)}
        </td>
        <td
          className="px-4 py-2.5 text-center font-bold"
          style={{ color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-primary)' }}
        >
          {isRefund ? `-${txn.item_count}` : txn.item_count}
        </td>
        <td
          className="px-4 py-2.5 text-right font-bold"
          style={{ color: isRefund ? 'var(--semantic-danger-text)' : 'var(--text-primary)' }}
        >
          {isRefund ? `(${formatCurrency(txn.total)})` : formatCurrency(txn.total)}
        </td>
        <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
          {paymentLabel}
          {cardInfo}
        </td>
        <td className="px-4 py-2.5 text-center">
          <span
            className="inline-block px-2 py-0.5 text-xs font-bold rounded"
            style={{
              background: isRefund ? 'rgba(127, 29, 29, 0.4)' : 'rgba(6, 78, 59, 0.4)',
              color: isRefund ? '#fca5a5' : '#86efac'
            }}
          >
            {isRefund ? 'Refund' : 'Sale'}
          </span>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td
            colSpan={6}
            className="px-6 py-3 border-b"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-soft)'
            }}
          >
            {expandedDetail ? (
              <div className="flex flex-col gap-2">
                {/* Line items */}
                <table
                  className="w-full text-xs"
                  style={{ borderCollapse: 'collapse' }}
                  data-testid="sales-history-detail-items"
                >
                  <thead>
                    <tr>
                      <th
                        className="text-left pb-1 font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Product
                      </th>
                      <th
                        className="text-center pb-1 font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Qty
                      </th>
                      <th
                        className="text-right pb-1 font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Unit Price
                      </th>
                      <th
                        className="text-right pb-1 font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedDetail.items.map((item) => {
                      const refundColor = 'var(--semantic-danger-text)'
                      return (
                        <tr key={item.id}>
                          <td className="py-1" style={{ color: 'var(--text-primary)' }}>
                            {item.product_name}
                          </td>
                          <td
                            className="py-1 text-center font-bold"
                            style={isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }}
                          >
                            {isRefund ? `-${item.quantity}` : item.quantity}
                          </td>
                          <td
                            className="py-1 text-right"
                            style={isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }}
                          >
                            {isRefund
                              ? `(${formatCurrency(item.unit_price)})`
                              : formatCurrency(item.unit_price)}
                          </td>
                          <td
                            className="py-1 text-right font-bold"
                            style={isRefund ? { color: refundColor } : { color: 'var(--text-primary)' }}
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
                <div
                  className="flex items-center gap-4 pt-2 border-t text-xs"
                  style={{ borderColor: 'var(--border-soft)' }}
                >
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
                    className="font-bold"
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
                {txn.notes && (
                  <p className="text-xs m-0 pt-1" style={{ color: 'var(--text-muted)' }}>
                    {txn.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
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
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Loading details...
              </span>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
