import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../../types/pos'
import { cn } from '../../lib/utils'
import './action-panel.css'

type ActionPanelProps = {
  activeCategory: string
  categories: string[]
  cartCount: number
  filteredProducts: Product[]
  setActiveCategory: (value: string) => void
  addToCart: (product: Product) => void
  subtotalBeforeDiscount: number
  subtotalDiscounted: number
  tax: number
  total: number
  onPay: () => void
  onCash: () => void
  onCredit: () => void
  onDebit: () => void
  heldCount: number
  onHold: () => void
  onTsLookup: () => void
  onPrintReceipt: () => void
  onOpenDrawer: () => void
  canPrintReceipt: boolean
  isViewingTransaction?: boolean
  isReturning?: boolean
  isViewingRefund?: boolean
}

type ItemSize = 'small' | 'large'

export function ActionPanel({
  activeCategory,
  categories,
  cartCount,
  filteredProducts,
  setActiveCategory,
  addToCart,
  subtotalBeforeDiscount,
  subtotalDiscounted,
  tax,
  total,
  onPay,
  onCash,
  onCredit,
  onDebit,
  heldCount,
  onHold,
  onTsLookup,
  onPrintReceipt,
  onOpenDrawer,
  canPrintReceipt,
  isViewingTransaction,
  isReturning,
  isViewingRefund
}: ActionPanelProps): React.JSX.Element {
  const discountAmount = subtotalBeforeDiscount - subtotalDiscounted
  const [menuOpen, setMenuOpen] = useState(false)
  const showAsRefund = isReturning || isViewingRefund
  const fmtMoney = (v: number): string =>
    v < 0 ? `($${Math.abs(v).toFixed(2)})` : `$${v.toFixed(2)}`
  const fmtRefundMoney = (v: number): string => `($${Math.abs(v).toFixed(2)})`
  const [itemSize, setItemSize] = useState<ItemSize>('small')
  const menuRef = useRef<HTMLDivElement>(null)

  const categoryToneMap = useMemo(() => {
    const toneCycle = ['category-tone-1', 'category-tone-2', 'category-tone-3', 'category-tone-4']
    const map = new Map<string, string>()
    let categoryIndex = 0

    for (const category of categories) {
      if (category === 'Favorites') {
        map.set(category, 'category-tone-favorite')
      } else if (category === 'All') {
        map.set(category, 'category-tone-all')
      } else {
        map.set(category, toneCycle[categoryIndex % toneCycle.length])
        categoryIndex += 1
      }
    }

    return map
  }, [categories])

  const handleCategorySelect = useCallback(
    (category: string) => {
      setActiveCategory(category)
      setMenuOpen(false)
    },
    [setActiveCategory]
  )

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <aside className="action-panel">
      {/* ── Totals ── */}
      <div className="action-panel__totals totals-box">
        <div className="action-panel__totals-row">
          <span className="action-panel__totals-label">
            {showAsRefund ? 'Refund Sub-Total' : 'Sub-Total'}
          </span>
          <strong
            className={cn(
              'action-panel__totals-value',
              showAsRefund && 'action-panel__totals-value--refund'
            )}
          >
            {showAsRefund
              ? fmtRefundMoney(subtotalBeforeDiscount)
              : fmtMoney(subtotalBeforeDiscount)}
          </strong>
        </div>
        {!showAsRefund && (
          <div className="action-panel__totals-row action-panel__totals-row--discount totals-discount">
            <span className="action-panel__totals-label action-panel__totals-label--discount">
              Discount
            </span>
            <strong>-${discountAmount.toFixed(2)}</strong>
          </div>
        )}
        <div className="action-panel__totals-row">
          <span className="action-panel__totals-label">{showAsRefund ? 'Refund Tax' : 'Tax'}</span>
          <strong
            className={cn(
              'action-panel__totals-value',
              showAsRefund && 'action-panel__totals-value--refund'
            )}
          >
            {showAsRefund ? fmtRefundMoney(tax) : fmtMoney(tax)}
          </strong>
        </div>
        <div className="action-panel__grand-total grand-total">
          <span className="action-panel__grand-total-label">
            {showAsRefund ? 'Refund' : 'Total'}
          </span>
          <strong
            className={cn(
              'action-panel__grand-total-value',
              showAsRefund && 'action-panel__grand-total-value--refund'
            )}
          >
            {showAsRefund ? fmtRefundMoney(total) : fmtMoney(total)}
          </strong>
        </div>
      </div>

      {/* ── Hold / TS Lookup / Print / Drawer row ── */}
      <div className="action-panel__hold-row">
        <button
          type="button"
          className="action-panel__hold-btn"
          disabled={cartCount === 0 || !!isViewingTransaction}
          onClick={onHold}
          data-testid="hold-btn"
        >
          <svg width="20" height="20" viewBox="0 0 25 25" fill="currentColor" aria-hidden="true">
            <path d="M8.75 17.5H11.25V7.5H8.75V17.5ZM13.75 17.5H16.25V7.5H13.75V17.5ZM12.5 25C10.7708 25 9.14583 24.6719 7.625 24.0156C6.10417 23.3594 4.78125 22.4688 3.65625 21.3438C2.53125 20.2188 1.64062 18.8958 0.984375 17.375C0.328125 15.8542 0 14.2292 0 12.5C0 10.7708 0.328125 9.14583 0.984375 7.625C1.64062 6.10417 2.53125 4.78125 3.65625 3.65625C4.78125 2.53125 6.10417 1.64062 7.625 0.984375C9.14583 0.328125 10.7708 0 12.5 0C14.2292 0 15.8542 0.328125 17.375 0.984375C18.8958 1.64062 20.2188 2.53125 21.3438 3.65625C22.4688 4.78125 23.3594 6.10417 24.0156 7.625C24.6719 9.14583 25 10.7708 25 12.5C25 14.2292 24.6719 15.8542 24.0156 17.375C23.3594 18.8958 22.4688 20.2188 21.3438 21.3438C20.2188 22.4688 18.8958 23.3594 17.375 24.0156C15.8542 24.6719 14.2292 25 12.5 25ZM12.5 22.5C15.2917 22.5 17.6562 21.5312 19.5938 19.5938C21.5312 17.6562 22.5 15.2917 22.5 12.5C22.5 9.70833 21.5312 7.34375 19.5938 5.40625C17.6562 3.46875 15.2917 2.5 12.5 2.5C9.70833 2.5 7.34375 3.46875 5.40625 5.40625C3.46875 7.34375 2.5 9.70833 2.5 12.5C2.5 15.2917 3.46875 17.6562 5.40625 19.5938C7.34375 21.5312 9.70833 22.5 12.5 22.5Z" />
          </svg>
          Hold
        </button>
        <button
          type="button"
          className="action-panel__lookup-btn"
          onClick={onTsLookup}
          data-testid="ts-lookup-btn"
        >
          <svg width="20" height="20" viewBox="0 0 23 23" fill="currentColor" aria-hidden="true">
            <path d="M20.75 22.5L12.875 14.625C12.25 15.125 11.5312 15.5208 10.7188 15.8125C9.90625 16.1042 9.04167 16.25 8.125 16.25C5.85417 16.25 3.93229 15.4635 2.35938 13.8906C0.786458 12.3177 0 10.3958 0 8.125C0 5.85417 0.786458 3.93229 2.35938 2.35938C3.93229 0.786458 5.85417 0 8.125 0C10.3958 0 12.3177 0.786458 13.8906 2.35938C15.4635 3.93229 16.25 5.85417 16.25 8.125C16.25 9.04167 16.1042 9.90625 15.8125 10.7188C15.5208 11.5312 15.125 12.25 14.625 12.875L22.5 20.75L20.75 22.5ZM8.125 13.75C9.6875 13.75 11.0156 13.2031 12.1094 12.1094C13.2031 11.0156 13.75 9.6875 13.75 8.125C13.75 6.5625 13.2031 5.23438 12.1094 4.14062C11.0156 3.04688 9.6875 2.5 8.125 2.5C6.5625 2.5 5.23438 3.04688 4.14062 4.14062C3.04688 5.23438 2.5 6.5625 2.5 8.125C2.5 9.6875 3.04688 11.0156 4.14062 12.1094C5.23438 13.2031 6.5625 13.75 8.125 13.75Z" />
          </svg>
          TS Lookup
          {heldCount > 0 && <span className="action-panel__lookup-badge">{heldCount}</span>}
        </button>
        <button
          type="button"
          className="action-panel__hold-row-btn"
          disabled={!canPrintReceipt}
          onClick={onPrintReceipt}
          data-testid="print-receipt-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18 3H6v4h12V3zm1 9c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-3 7H8v-5h8v5zm3-11H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3z" />
          </svg>
          Receipt
        </button>
        <button
          type="button"
          className="action-panel__hold-row-btn"
          onClick={onOpenDrawer}
          data-testid="open-drawer-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H3V6h18v12zm-9-1h2v-4h4v-2h-4V7h-2v4H8v2h4v4z" />
          </svg>
          Drawer
        </button>
      </div>

      {/* ── Category dropdown + Size toggle row ── */}
      <div className="action-panel__category-row">
        <div className="action-panel__category-wrapper" ref={menuRef}>
          <button
            type="button"
            className="action-panel__category-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
          >
            <span className="action-panel__category-trigger-icon" aria-hidden="true">
              ☰
            </span>
            <span className="action-panel__category-trigger-label">{activeCategory}</span>
            <span className="action-panel__category-trigger-arrow" aria-hidden="true">
              ▾
            </span>
          </button>

          {menuOpen && (
            <ul className="action-panel__category-menu" role="listbox" aria-label="Categories">
              {categories.map((category) => (
                <li
                  key={category}
                  role="option"
                  aria-selected={activeCategory === category}
                  className={cn(
                    'action-panel__category-item',
                    categoryToneMap.get(category) ?? 'category-tone-all',
                    activeCategory === category && 'action-panel__category-item--active'
                  )}
                  onClick={() => handleCategorySelect(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCategorySelect(category)
                  }}
                  tabIndex={0}
                >
                  <span className="action-panel__category-check">
                    {activeCategory === category ? '✓' : ''}
                  </span>
                  {category}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="action-panel__size-toggle">
          <button
            type="button"
            className={cn(
              'action-panel__size-btn',
              itemSize === 'small' && 'action-panel__size-btn--active'
            )}
            onClick={() => setItemSize('small')}
            aria-label="Small items"
            title="Small items"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="4.5" height="4.5" rx="1" />
              <rect x="5.75" y="0" width="4.5" height="4.5" rx="1" />
              <rect x="11.5" y="0" width="4.5" height="4.5" rx="1" />
              <rect x="0" y="5.75" width="4.5" height="4.5" rx="1" />
              <rect x="5.75" y="5.75" width="4.5" height="4.5" rx="1" />
              <rect x="11.5" y="5.75" width="4.5" height="4.5" rx="1" />
              <rect x="0" y="11.5" width="4.5" height="4.5" rx="1" />
              <rect x="5.75" y="11.5" width="4.5" height="4.5" rx="1" />
              <rect x="11.5" y="11.5" width="4.5" height="4.5" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className={cn(
              'action-panel__size-btn',
              itemSize === 'large' && 'action-panel__size-btn--active'
            )}
            onClick={() => setItemSize('large')}
            aria-label="Large items"
            title="Large items"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="7" height="7" rx="1" />
              <rect x="9" y="0" width="7" height="7" rx="1" />
              <rect x="0" y="9" width="7" height="7" rx="1" />
              <rect x="9" y="9" width="7" height="7" rx="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Product grid ── */}
      <div
        className={cn(
          'action-panel__product-grid',
          itemSize === 'small'
            ? 'action-panel__product-grid--small'
            : 'action-panel__product-grid--large'
        )}
      >
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            className={cn(
              'action-panel__product-tile',
              itemSize === 'small'
                ? 'action-panel__product-tile--small'
                : 'action-panel__product-tile--large',
              categoryToneMap.get(product.category) ?? 'category-tone-all'
            )}
            disabled={!!isViewingTransaction}
            onClick={() => addToCart(product)}
          >
            <span>{product.name}</span>
            <strong
              className={cn(
                'action-panel__product-price',
                itemSize === 'small'
                  ? 'action-panel__product-price--small'
                  : 'action-panel__product-price--large'
              )}
            >
              ${product.price.toFixed(2)}
            </strong>
          </button>
        ))}
      </div>

      {/* ── Payment row ── */}
      <div className="action-panel__payment-row">
        <button
          type="button"
          className="action-panel__pay-btn"
          style={{
            background: 'var(--pay-cash-bg)',
            borderColor: 'var(--pay-cash-border)',
            color: 'var(--pay-cash-text)'
          }}
          disabled={cartCount === 0 || (!!isViewingTransaction && !isReturning)}
          onClick={onCash}
        >
          {isReturning ? 'Cash Refund' : 'Cash'}
        </button>
        <button
          type="button"
          className="action-panel__pay-btn"
          style={{
            background: 'var(--pay-credit-bg)',
            borderColor: 'var(--pay-credit-border)',
            color: 'var(--pay-credit-text)'
          }}
          disabled={cartCount === 0 || (!!isViewingTransaction && !isReturning)}
          onClick={onCredit}
        >
          {isReturning ? 'Credit Refund' : 'Credit'}
        </button>
        <button
          type="button"
          className="action-panel__pay-btn"
          style={{
            background: 'var(--pay-debit-bg)',
            borderColor: 'var(--pay-debit-border)',
            color: 'var(--pay-debit-text)'
          }}
          disabled={cartCount === 0 || (!!isViewingTransaction && !isReturning)}
          onClick={onDebit}
        >
          {isReturning ? 'Debit Refund' : 'Debit'}
        </button>
        <button
          type="button"
          className="action-panel__pay-btn--main"
          disabled={cartCount === 0 || (!!isViewingTransaction && !isReturning)}
          onClick={onPay}
        >
          {isReturning ? 'Process Refund' : 'Pay Now'}
        </button>
      </div>
    </aside>
  )
}
