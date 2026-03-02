import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../../types/pos'
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
    <aside className="action-panel">
      <div className="totals-box">
        <div>
          <span>Subtotal</span>
          <strong>${subtotalBeforeDiscount.toFixed(2)}</strong>
        </div>
        <div className="totals-discount">
          <span>Discount</span>
          <strong>-${discountAmount.toFixed(2)}</strong>
        </div>
        <div>
          <span>Tax</span>
          <strong>${tax.toFixed(2)}</strong>
        </div>
        <div className="grand-total">
          <span>Grand Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>

      {/* ── Category dropdown + Size toggle row ── */}
      <div className="category-toolbar">
        <div className="category-dropdown" ref={menuRef}>
          <button
            type="button"
            className="category-dropdown-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
          >
            <span className="burger-icon" aria-hidden="true">
              ☰
            </span>
            <span className="category-dropdown-label">{activeCategory}</span>
            <span className="dropdown-arrow" aria-hidden="true">
              ▾
            </span>
          </button>

          {menuOpen && (
            <ul className="category-dropdown-menu" role="listbox" aria-label="Categories">
              {categories.map((category) => (
                <li
                  key={category}
                  role="option"
                  aria-selected={activeCategory === category}
                  className={`category-dropdown-item ${categoryToneMap.get(category) ?? 'category-tone-all'} ${activeCategory === category ? 'selected' : ''}`}
                  onClick={() => handleCategorySelect(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleCategorySelect(category)
                  }}
                  tabIndex={0}
                >
                  <span className="category-check">{activeCategory === category ? '✓' : ''}</span>
                  {category}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="size-toggle">
          <button
            type="button"
            className={`size-toggle-btn ${itemSize === 'small' ? 'active' : ''}`}
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
            className={`size-toggle-btn ${itemSize === 'large' ? 'active' : ''}`}
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

      <div className={`product-pad ${itemSize === 'small' ? 'product-pad--small' : ''}`}>
        {filteredProducts.map((product) => (
          <button
            key={product.id}
            type="button"
            className={`product-pad-btn ${categoryToneMap.get(product.category) ?? 'category-tone-all'}`}
            onClick={() => addToCart(product)}
          >
            <span>{product.name}</span>
            <strong>${product.price.toFixed(2)}</strong>
          </button>
        ))}
      </div>

      <div className="payment-row">
        <button type="button" className="pay-btn cash" disabled={cartCount === 0} onClick={onCash}>
          Cash
        </button>
        <button
          type="button"
          className="pay-btn card"
          disabled={cartCount === 0}
          onClick={onCredit}
        >
          Credit
        </button>
        <button
          type="button"
          className="pay-btn debit"
          disabled={cartCount === 0}
          onClick={onDebit}
        >
          Debit
        </button>
        <button type="button" className="pay-btn pay" disabled={cartCount === 0} onClick={onPay}>
          Pay
        </button>
      </div>
    </aside>
  )
}
