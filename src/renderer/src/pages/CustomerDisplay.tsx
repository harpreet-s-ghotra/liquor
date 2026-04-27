import { useEffect, useRef, useState } from 'react'
import type { CustomerDisplaySnapshot } from '../../../shared/types'
// Mirror cashier-side styling so the customer display literally reuses the
// .ticket-panel__table and .action-panel__totals chrome instead of inventing
// its own visual language.
import '../components/ticket/ticket-panel.css'
import '../components/action/action-panel.css'
import './customer-display.css'

const EMPTY_SNAPSHOT: CustomerDisplaySnapshot = {
  cart: [],
  subtotal: 0,
  tax: 0,
  total: 0
}

const fmtMoney = (v: number): string => (v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`)

export function CustomerDisplay(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot>(EMPTY_SNAPSHOT)
  const linesRef = useRef<HTMLDivElement>(null)

  // Design tokens are scoped under [data-theme='light'|'dark']. The cashier's
  // App.tsx sets this attribute; this window never mounts App, so without
  // setting it here every var(--…) resolves to empty and the chrome is unstyled.
  useEffect(() => {
    let theme: 'light' | 'dark' = 'light'
    try {
      const stored = localStorage.getItem('pos-theme')
      if (stored === 'dark' || stored === 'light') theme = stored
    } catch {
      // localStorage unavailable
    }
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  useEffect(() => {
    if (!window.api?.onCustomerSnapshot) return
    const off = window.api.onCustomerSnapshot((next) => {
      setSnapshot(next)
    })
    return off
  }, [])

  // Always keep the latest line in view as items are added.
  useEffect(() => {
    const el = linesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [snapshot.cart.length])

  const showCardTotal =
    snapshot.cardChargeAmount != null &&
    (snapshot.paymentMethod === 'credit' || snapshot.paymentMethod === 'debit')
  const showProcessing = snapshot.paymentStatus === 'processing-card'
  const showComplete = snapshot.paymentStatus === 'complete'
  const surchargeAmount = snapshot.surchargeAmount ?? 0
  const grandTotal = showCardTotal ? (snapshot.cardChargeAmount ?? snapshot.total) : snapshot.total
  const grandTotalLabel = showCardTotal
    ? snapshot.paymentMethod === 'credit'
      ? 'Credit Total'
      : 'Debit Total'
    : 'Total'

  return (
    <div className="customer-display">
      {/* ── Ticket table — exact copy of TicketPanel.tsx structure ── */}
      <section className="ticket-panel customer-display__ticket">
        <div className="ticket-panel__table">
          <div className="ticket-panel__table-header">
            <span className="ticket-panel__table-header-cell" style={{ gridColumn: 'span 1' }}>
              #
            </span>
            <span className="ticket-panel__table-header-cell" style={{ gridColumn: 'span 6' }}>
              Item Description
            </span>
            <span
              className="ticket-panel__table-header-cell ticket-panel__table-header-cell--right"
              style={{ gridColumn: 'span 2' }}
            >
              Qty
            </span>
            <span
              className="ticket-panel__table-header-cell ticket-panel__table-header-cell--right"
              style={{ gridColumn: 'span 3' }}
            >
              Price
            </span>
          </div>

          <div ref={linesRef} className="ticket-panel__lines" data-testid="customer-cart-lines">
            {snapshot.cart.length === 0 ? (
              <div className="ticket-panel__empty">No items in current transaction</div>
            ) : (
              snapshot.cart.map((line, index) => (
                <div
                  key={line.id}
                  className="ticket-panel__line"
                  style={{
                    background: index % 2 === 1 ? 'var(--ledger-row-alt)' : 'var(--ledger-bg)',
                    borderColor: 'var(--ledger-border)',
                    color: 'var(--ledger-line-text)'
                  }}
                >
                  <span
                    className="ticket-panel__line-num"
                    style={{ color: 'var(--ledger-line-muted)' }}
                  >
                    {index + 1}
                  </span>
                  <span className="ticket-panel__line-desc">
                    <span className="ticket-panel__line-name">{line.name}</span>
                  </span>
                  <span className="ticket-panel__line-qty">{line.quantity}</span>
                  <span className="ticket-panel__line-price">{fmtMoney(line.lineTotal)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Totals — exact copy of ActionPanel.tsx totals-box ── */}
      <aside className="action-panel customer-display__totals">
        <div className="action-panel__totals totals-box">
          <div className="action-panel__totals-row">
            <span className="action-panel__totals-label">Sub-Total</span>
            <strong className="action-panel__totals-value">{fmtMoney(snapshot.subtotal)}</strong>
          </div>
          <div className="action-panel__totals-row">
            <span className="action-panel__totals-label">Tax</span>
            <strong className="action-panel__totals-value">{fmtMoney(snapshot.tax)}</strong>
          </div>
          {showCardTotal && surchargeAmount > 0 ? (
            <div
              className="action-panel__totals-row action-panel__totals-row--surcharge"
              data-testid="customer-display-surcharge-row"
            >
              <span className="action-panel__totals-label">
                Card processing fee
                {snapshot.cardSurchargePercent ? ` (${snapshot.cardSurchargePercent}%)` : ''}
              </span>
              <strong className="action-panel__totals-value">{fmtMoney(surchargeAmount)}</strong>
            </div>
          ) : null}
          <div className="action-panel__grand-total grand-total">
            <span className="action-panel__grand-total-label">{grandTotalLabel}</span>
            <strong className="action-panel__grand-total-value">{fmtMoney(grandTotal)}</strong>
          </div>
        </div>

        {showProcessing && (
          <div className="customer-display__status customer-display__status--processing">
            Processing card…
          </div>
        )}
        {showComplete && (
          <div className="customer-display__status customer-display__status--complete">
            Thank you!
            {snapshot.changeDue && snapshot.changeDue > 0
              ? ` Change due: ${fmtMoney(snapshot.changeDue)}`
              : ''}
          </div>
        )}
      </aside>
    </div>
  )
}
