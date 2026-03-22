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
  isViewingTransaction?: boolean
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
  isViewingTransaction
}: ActionPanelProps): React.JSX.Element {
  const discountAmount = subtotalBeforeDiscount - subtotalDiscounted
  const [menuOpen, setMenuOpen] = useState(false)
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
    <aside
      className="action-panel grid gap-2 overflow-hidden rounded-(--radius) border p-1.5"
      style={{
        gridTemplateRows: 'minmax(7rem, auto) auto auto minmax(12rem, 1fr) auto',
        background: 'var(--bg-surface)',
        borderColor: 'var(--ledger-border)'
      }}
    >
      {/* ── Totals ── */}
      <div
        className="totals-box grid gap-1 content-center overflow-hidden rounded-(--radius) border p-3 text-(--totals-text)"
        style={{ background: 'var(--totals-bg)', borderColor: 'var(--totals-border)' }}
      >
        <div className="flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight">
          <span
            className="uppercase tracking-[0.05rem] font-bold text-(--text-muted)"
            style={{ fontSize: '0.75rem' }}
          >
            Sub-Total
          </span>
          <strong className="text-(--text-primary)">${subtotalBeforeDiscount.toFixed(2)}</strong>
        </div>
        <div className="totals-discount flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight text-(--accent-peach)">
          <span className="uppercase tracking-[0.05rem] font-bold" style={{ fontSize: '0.75rem' }}>
            Discount
          </span>
          <strong>-${discountAmount.toFixed(2)}</strong>
        </div>
        <div className="flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight">
          <span
            className="uppercase tracking-[0.05rem] font-bold text-(--text-muted)"
            style={{ fontSize: '0.75rem' }}
          >
            Tax
          </span>
          <strong className="text-(--text-primary)">${tax.toFixed(2)}</strong>
        </div>
        <div
          className="grand-total flex items-baseline justify-between pt-1 border-t"
          style={{ borderColor: 'var(--totals-border)' }}
        >
          <span className="uppercase tracking-[-0.05rem] text-(--text-label) text-[clamp(1.2rem,2.5vw,1.875rem)] font-black">
            Total
          </span>
          <strong className="text-[clamp(2rem,4vw,3rem)] leading-none">${total.toFixed(2)}</strong>
        </div>
      </div>

      {/* ── Hold / TS Lookup row ── */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="flex p-4 flex-col items-center justify-center gap-1 rounded-(--radius) min-h-14 text-[0.9375rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: '#FBBF24',
            borderColor: '#F59E0B',
            color: '#000000',
            fontFamily: 'var(--font-display)'
          }}
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
          className="relative p-4 flex flex-col items-center justify-center gap-1 rounded-(--radius) min-h-14 text-[0.9375rem] font-black cursor-pointer uppercase tracking-wider border"
          style={{
            background: 'var(--bg-surface-soft)',
            borderColor: 'var(--border-default)',
            color: '#E5E9EB',
            fontFamily: 'var(--font-display)'
          }}
          onClick={onTsLookup}
          data-testid="ts-lookup-btn"
        >
          <svg width="20" height="20" viewBox="0 0 23 23" fill="currentColor" aria-hidden="true">
            <path d="M20.75 22.5L12.875 14.625C12.25 15.125 11.5312 15.5208 10.7188 15.8125C9.90625 16.1042 9.04167 16.25 8.125 16.25C5.85417 16.25 3.93229 15.4635 2.35938 13.8906C0.786458 12.3177 0 10.3958 0 8.125C0 5.85417 0.786458 3.93229 2.35938 2.35938C3.93229 0.786458 5.85417 0 8.125 0C10.3958 0 12.3177 0.786458 13.8906 2.35938C15.4635 3.93229 16.25 5.85417 16.25 8.125C16.25 9.04167 16.1042 9.90625 15.8125 10.7188C15.5208 11.5312 15.125 12.25 14.625 12.875L22.5 20.75L20.75 22.5ZM8.125 13.75C9.6875 13.75 11.0156 13.2031 12.1094 12.1094C13.2031 11.0156 13.75 9.6875 13.75 8.125C13.75 6.5625 13.2031 5.23438 12.1094 4.14062C11.0156 3.04688 9.6875 2.5 8.125 2.5C6.5625 2.5 5.23438 3.04688 4.14062 4.14062C3.04688 5.23438 2.5 6.5625 2.5 8.125C2.5 9.6875 3.04688 11.0156 4.14062 12.1094C5.23438 13.2031 6.5625 13.75 8.125 13.75Z" />
          </svg>
          TS Lookup
          {heldCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-5 h-5 rounded-full bg-(--accent-peach) text-[0.625rem] font-black text-white flex items-center justify-center px-1">
              {heldCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Category dropdown + Size toggle row ── */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0" ref={menuRef}>
          <button
            type="button"
            className="category-dropdown-trigger flex items-center gap-2 w-full min-h-11 px-3 py-1.5 rounded-(--radius) border border-(--border-default) bg-(--bg-surface-soft) text-base font-bold text-(--text-primary) cursor-pointer shadow-(--shadow-xs)"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              ☰
            </span>
            <span className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">
              {activeCategory}
            </span>
            <span className="text-xs opacity-60" aria-hidden="true">
              ▾
            </span>
          </button>

          {menuOpen && (
            <ul
              className="absolute top-full left-0 right-0 z-20 mt-1 p-1 list-none rounded-(--radius) border border-(--border-strong) bg-(--bg-surface) shadow-md max-h-64 overflow-auto"
              role="listbox"
              aria-label="Categories"
            >
              {categories.map((category) => (
                <li
                  key={category}
                  role="option"
                  aria-selected={activeCategory === category}
                  className={cn(
                    'category-dropdown-item flex items-center gap-2 px-3 py-2  text-[0.95rem] font-semibold cursor-pointer',
                    categoryToneMap.get(category) ?? 'category-tone-all',
                    activeCategory === category && 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]'
                  )}
                  onClick={() => handleCategorySelect(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCategorySelect(category)
                  }}
                  tabIndex={0}
                >
                  <span className="w-4.5 text-center font-extrabold text-sm">
                    {activeCategory === category ? '✓' : ''}
                  </span>
                  {category}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-0.5 rounded-(--radius) overflow-hidden">
          <button
            type="button"
            className={cn(
              'grid place-items-center w-10 h-11 border-none cursor-pointer',
              itemSize === 'small'
                ? 'bg-(--bg-surface-soft) text-(--text-primary) shadow-(--shadow-xs) ring-1 ring-(--border-default)'
                : 'bg-(--bg-surface) text-(--text-muted)'
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
              'grid place-items-center w-10 h-11 border-none cursor-pointer',
              itemSize === 'large'
                ? 'bg-(--bg-surface-soft) text-(--text-primary) shadow-(--shadow-xs) ring-1 ring-(--border-default)'
                : 'bg-(--bg-surface) text-(--text-muted)'
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
          'grid content-start gap-2 min-h-48 overflow-auto',
          itemSize === 'small'
            ? 'grid-cols-3 gap-1.5 [@media(min-width:1400px)]:grid-cols-4'
            : 'grid-cols-2'
        )}
      >
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            className={cn(
              'product-pad-btn grid rounded-(--radius) border-none text-left bg-(--btn-bg) cursor-pointer shadow-(--shadow-xs)',
              itemSize === 'small'
                ? 'min-h-14 p-1.5 text-[0.8125rem]'
                : 'min-h-19 p-2 text-[0.9375rem]',
              categoryToneMap.get(product.category) ?? 'category-tone-all'
            )}
            disabled={!!isViewingTransaction}
            onClick={() => addToCart(product)}
          >
            <span>{product.name}</span>
            <strong
              className={cn(
                'justify-self-end',
                itemSize === 'small' ? 'text-base' : 'text-[1.375rem]'
              )}
            >
              ${product.price.toFixed(2)}
            </strong>
          </button>
        ))}
      </div>

      {/* ── Payment row ── */}
      <div
        className="grid grid-cols-3 gap-1.5 mt-1.5 pt-2.5 border-t-2"
        style={{ borderColor: 'var(--ledger-border)' }}
      >
        <button
          type="button"
          className="rounded-(--radius) min-h-16 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-cash-bg)',
            borderColor: 'var(--pay-cash-border)',
            color: 'var(--pay-cash-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0 || !!isViewingTransaction}
          onClick={onCash}
        >
          Cash
        </button>
        <button
          type="button"
          className="rounded-(--radius) min-h-19 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-credit-bg)',
            borderColor: 'var(--pay-credit-border)',
            color: 'var(--pay-credit-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0 || !!isViewingTransaction}
          onClick={onCredit}
        >
          Credit
        </button>
        <button
          type="button"
          className="rounded-(--radius) min-h-19 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-debit-bg)',
            borderColor: 'var(--pay-debit-border)',
            color: 'var(--pay-debit-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0 || !!isViewingTransaction}
          onClick={onDebit}
        >
          Debit
        </button>
        <button
          type="button"
          className="col-span-3 w-full rounded-(--radius) min-h-19 text-[2.25rem] font-black cursor-pointer uppercase tracking-wider border shadow-md disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--btn-success-bg)',
            borderColor: 'var(--btn-success-border)',
            color: 'var(--btn-success-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0 || !!isViewingTransaction}
          onClick={onPay}
        >
          Pay Now
        </button>
      </div>
    </aside>
  )
}
