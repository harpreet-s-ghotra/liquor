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
      className="action-panel grid gap-2 overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-1.5"
      style={{ gridTemplateRows: 'minmax(7rem, auto) auto minmax(12rem, 1fr) auto' }}
    >
      {/* ── Totals ── */}
      <div className="totals-box grid gap-2 content-center overflow-hidden rounded-[var(--radius)] bg-[var(--totals-bg)] p-2 text-[var(--totals-text)]">
        <div className="flex items-center justify-between text-[clamp(1.125rem,1.8vw,1.5rem)] font-semibold leading-tight">
          <span className="text-[clamp(1rem,1.4vw,1.25rem)]">Subtotal</span>
          <strong>${subtotalBeforeDiscount.toFixed(2)}</strong>
        </div>
        <div className="totals-discount flex items-center justify-between text-[clamp(1.125rem,1.8vw,1.5rem)] font-semibold leading-tight text-[var(--accent-peach)]">
          <span className="text-[clamp(1rem,1.4vw,1.25rem)]">Discount</span>
          <strong>-${discountAmount.toFixed(2)}</strong>
        </div>
        <div className="flex items-center justify-between text-[clamp(1.125rem,1.8vw,1.5rem)] font-semibold leading-tight">
          <span className="text-[clamp(1rem,1.4vw,1.25rem)]">Tax</span>
          <strong>${tax.toFixed(2)}</strong>
        </div>
        <div className="grand-total flex items-center justify-between text-[clamp(1.125rem,1.8vw,1.5rem)] font-semibold leading-tight">
          <span className="text-[clamp(1rem,1.4vw,1.25rem)]">Grand Total</span>
          <strong className="text-[clamp(1.625rem,2.6vw,2.5rem)] leading-none">
            ${total.toFixed(2)}
          </strong>
        </div>
      </div>

      {/* ── Category dropdown + Size toggle row ── */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0" ref={menuRef}>
          <button
            type="button"
            className="category-dropdown-trigger flex items-center gap-2 w-full min-h-11 px-3 py-1.5 rounded-(--radius) border-none bg-(--btn-bg) text-base font-bold text-(--btn-text) cursor-pointer shadow-(--shadow-xs)"
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
                    'category-dropdown-item flex items-center gap-2 px-3 py-2  text-[0.95rem] font-semibold text-(--btn-text) cursor-pointer',
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
                ? 'bg-(--btn-bg) text-(--btn-text) shadow-(--shadow-xs)'
                : 'bg-(--bg-surface-soft) text-(--text-muted)'
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
                ? 'bg-(--btn-bg) text-(--btn-text) shadow-(--shadow-xs)'
                : 'bg-(--bg-surface-soft) text-(--text-muted)'
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
              'product-pad-btn grid rounded-(--radius) border-none text-left text-(--btn-text) bg-(--btn-bg) cursor-pointer shadow-(--shadow-xs)',
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
        className="grid grid-cols-3 gap-1.5 mt-1.5 pt-2.5 border-t-2 border-(--border-strong)"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.12))' }}
      >
        <button
          type="button"
          className="rounded-(--radius) border-none min-h-19 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-cash-bg) text-(--pay-cash-text) disabled:opacity-55 disabled:cursor-not-allowed"
          disabled={cartCount === 0}
          onClick={onCash}
        >
          Cash
        </button>
        <button
          type="button"
          className="rounded-(--radius) border-none min-h-19 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-credit-bg) text-(--pay-credit-text) disabled:opacity-55 disabled:cursor-not-allowed"
          disabled={cartCount === 0}
          onClick={onCredit}
        >
          Credit
        </button>
        <button
          type="button"
          className="rounded-(--radius) border-none min-h-19 text-[1.375rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-debit-bg) text-(--pay-debit-text) disabled:opacity-55 disabled:cursor-not-allowed"
          disabled={cartCount === 0}
          onClick={onDebit}
        >
          Debit
        </button>
        <button
          type="button"
          className="col-span-3 w-full rounded-(--radius) border-none min-h-[5.375rem] text-[2.75rem] font-bold cursor-pointer shadow-(--shadow-xs) bg-(--pay-cash-bg) text-(--pay-cash-text) disabled:opacity-55 disabled:cursor-not-allowed"
          disabled={cartCount === 0}
          onClick={onPay}
        >
          Pay
        </button>
      </div>
    </aside>
  )
}
