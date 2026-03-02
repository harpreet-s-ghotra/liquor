import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { CartItem, CartLineItem, Product, TransactionDiscountItem } from '../types/pos'

const FAVORITES_CATEGORY = 'Favorites'
const ALL_CATEGORY = 'All'
const TRANSACTION_DISCOUNT_ID = -1
const preferredFavoriteSkus = new Set(['WINE-001', 'BEER-001', 'SPIRIT-001'])

// ── State shape ──

type PosState = {
  products: Product[]
  productsLoadError: string | null
  isPreviewMode: boolean
  cart: CartItem[]
  selectedCartId: number | null
  search: string
  quantity: string
  activeCategory: string
  transactionDiscountPercent: number
}

// ── Pure derivation functions (testable, no hooks) ──

function getFavoriteSkuSet(products: Product[]): Set<string> {
  const configured = products.filter((p) => preferredFavoriteSkus.has(p.sku)).map((p) => p.sku)
  if (configured.length > 0) return new Set(configured)
  return new Set(
    [...products]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 12)
      .map((p) => p.sku)
  )
}

export function deriveCategories(products: Product[]): string[] {
  const categorySet = new Set(products.map((p) => p.category))
  return [FAVORITES_CATEGORY, ...Array.from(categorySet), ALL_CATEGORY]
}

export function deriveFilteredProducts(
  products: Product[],
  search: string,
  activeCategory: string
): Product[] {
  const term = search.trim().toLowerCase()
  const favoriteSkuSet = getFavoriteSkuSet(products)

  return products.filter((product) => {
    const searchMatch =
      term.length === 0 ||
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term)

    if (term.length > 0) return searchMatch

    const categoryMatch =
      activeCategory === ALL_CATEGORY
        ? true
        : activeCategory === FAVORITES_CATEGORY
          ? favoriteSkuSet.has(product.sku)
          : product.category === activeCategory

    return categoryMatch
  })
}

export function deriveCartTotals(
  cart: CartItem[],
  transactionDiscountPercent: number,
  selectedCartId: number | null
): {
  cartLines: CartLineItem[]
  selectedCartItem: CartLineItem | null
  subtotalBeforeDiscount: number
  subtotalDiscounted: number
  tax: number
  total: number
  totalSavings: number
} {
  const subtotalBeforeDiscount = cart.reduce((sum, item) => sum + item.price * item.lineQuantity, 0)

  const subtotalAfterItemDiscount = cart.reduce((sum, item) => {
    const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
    const lineBase = item.price * item.lineQuantity
    return sum + lineBase * (1 - itemDiscountRate)
  }, 0)

  const transactionDiscountAmount = subtotalAfterItemDiscount * (transactionDiscountPercent / 100)

  const transactionDiscountLine: TransactionDiscountItem | null =
    transactionDiscountPercent > 0 && subtotalAfterItemDiscount > 0
      ? {
          id: TRANSACTION_DISCOUNT_ID,
          kind: 'transaction-discount',
          name: `${transactionDiscountPercent.toFixed(0)}% Discount`,
          lineQuantity: 1,
          price: -transactionDiscountAmount,
          discountRate: transactionDiscountPercent
        }
      : null

  const cartLines: CartLineItem[] = transactionDiscountLine
    ? [...cart, transactionDiscountLine]
    : cart

  const selectedCartItem = cartLines.find((item) => item.id === selectedCartId) ?? null

  const subtotalDiscounted = subtotalAfterItemDiscount * (1 - transactionDiscountPercent / 100)

  const tax = (() => {
    const itemDiscountedTax = cart.reduce((sum, item) => {
      const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
      const lineBase = item.price * item.lineQuantity
      return sum + lineBase * (1 - itemDiscountRate) * item.tax_rate
    }, 0)
    return itemDiscountedTax * (1 - transactionDiscountPercent / 100)
  })()

  const total = subtotalDiscounted + tax

  const taxBeforeDiscount = cart.reduce(
    (sum, item) => sum + item.price * item.lineQuantity * item.tax_rate,
    0
  )
  const totalBeforeDiscount = subtotalBeforeDiscount + taxBeforeDiscount
  const totalSavings = totalBeforeDiscount - total

  return {
    cartLines,
    selectedCartItem,
    subtotalBeforeDiscount,
    subtotalDiscounted,
    tax,
    total,
    totalSavings
  }
}

// ── Actions ──

type PosActions = {
  setProducts: (products: Product[]) => void
  setProductsLoadError: (error: string | null) => void
  setSearch: (value: string) => void
  setQuantity: (value: string) => void
  setActiveCategory: (value: string) => void
  setSelectedCartId: (id: number) => void
  addToCart: (product: Product) => void
  addToCartBySku: (sku: string) => boolean
  removeSelectedLine: () => void
  clearTransaction: () => void
  updateSelectedLineQuantity: (nextQuantity: number) => void
  updateSelectedLinePrice: (price: number) => void
  applyDiscount: (percent: number, scope: 'item' | 'transaction') => void
  reloadProducts: () => void
}

// ── Full store type ──

type PosStore = PosState & PosActions

// ── Store factory ──

function getInitialPreviewMode(): boolean {
  const api = typeof window !== 'undefined' ? window.api : undefined
  return typeof api?.getProducts !== 'function'
}

export const usePosStore = create<PosStore>((set, get) => ({
  // State
  products: [],
  productsLoadError: getInitialPreviewMode() ? 'Backend product API is unavailable.' : null,
  isPreviewMode: getInitialPreviewMode(),
  cart: [],
  selectedCartId: null,
  search: '',
  quantity: '1',
  activeCategory: FAVORITES_CATEGORY,
  transactionDiscountPercent: 0,

  // Setters
  setProducts: (products) => set({ products, productsLoadError: null }),
  setProductsLoadError: (error) => set({ productsLoadError: error }),
  setSearch: (value) => set({ search: value }),
  setQuantity: (value) => set({ quantity: value }),
  setActiveCategory: (value) => set({ activeCategory: value }),
  setSelectedCartId: (id) => set({ selectedCartId: id }),

  // Cart actions
  addToCart: (product) => {
    const { quantity, cart } = get()
    const parsedQuantity = Number.parseInt(quantity, 10)
    const lineQuantity = Number.isNaN(parsedQuantity) || parsedQuantity < 1 ? 1 : parsedQuantity

    const existingItem = cart.find((item) => item.id === product.id)
    if (existingItem) {
      set({
        cart: cart.map((item) =>
          item.id === product.id
            ? { ...item, lineQuantity: item.lineQuantity + lineQuantity }
            : item
        ),
        selectedCartId: product.id
      })
    } else {
      set({
        cart: [
          ...cart,
          { ...product, basePrice: product.price, lineQuantity, itemDiscountPercent: 0 }
        ],
        selectedCartId: product.id
      })
    }
  },

  addToCartBySku: (sku) => {
    const term = sku.trim().toLowerCase()
    if (term.length === 0) return false

    const { products } = get()
    const product = products.find((p) => p.sku.toLowerCase() === term)
    if (!product) return false

    get().addToCart(product)
    set({ search: '', quantity: '1' })
    return true
  },

  removeSelectedLine: () => {
    const { selectedCartId, cart } = get()
    if (!selectedCartId) return

    if (selectedCartId === TRANSACTION_DISCOUNT_ID) {
      set({
        transactionDiscountPercent: 0,
        selectedCartId: cart.length > 0 ? cart[cart.length - 1].id : null
      })
      return
    }

    const updatedCart = cart.filter((item) => item.id !== selectedCartId)
    set({
      cart: updatedCart,
      selectedCartId: updatedCart.length > 0 ? updatedCart[updatedCart.length - 1].id : null
    })
  },

  clearTransaction: () => set({ cart: [], selectedCartId: null, transactionDiscountPercent: 0 }),

  updateSelectedLineQuantity: (nextQuantity) => {
    const { selectedCartId, cart } = get()
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || nextQuantity < 1) return

    set({
      cart: cart.map((item) =>
        item.id === selectedCartId ? { ...item, lineQuantity: nextQuantity } : item
      )
    })
  },

  updateSelectedLinePrice: (price) => {
    const { selectedCartId, cart } = get()
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || price <= 0) return

    set({
      cart: cart.map((item) => (item.id === selectedCartId ? { ...item, price } : item))
    })
  },

  applyDiscount: (percent, scope) => {
    const boundedPercent = Math.min(Math.max(percent, 0), 100)

    if (scope === 'transaction') {
      set({ transactionDiscountPercent: boundedPercent })
      return
    }

    const { selectedCartId, cart } = get()
    if (!selectedCartId) return

    set({
      cart: cart.map((item) =>
        item.id === selectedCartId ? { ...item, itemDiscountPercent: boundedPercent } : item
      )
    })
  },

  reloadProducts: () => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (typeof api?.getProducts !== 'function') return

    api
      .getProducts()
      .then((data) => set({ products: data, productsLoadError: null }))
      .catch(() => set({ productsLoadError: 'Unable to load products from backend.' }))
  }
}))

// ── Backward-compatible hook (wraps Zustand so existing consumers don't break) ──

type UsePosScreenState = {
  activeCategory: string
  addToCart: (product: Product) => void
  addToCartBySku: (sku: string) => boolean
  applyDiscount: (percent: number, scope: 'item' | 'transaction') => void
  cart: CartItem[]
  cartLines: CartLineItem[]
  categories: string[]
  clearTransaction: () => void
  filteredProducts: Product[]
  isPreviewMode: boolean
  reloadProducts: () => void
  updateSelectedLinePrice: (price: number) => void
  updateSelectedLineQuantity: (nextQuantity: number) => void
  quantity: string
  removeSelectedLine: () => void
  search: string
  selectedCartId: number | null
  selectedCartItem: CartLineItem | null
  productsLoadError: string | null
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

export function usePosScreen(): UsePosScreenState {
  const store = usePosStore(
    useShallow((s) => ({
      products: s.products,
      productsLoadError: s.productsLoadError,
      isPreviewMode: s.isPreviewMode,
      cart: s.cart,
      selectedCartId: s.selectedCartId,
      search: s.search,
      quantity: s.quantity,
      activeCategory: s.activeCategory,
      transactionDiscountPercent: s.transactionDiscountPercent,
      addToCart: s.addToCart,
      addToCartBySku: s.addToCartBySku,
      applyDiscount: s.applyDiscount,
      clearTransaction: s.clearTransaction,
      reloadProducts: s.reloadProducts,
      updateSelectedLinePrice: s.updateSelectedLinePrice,
      updateSelectedLineQuantity: s.updateSelectedLineQuantity,
      removeSelectedLine: s.removeSelectedLine,
      setActiveCategory: s.setActiveCategory,
      setQuantity: s.setQuantity,
      setSearch: s.setSearch,
      setSelectedCartId: s.setSelectedCartId
    }))
  )

  // Auto-load products on mount (mirrors old useEffect behavior)
  useEffect(() => {
    if (!store.isPreviewMode && store.products.length === 0 && !store.productsLoadError) {
      store.reloadProducts()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => deriveCategories(store.products), [store.products])

  const filteredProducts = useMemo(
    () => deriveFilteredProducts(store.products, store.search, store.activeCategory),
    [store.products, store.search, store.activeCategory]
  )

  const totals = useMemo(
    () => deriveCartTotals(store.cart, store.transactionDiscountPercent, store.selectedCartId),
    [store.cart, store.transactionDiscountPercent, store.selectedCartId]
  )

  return {
    activeCategory: store.activeCategory,
    addToCart: store.addToCart,
    addToCartBySku: store.addToCartBySku,
    applyDiscount: store.applyDiscount,
    cart: store.cart,
    cartLines: totals.cartLines,
    categories,
    clearTransaction: store.clearTransaction,
    filteredProducts,
    isPreviewMode: store.isPreviewMode,
    reloadProducts: store.reloadProducts,
    updateSelectedLinePrice: store.updateSelectedLinePrice,
    updateSelectedLineQuantity: store.updateSelectedLineQuantity,
    quantity: store.quantity,
    productsLoadError: store.productsLoadError,
    removeSelectedLine: store.removeSelectedLine,
    search: store.search,
    selectedCartId: store.selectedCartId,
    selectedCartItem: totals.selectedCartItem,
    setActiveCategory: store.setActiveCategory,
    setQuantity: store.setQuantity,
    setSearch: store.setSearch,
    setSelectedCartId: store.setSelectedCartId,
    subtotalBeforeDiscount: totals.subtotalBeforeDiscount,
    subtotalDiscounted: totals.subtotalDiscounted,
    tax: totals.tax,
    totalSavings: totals.totalSavings,
    transactionDiscountPercent: store.transactionDiscountPercent,
    total: totals.total
  }
}
