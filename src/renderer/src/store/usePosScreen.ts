import { useEffect, useMemo, useState } from 'react'
import type { CartItem, Product } from '../types/pos'

const FAVORITES_CATEGORY = 'Favorites'
const ALL_CATEGORY = 'All'
const preferredFavoriteSkus = new Set(['WINE-001', 'BEER-001', 'SPIRIT-001'])

type UsePosScreenState = {
  activeCategory: string
  addToCart: (product: Product) => void
  cart: CartItem[]
  categories: string[]
  clearTransaction: () => void
  filteredProducts: Product[]
  isPreviewMode: boolean
  quantity: string
  removeSelectedLine: () => void
  search: string
  selectedCartId: number | null
  selectedCartItem: CartItem | null
  setActiveCategory: (value: string) => void
  setQuantity: (value: string) => void
  setSearch: (value: string) => void
  setSelectedCartId: (id: number) => void
  tax: number
  total: number
}

const browserPreviewProducts: Product[] = [
  {
    id: 1,
    sku: 'WINE-001',
    name: 'Cabernet Sauvignon 750ml',
    category: 'Wine',
    price: 19.99,
    quantity: 24,
    tax_rate: 0.13
  },
  {
    id: 2,
    sku: 'BEER-001',
    name: 'Craft IPA 6-Pack',
    category: 'Beer',
    price: 13.49,
    quantity: 40,
    tax_rate: 0.13
  },
  {
    id: 3,
    sku: 'SPIRIT-001',
    name: 'Premium Vodka 1L',
    category: 'Spirits',
    price: 32.99,
    quantity: 18,
    tax_rate: 0.13
  }
]

export function usePosScreen(): UsePosScreenState {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const isElectronApiAvailable = typeof api?.getProducts === 'function'

  const [products, setProducts] = useState<Product[]>(
    isElectronApiAvailable ? [] : browserPreviewProducts
  )
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [activeCategory, setActiveCategory] = useState(FAVORITES_CATEGORY)
  const isPreviewMode = !isElectronApiAvailable

  useEffect(() => {
    if (!isElectronApiAvailable) {
      return
    }

    api
      ?.getProducts()
      .then((data) => {
        setProducts(data)
      })
      .catch(() => {
        setProducts(browserPreviewProducts)
      })
  }, [api, isElectronApiAvailable])

  const categories = useMemo(() => {
    const categorySet = new Set(products.map((product) => product.category))
    return [FAVORITES_CATEGORY, ...Array.from(categorySet), ALL_CATEGORY]
  }, [products])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    const configuredFavorites = products
      .filter((product) => preferredFavoriteSkus.has(product.sku))
      .map((product) => product.sku)
    const favoriteSkuSet =
      configuredFavorites.length > 0
        ? new Set(configuredFavorites)
        : new Set(
            [...products]
              .sort((first, second) => second.quantity - first.quantity)
              .slice(0, 12)
              .map((product) => product.sku)
          )

    return products.filter((product) => {
      const searchMatch =
        term.length === 0 ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term)
      const categoryMatch =
        activeCategory === ALL_CATEGORY
          ? true
          : activeCategory === FAVORITES_CATEGORY
            ? favoriteSkuSet.has(product.sku)
            : product.category === activeCategory

      return searchMatch && categoryMatch
    })
  }, [products, search, activeCategory])

  const addToCart = (product: Product): void => {
    const parsedQuantity = Number.parseInt(quantity, 10)
    const lineQuantity = Number.isNaN(parsedQuantity) || parsedQuantity < 1 ? 1 : parsedQuantity
    setSelectedCartId(product.id)

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id)
      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, lineQuantity: item.lineQuantity + lineQuantity }
            : item
        )
      }

      return [...currentCart, { ...product, lineQuantity }]
    })
  }

  const selectedCartItem = useMemo(
    () => cart.find((item) => item.id === selectedCartId) ?? null,
    [cart, selectedCartId]
  )

  const removeSelectedLine = (): void => {
    if (!selectedCartId) {
      return
    }

    setCart((currentCart) => currentCart.filter((item) => item.id !== selectedCartId))
    setSelectedCartId(null)
  }

  const clearTransaction = (): void => {
    setCart([])
    setSelectedCartId(null)
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

  return {
    activeCategory,
    addToCart,
    cart,
    categories,
    clearTransaction,
    filteredProducts,
    isPreviewMode,
    quantity,
    removeSelectedLine,
    search,
    selectedCartId,
    selectedCartItem,
    setActiveCategory,
    setQuantity,
    setSearch,
    setSelectedCartId,
    tax,
    total
  }
}
