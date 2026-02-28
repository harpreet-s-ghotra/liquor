import { useEffect, useMemo, useState } from 'react'
import type { CartItem, CartLineItem, Product, TransactionDiscountItem } from '../types/pos'

const FAVORITES_CATEGORY = 'Favorites'
const ALL_CATEGORY = 'All'
const TRANSACTION_DISCOUNT_ID = -1
const preferredFavoriteSkus = new Set(['WINE-001', 'BEER-001', 'SPIRIT-001'])

type UsePosScreenState = {
  activeCategory: string
  addToCart: (product: Product) => void
  applyDiscount: (percent: number, scope: 'item' | 'transaction') => void
  cart: CartItem[]
  cartLines: CartLineItem[]
  categories: string[]
  clearTransaction: () => void
  filteredProducts: Product[]
  isPreviewMode: boolean
  updateSelectedLinePrice: (price: number) => void
  updateSelectedLineQuantity: (nextQuantity: number) => void
  quantity: string
  removeSelectedLine: () => void
  search: string
  selectedCartId: number | null
  selectedCartItem: CartLineItem | null
  setActiveCategory: (value: string) => void
  setQuantity: (value: string) => void
  setSearch: (value: string) => void
  setSelectedCartId: (id: number) => void
  subtotalBeforeDiscount: number
  subtotalDiscounted: number
  tax: number
  totalSavings: number
  transactionDiscountPercent: number
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
  },
  {
    id: 4,
    sku: 'COOLER-001',
    name: 'Vodka Soda 473ml',
    category: 'Coolers',
    price: 4.25,
    quantity: 96,
    tax_rate: 0.13
  },
  {
    id: 5,
    sku: 'MIXER-001',
    name: 'Tonic Water 1L',
    category: 'Mixers',
    price: 2.99,
    quantity: 52,
    tax_rate: 0.13
  },
  {
    id: 6,
    sku: 'WINE-002',
    name: 'Pinot Noir 750ml',
    category: 'Wine',
    price: 21.99,
    quantity: 22,
    tax_rate: 0.13
  },
  {
    id: 7,
    sku: 'BEER-002',
    name: 'Lager 12-Pack',
    category: 'Beer',
    price: 18.49,
    quantity: 34,
    tax_rate: 0.13
  },
  {
    id: 8,
    sku: 'SPIRIT-002',
    name: 'Silver Tequila 750ml',
    category: 'Spirits',
    price: 36.5,
    quantity: 14,
    tax_rate: 0.13
  },
  {
    id: 9,
    sku: 'COOLER-002',
    name: 'Gin Smash 473ml',
    category: 'Coolers',
    price: 4.5,
    quantity: 88,
    tax_rate: 0.13
  },
  {
    id: 10,
    sku: 'MIXER-002',
    name: 'Club Soda 1L',
    category: 'Mixers',
    price: 2.59,
    quantity: 47,
    tax_rate: 0.13
  },
  {
    id: 11,
    sku: 'WINE-003',
    name: 'Sauvignon Blanc 750ml',
    category: 'Wine',
    price: 17.75,
    quantity: 19,
    tax_rate: 0.13
  },
  {
    id: 12,
    sku: 'BEER-003',
    name: 'Pilsner 6-Pack',
    category: 'Beer',
    price: 12.25,
    quantity: 39,
    tax_rate: 0.13
  },
  {
    id: 13,
    sku: 'SPIRIT-003',
    name: 'London Dry Gin 750ml',
    category: 'Spirits',
    price: 30.99,
    quantity: 17,
    tax_rate: 0.13
  },
  {
    id: 14,
    sku: 'COOLER-003',
    name: 'Whisky Cola 473ml',
    category: 'Coolers',
    price: 4.75,
    quantity: 84,
    tax_rate: 0.13
  },
  {
    id: 15,
    sku: 'MIXER-003',
    name: 'Ginger Ale 1L',
    category: 'Mixers',
    price: 2.79,
    quantity: 60,
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
  const [transactionDiscountPercent, setTransactionDiscountPercent] = useState(0)
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

      return [...currentCart, { ...product, lineQuantity, itemDiscountPercent: 0 }]
    })
  }

  const subtotalBeforeDiscount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.lineQuantity, 0),
    [cart]
  )

  const subtotalAfterItemDiscount = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
        const lineBase = item.price * item.lineQuantity
        return sum + lineBase * (1 - itemDiscountRate)
      }, 0),
    [cart]
  )

  const transactionDiscountAmount = useMemo(
    () => subtotalAfterItemDiscount * (transactionDiscountPercent / 100),
    [subtotalAfterItemDiscount, transactionDiscountPercent]
  )

  const transactionDiscountLine = useMemo<TransactionDiscountItem | null>(() => {
    if (transactionDiscountPercent <= 0 || subtotalAfterItemDiscount <= 0) {
      return null
    }

    return {
      id: TRANSACTION_DISCOUNT_ID,
      kind: 'transaction-discount',
      name: `${transactionDiscountPercent.toFixed(0)}% Discount`,
      lineQuantity: 1,
      price: -transactionDiscountAmount,
      discountRate: transactionDiscountPercent
    }
  }, [subtotalAfterItemDiscount, transactionDiscountAmount, transactionDiscountPercent])

  const cartLines = useMemo<CartLineItem[]>(() => {
    if (!transactionDiscountLine) {
      return cart
    }

    return [...cart, transactionDiscountLine]
  }, [cart, transactionDiscountLine])

  const selectedCartItem = useMemo(
    () => cartLines.find((item) => item.id === selectedCartId) ?? null,
    [cartLines, selectedCartId]
  )

  const removeSelectedLine = (): void => {
    if (!selectedCartId) {
      return
    }

    if (selectedCartId === TRANSACTION_DISCOUNT_ID) {
      setTransactionDiscountPercent(0)
      setSelectedCartId(cart.length > 0 ? cart[cart.length - 1].id : null)
      return
    }

    setCart((currentCart) => {
      const updatedCart = currentCart.filter((item) => item.id !== selectedCartId)
      setSelectedCartId(updatedCart.length > 0 ? updatedCart[updatedCart.length - 1].id : null)
      return updatedCart
    })
  }

  const clearTransaction = (): void => {
    setCart([])
    setSelectedCartId(null)
    setTransactionDiscountPercent(0)
  }

  const updateSelectedLineQuantity = (nextQuantity: number): void => {
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || nextQuantity < 1) {
      return
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === selectedCartId ? { ...item, lineQuantity: nextQuantity } : item
      )
    )
  }

  const updateSelectedLinePrice = (price: number): void => {
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || price <= 0) {
      return
    }

    setCart((currentCart) =>
      currentCart.map((item) => (item.id === selectedCartId ? { ...item, price } : item))
    )
  }

  const applyDiscount = (percent: number, scope: 'item' | 'transaction'): void => {
    const boundedPercent = Math.min(Math.max(percent, 0), 100)

    if (scope === 'transaction') {
      setTransactionDiscountPercent(boundedPercent)
      return
    }

    if (!selectedCartId) {
      return
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === selectedCartId ? { ...item, itemDiscountPercent: boundedPercent } : item
      )
    )
  }

  const subtotalDiscounted = useMemo(
    () => subtotalAfterItemDiscount * (1 - transactionDiscountPercent / 100),
    [subtotalAfterItemDiscount, transactionDiscountPercent]
  )

  const taxBeforeDiscount = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.lineQuantity * item.tax_rate, 0),
    [cart]
  )

  const tax = useMemo(() => {
    const itemDiscountedTax = cart.reduce((sum, item) => {
      const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
      const lineBase = item.price * item.lineQuantity
      return sum + lineBase * (1 - itemDiscountRate) * item.tax_rate
    }, 0)

    return itemDiscountedTax * (1 - transactionDiscountPercent / 100)
  }, [cart, transactionDiscountPercent])

  const total = subtotalDiscounted + tax
  const totalBeforeDiscount = subtotalBeforeDiscount + taxBeforeDiscount
  const totalSavings = totalBeforeDiscount - total

  return {
    activeCategory,
    addToCart,
    applyDiscount,
    cart,
    cartLines,
    categories,
    clearTransaction,
    filteredProducts,
    isPreviewMode,
    updateSelectedLinePrice,
    updateSelectedLineQuantity,
    quantity,
    removeSelectedLine,
    search,
    selectedCartId,
    selectedCartItem,
    setActiveCategory,
    setQuantity,
    setSearch,
    setSelectedCartId,
    subtotalBeforeDiscount,
    subtotalDiscounted,
    tax,
    totalSavings,
    transactionDiscountPercent,
    total
  }
}
