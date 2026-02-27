import { useEffect, useMemo, useState } from 'react'

type Product = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  quantity: number
  tax_rate: number
}

type CartItem = Product & {
  lineQuantity: number
}

function App(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api.getProducts().then(setProducts)
  }, [])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return products
    }

    return products.filter((product) => {
      return product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)
    })
  }, [products, search])

  const addToCart = (product: Product): void => {
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id)
      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, lineQuantity: item.lineQuantity + 1 } : item
        )
      }

      return [...currentCart, { ...product, lineQuantity: 1 }]
    })
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.lineQuantity, 0),
    [cart]
  )
  const tax = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.lineQuantity * item.tax_rate, 0),
    [cart]
  )
  const total = subtotal + tax

  return (
    <div className="pos-layout">
      <header className="top-bar">
        <h1>LiquorPOS</h1>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="search-input"
          placeholder="Search by product name or SKU"
        />
      </header>

      <main className="main-content">
        <section className="products-panel">
          <h2>Products</h2>
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <button key={product.id} className="product-card" onClick={() => addToCart(product)}>
                <div className="product-name">{product.name}</div>
                <div className="product-meta">
                  <span>{product.category}</span>
                  <span>{product.sku}</span>
                </div>
                <div className="product-footer">
                  <span>${product.price.toFixed(2)}</span>
                  <span>Stock: {product.quantity}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="cart-panel">
          <h2>Cart</h2>
          <div className="cart-items">
            {cart.length === 0 ? (
              <p className="empty-cart">Add items to begin transaction</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <div className="product-name">{item.name}</div>
                    <div className="cart-detail">
                      {item.lineQuantity} × ${item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="cart-line-total">
                    ${(item.lineQuantity * item.price).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>
            <div>
              <span>Tax</span>
              <strong>${tax.toFixed(2)}</strong>
            </div>
            <div className="total-row">
              <span>Total</span>
              <strong>${total.toFixed(2)}</strong>
            </div>
          </div>
          <button className="complete-sale" type="button">
            Complete Sale
          </button>
        </aside>
      </main>
    </div>
  )
}

export default App
