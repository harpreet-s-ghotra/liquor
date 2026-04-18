import { formatCurrency, formatInteger } from '@renderer/utils/currency'
import type { ClockOutReport } from '@renderer/types/pos'
import './clock-out-report.css'

type ClockOutReportProps = {
  report: ClockOutReport
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${date} ${time}`
}

export function ClockOutReportView({ report }: ClockOutReportProps): React.JSX.Element {
  const { session } = report

  return (
    <div className="clock-out-report" data-testid="clock-out-report">
      {/* Session info */}
      <div className="clock-out-report__session-info">
        <div className="clock-out-report__session-range">
          <span>Started: {formatDateTime(session.started_at)}</span>
          <span>Ended: {session.ended_at ? formatDateTime(session.ended_at) : 'Active'}</span>
        </div>
        <div className="clock-out-report__session-cashiers">
          <span>Opened by: {session.opened_by_cashier_name}</span>
          {session.closed_by_cashier_name && (
            <span>Closed by: {session.closed_by_cashier_name}</span>
          )}
        </div>
      </div>

      {/* Sales by Item Type */}
      {report.sales_by_item_type.length > 0 && (
        <div className="clock-out-report__section">
          <h3 className="clock-out-report__section-title">Sales by Item Type</h3>
          <table className="clock-out-report__table" data-testid="dept-sales-table">
            <thead>
              <tr>
                <th>Item Type</th>
                <th>Transactions</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.sales_by_item_type.map((row) => (
                <tr key={row.item_type_name}>
                  <td>{row.item_type_name}</td>
                  <td>{formatInteger(row.transaction_count)}</td>
                  <td>{formatCurrency(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Breakdown */}
      <div className="clock-out-report__section">
        <h3 className="clock-out-report__section-title">Payment Breakdown</h3>
        <table className="clock-out-report__table" data-testid="payment-breakdown-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cash</td>
              <td>{formatCurrency(report.cash_total)}</td>
            </tr>
            <tr>
              <td>Credit</td>
              <td>{formatCurrency(report.credit_total)}</td>
            </tr>
            <tr>
              <td>Debit</td>
              <td>{formatCurrency(report.debit_total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals Summary */}
      <div className="clock-out-report__section">
        <h3 className="clock-out-report__section-title">Summary</h3>
        <div className="clock-out-report__summary" data-testid="summary-section">
          <div className="clock-out-report__summary-row">
            <span>Total Sales</span>
            <span>{formatInteger(report.total_sales_count)}</span>
          </div>
          <div className="clock-out-report__summary-row">
            <span>Gross Sales</span>
            <span>{formatCurrency(report.gross_sales)}</span>
          </div>
          <div className="clock-out-report__summary-row">
            <span>Tax Collected</span>
            <span>{formatCurrency(report.total_tax_collected)}</span>
          </div>
          <div className="clock-out-report__summary-row">
            <span>Net Sales</span>
            <span>{formatCurrency(report.net_sales)}</span>
          </div>
          <div className="clock-out-report__summary-row">
            <span>Average Transaction</span>
            <span>{formatCurrency(report.average_transaction_value)}</span>
          </div>
        </div>
      </div>

      {/* Refunds */}
      {report.total_refund_count > 0 && (
        <div className="clock-out-report__section">
          <h3 className="clock-out-report__section-title">Refunds</h3>
          <div className="clock-out-report__summary" data-testid="refund-section">
            <div className="clock-out-report__summary-row">
              <span>Refund Count</span>
              <span>{formatInteger(report.total_refund_count)}</span>
            </div>
            <div className="clock-out-report__summary-row">
              <span>Refund Total</span>
              <span>{formatCurrency(report.total_refund_amount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cash Reconciliation */}
      <div className="clock-out-report__section clock-out-report__section--highlight">
        <h3 className="clock-out-report__section-title">Cash Reconciliation</h3>
        <div className="clock-out-report__summary" data-testid="cash-reconciliation">
          <div className="clock-out-report__summary-row">
            <span>Cash Sales</span>
            <span>{formatCurrency(report.cash_total)}</span>
          </div>
          {report.cash_total !== report.expected_cash_at_close && (
            <div className="clock-out-report__summary-row">
              <span>Cash Refunds</span>
              <span>-{formatCurrency(report.cash_total - report.expected_cash_at_close)}</span>
            </div>
          )}
          <div className="clock-out-report__summary-row clock-out-report__summary-row--bold">
            <span>Expected Cash</span>
            <span>{formatCurrency(report.expected_cash_at_close)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
