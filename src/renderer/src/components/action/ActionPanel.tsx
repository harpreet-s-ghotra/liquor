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
  onDebit
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
      className="action-panel grid gap-2 overflow-hidden rounded-[var(--radius)] border p-1.5"
      style={{
        gridTemplateRows: 'minmax(7rem, auto) auto minmax(12rem, 1fr) auto',
        background: 'var(--bg-surface)',
        borderColor: 'var(--ledger-border)'
      }}
    >
      {/* ── Totals ── */}
      <div
        className="totals-box grid gap-1 content-center overflow-hidden rounded-[var(--radius)] border p-3 text-[var(--totals-text)]"
        style={{ background: 'var(--totals-bg)', borderColor: 'var(--totals-border)' }}
      >
        <div className="flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight">
          <span
            className="uppercase tracking-[0.05rem] font-bold text-[var(--text-muted)]"
            style={{ fontSize: '0.75rem' }}
          >
            Sub-Total
          </span>
          <strong className="text-[var(--text-primary)]">
            ${subtotalBeforeDiscount.toFixed(2)}
          </strong>
        </div>
        <div className="totals-discount flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight text-[var(--accent-peach)]">
          <span className="uppercase tracking-[0.05rem] font-bold" style={{ fontSize: '0.75rem' }}>
            Discount
          </span>
          <strong>-${discountAmount.toFixed(2)}</strong>
        </div>
        <div className="flex items-center justify-between text-[clamp(0.9rem,1.4vw,1.125rem)] font-semibold leading-tight">
          <span
            className="uppercase tracking-[0.05rem] font-bold text-[var(--text-muted)]"
            style={{ fontSize: '0.75rem' }}
          >
            Tax
          </span>
          <strong className="text-[var(--text-primary)]">${tax.toFixed(2)}</strong>
        </div>
        <div
          className="grand-total flex items-baseline justify-between pt-1 border-t"
          style={{ borderColor: 'var(--totals-border)' }}
        >
          <span className="uppercase tracking-[-0.05rem] text-[var(--text-label)] text-[clamp(1.2rem,2.5vw,1.875rem)] font-black">
            Total
          </span>
          <strong className="text-[clamp(2rem,4vw,3rem)] leading-none">${total.toFixed(2)}</strong>
        </div>
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
                  <span className="w-[1.125rem] text-center font-extrabold text-sm">
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
          className="rounded-[var(--radius)] min-h-19 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-cash-bg)',
            borderColor: 'var(--pay-cash-border)',
            color: 'var(--pay-cash-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0}
          onClick={onCash}
        >
          Cash
        </button>
        <button
          type="button"
          className="rounded-[var(--radius)] min-h-19 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-credit-bg)',
            borderColor: 'var(--pay-credit-border)',
            color: 'var(--pay-credit-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0}
          onClick={onCredit}
        >
          Credit
        </button>
        <button
          type="button"
          className="rounded-[var(--radius)] min-h-19 text-[1.125rem] font-black cursor-pointer uppercase tracking-wider border disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--pay-debit-bg)',
            borderColor: 'var(--pay-debit-border)',
            color: 'var(--pay-debit-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0}
          onClick={onDebit}
        >
          Debit
        </button>
        <button
          type="button"
          className="col-span-3 w-full rounded-[var(--radius)] min-h-[5.375rem] text-[2.25rem] font-black cursor-pointer uppercase tracking-wider border shadow-md disabled:opacity-55 disabled:cursor-not-allowed"
          style={{
            background: 'var(--btn-success-bg)',
            borderColor: 'var(--btn-success-border)',
            color: 'var(--btn-success-text)',
            fontFamily: 'var(--font-display)'
          }}
          disabled={cartCount === 0}
          onClick={onPay}
        >
          Pay Now
        </button>
      </div>
    </aside>
  )
}
