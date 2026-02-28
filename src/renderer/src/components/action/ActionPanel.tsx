import { useMemo } from 'react'
import type { Product } from '../../types/pos'
import './action-panel.css'

type ActionPanelProps = {
  activeCategory: string
  categories: string[]
  cartCount: number
  filteredProducts: Product[]
  setActiveCategory: (value: string) => void
  addToCart: (product: Product) => void
  tax: number
  total: number
}

export function ActionPanel({
  activeCategory,
  categories,
  cartCount,
  filteredProducts,
  setActiveCategory,
  addToCart,
  tax,
  total
}: ActionPanelProps): React.JSX.Element {
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

  return (
    <aside className="action-panel">
      <div className="totals-box">
        <div>
          <span>Tax</span>
          <strong>${tax.toFixed(2)}</strong>
        </div>
        <div className="grand-total">
          <span>Grand Total</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
      </div>

      <div className="category-row">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`category-btn ${categoryToneMap.get(category) ?? 'category-tone-all'} ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="product-pad">
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
        <button type="button" className="pay-btn cash">
          Cash
        </button>
        <button type="button" className="pay-btn card">
          Credit
        </button>
        <button type="button" className="pay-btn card">
          Cards
        </button>
        <button type="button" className="pay-btn pay" disabled={cartCount === 0}>
          Pay
        </button>
      </div>
    </aside>
  )
}
