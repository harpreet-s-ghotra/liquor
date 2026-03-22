import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type {
  CartItem,
  CartLineItem,
  Product,
  TransactionDiscountItem,
  ActiveSpecialPricingRule,
  TransactionDetail
} from '../types/pos'
import type { HeldCartItem, HeldTransaction } from '../../../shared/types'
import {
  applyPromotions,
  buildSpecialPricingMap,
  type SpecialPricingMap
} from '../utils/pricing-engine'

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
  specialPricingMap: SpecialPricingMap
  heldTransactions: HeldTransaction[]
  isHoldLookupOpen: boolean
  viewingTransaction: TransactionDetail | null
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
  selectedCartId: number | null,
  specialPricingMap: SpecialPricingMap = new Map()
): {
  cartLines: CartLineItem[]
  selectedCartItem: CartLineItem | null
  subtotalBeforeDiscount: number
  subtotalDiscounted: number
  tax: number
  total: number
  totalSavings: number
} {
  // Apply promotional pricing first
  const { items: promoCart, promoSavings } = applyPromotions(cart, specialPricingMap)

  const subtotalBeforeDiscount = promoCart.reduce(
    (sum, item) => sum + item.price * item.lineQuantity,
    0
  )

  const subtotalAfterItemDiscount = promoCart.reduce((sum, item) => {
    const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
    // Use promo price when available, otherwise use item price
    const effectivePrice = item.promo ? item.promo.promoUnitPrice : item.price
    const lineBase = effectivePrice * item.lineQuantity
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
    ? [...promoCart, transactionDiscountLine]
    : promoCart

  const selectedCartItem = cartLines.find((item) => item.id === selectedCartId) ?? null

  const subtotalDiscounted = subtotalAfterItemDiscount * (1 - transactionDiscountPercent / 100)

  const tax = (() => {
    const itemDiscountedTax = promoCart.reduce((sum, item) => {
      const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
      const effectivePrice = item.promo ? item.promo.promoUnitPrice : item.price
      const lineBase = effectivePrice * item.lineQuantity
      return sum + lineBase * (1 - itemDiscountRate) * item.tax_rate
    }, 0)
    return itemDiscountedTax * (1 - transactionDiscountPercent / 100)
  })()

  const total = subtotalDiscounted + tax

  const taxBeforeDiscount = promoCart.reduce(
    (sum, item) => sum + item.price * item.lineQuantity * item.tax_rate,
    0
  )
  const totalBeforeDiscount = subtotalBeforeDiscount + taxBeforeDiscount
  const totalSavings = totalBeforeDiscount - total + promoSavings

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
  loadSpecialPricing: () => void
  holdTransaction: () => Promise<void>
  recallHeldTransaction: (held: HeldTransaction) => Promise<void>
  deleteOneHeldTransaction: (held: HeldTransaction) => Promise<void>
  clearAllHeldTransactions: () => Promise<void>
  loadHeldTransactions: () => Promise<void>
  openHoldLookup: () => Promise<void>
  dismissHoldLookup: () => void
  recallTransaction: (txnNumber: string) => Promise<boolean>
  dismissRecalledTransaction: () => void
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
  specialPricingMap: new Map(),
  heldTransactions: [],
  isHoldLookupOpen: false,
  viewingTransaction: null,

  // Setters
  setProducts: (products) => set({ products, productsLoadError: null }),
  setProductsLoadError: (error) => set({ productsLoadError: error }),
  setSearch: (value) => set({ search: value }),
  setQuantity: (value) => set({ quantity: value }),
  setActiveCategory: (value) => set({ activeCategory: value }),
  setSelectedCartId: (id) => set({ selectedCartId: id }),

  // Cart actions
  addToCart: (product) => {
    if (get().viewingTransaction) return
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
    if (get().viewingTransaction) return false
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
    if (get().viewingTransaction) return
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

  clearTransaction: () =>
    set({
      cart: [],
      selectedCartId: null,
      transactionDiscountPercent: 0,
      viewingTransaction: null
    }),

  updateSelectedLineQuantity: (nextQuantity) => {
    if (get().viewingTransaction) return
    const { selectedCartId, cart } = get()
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || nextQuantity < 1) return

    set({
      cart: cart.map((item) =>
        item.id === selectedCartId ? { ...item, lineQuantity: nextQuantity } : item
      )
    })
  },

  updateSelectedLinePrice: (price) => {
    if (get().viewingTransaction) return
    const { selectedCartId, cart } = get()
    if (!selectedCartId || selectedCartId === TRANSACTION_DISCOUNT_ID || price <= 0) return

    set({
      cart: cart.map((item) => (item.id === selectedCartId ? { ...item, price } : item))
    })
  },

  applyDiscount: (percent, scope) => {
    if (get().viewingTransaction) return
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
  },

  loadSpecialPricing: () => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (typeof api?.getActiveSpecialPricing !== 'function') return

    api
      .getActiveSpecialPricing()
      .then((rules: ActiveSpecialPricingRule[]) =>
        set({ specialPricingMap: buildSpecialPricingMap(rules) })
      )
      .catch(() => {
        /* pricing unavailable — cart works without promos */
      })
  },

  holdTransaction: async () => {
    if (get().viewingTransaction) return
    const { cart, transactionDiscountPercent, selectedCartId, specialPricingMap } = get()
    if (cart.length === 0) return

    const api = typeof window !== 'undefined' ? window.api : undefined
    if (!api?.saveHeldTransaction) {
      console.error('[holdTransaction] window.api.saveHeldTransaction is not available')
      return
    }

    try {
      const { subtotalDiscounted, total } = deriveCartTotals(
        cart,
        transactionDiscountPercent,
        selectedCartId,
        specialPricingMap
      )

      const heldItems: HeldCartItem[] = cart.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        price: item.price,
        basePrice: item.basePrice ?? item.price,
        quantity: item.quantity,
        tax_rate: item.tax_rate,
        lineQuantity: item.lineQuantity,
        itemDiscountPercent: item.itemDiscountPercent ?? 0
      }))

      await api.saveHeldTransaction({
        cart: heldItems,
        transactionDiscountPercent,
        subtotal: subtotalDiscounted,
        total
      })

      get().clearTransaction()
      await get().loadHeldTransactions()
    } catch (err) {
      console.error('[holdTransaction] Failed:', err)
    }
  },

  recallHeldTransaction: async (held: HeldTransaction) => {
    try {
      const { cart } = get()

      // Auto-hold the current cart if it has items
      if (cart.length > 0) {
        await get().holdTransaction()
      }

      const heldItems = JSON.parse(held.cart_snapshot) as HeldCartItem[]

      const restoredCart: CartItem[] = heldItems.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        price: item.price,
        basePrice: item.basePrice,
        quantity: item.quantity,
        tax_rate: item.tax_rate,
        lineQuantity: item.lineQuantity,
        itemDiscountPercent: item.itemDiscountPercent
      }))

      const lastId = restoredCart.length > 0 ? restoredCart[restoredCart.length - 1].id : null

      set({
        cart: restoredCart,
        transactionDiscountPercent: held.transaction_discount_percent,
        selectedCartId: lastId,
        isHoldLookupOpen: false
      })

      const api = typeof window !== 'undefined' ? window.api : undefined
      api
        ?.deleteHeldTransaction(held.id)
        .catch((err) => console.error('[recallHeldTransaction] Failed to delete held record:', err))
      await get().loadHeldTransactions()
    } catch (err) {
      console.error('[recallHeldTransaction] Failed:', err)
    }
  },

  deleteOneHeldTransaction: async (held: HeldTransaction) => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (!api?.deleteHeldTransaction) {
      console.error('[deleteOneHeldTransaction] window.api.deleteHeldTransaction is not available')
      return
    }
    try {
      await api.deleteHeldTransaction(held.id)
      await get().loadHeldTransactions()
    } catch (err) {
      console.error('[deleteOneHeldTransaction] Failed:', err)
    }
  },

  clearAllHeldTransactions: async () => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (!api?.clearAllHeldTransactions) {
      console.error(
        '[clearAllHeldTransactions] window.api.clearAllHeldTransactions is not available'
      )
      return
    }
    try {
      await api.clearAllHeldTransactions()
      set({ heldTransactions: [] })
    } catch (err) {
      console.error('[clearAllHeldTransactions] Failed:', err)
    }
  },

  loadHeldTransactions: async () => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (!api?.getHeldTransactions) {
      console.error('[loadHeldTransactions] window.api.getHeldTransactions is not available')
      return
    }
    try {
      const items = await api.getHeldTransactions()
      set({ heldTransactions: items })
    } catch (err) {
      console.error('[loadHeldTransactions] Failed:', err)
    }
  },

  openHoldLookup: async () => {
    await get().loadHeldTransactions()
    set({ isHoldLookupOpen: true })
  },

  dismissHoldLookup: () => set({ isHoldLookupOpen: false }),

  recallTransaction: async (txnNumber: string) => {
    const api = typeof window !== 'undefined' ? window.api : undefined
    if (!api?.getTransactionByNumber) return false

    try {
      const detail = await api.getTransactionByNumber(txnNumber.toUpperCase())
      if (!detail) return false

      const recalledCart: CartItem[] = detail.items.map((item, index) => ({
        id: -(index + 100),
        sku: '',
        name: item.product_name,
        category: '',
        price: item.unit_price,
        quantity: 0,
        tax_rate: 0,
        lineQuantity: item.quantity
      }))

      set({
        cart: recalledCart,
        selectedCartId: null,
        transactionDiscountPercent: 0,
        viewingTransaction: detail,
        search: '',
        quantity: '1'
      })
      return true
    } catch (err) {
      console.error('[recallTransaction] Failed:', err)
      return false
    }
  },

  dismissRecalledTransaction: () => {
    set({
      cart: [],
      selectedCartId: null,
      transactionDiscountPercent: 0,
      viewingTransaction: null
    })
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
  heldTransactions: HeldTransaction[]
  isHoldLookupOpen: boolean
  holdTransaction: () => Promise<void>
  recallHeldTransaction: (held: HeldTransaction) => Promise<void>
  deleteOneHeldTransaction: (held: HeldTransaction) => Promise<void>
  clearAllHeldTransactions: () => Promise<void>
  loadHeldTransactions: () => Promise<void>
  openHoldLookup: () => Promise<void>
  dismissHoldLookup: () => void
  viewingTransaction: TransactionDetail | null
  isViewingTransaction: boolean
  recallTransaction: (txnNumber: string) => Promise<boolean>
  dismissRecalledTransaction: () => void
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
      loadSpecialPricing: s.loadSpecialPricing,
      specialPricingMap: s.specialPricingMap,
      updateSelectedLinePrice: s.updateSelectedLinePrice,
      updateSelectedLineQuantity: s.updateSelectedLineQuantity,
      removeSelectedLine: s.removeSelectedLine,
      setActiveCategory: s.setActiveCategory,
      setQuantity: s.setQuantity,
      setSearch: s.setSearch,
      setSelectedCartId: s.setSelectedCartId,
      heldTransactions: s.heldTransactions,
      isHoldLookupOpen: s.isHoldLookupOpen,
      holdTransaction: s.holdTransaction,
      recallHeldTransaction: s.recallHeldTransaction,
      deleteOneHeldTransaction: s.deleteOneHeldTransaction,
      clearAllHeldTransactions: s.clearAllHeldTransactions,
      loadHeldTransactions: s.loadHeldTransactions,
      openHoldLookup: s.openHoldLookup,
      dismissHoldLookup: s.dismissHoldLookup,
      viewingTransaction: s.viewingTransaction,
      recallTransaction: s.recallTransaction,
      dismissRecalledTransaction: s.dismissRecalledTransaction
    }))
  )

  // Auto-load products and special pricing on mount
  useEffect(() => {
    if (!store.isPreviewMode && store.products.length === 0 && !store.productsLoadError) {
      store.reloadProducts()
    }
    store.loadSpecialPricing()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => deriveCategories(store.products), [store.products])

  const filteredProducts = useMemo(
    () => deriveFilteredProducts(store.products, store.search, store.activeCategory),
    [store.products, store.search, store.activeCategory]
  )

  const totals = useMemo(
    () =>
      deriveCartTotals(
        store.cart,
        store.transactionDiscountPercent,
        store.selectedCartId,
        store.specialPricingMap
      ),
    [store.cart, store.transactionDiscountPercent, store.selectedCartId, store.specialPricingMap]
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
    total: totals.total,
    heldTransactions: store.heldTransactions,
    isHoldLookupOpen: store.isHoldLookupOpen,
    holdTransaction: store.holdTransaction,
    recallHeldTransaction: store.recallHeldTransaction,
    deleteOneHeldTransaction: store.deleteOneHeldTransaction,
    clearAllHeldTransactions: store.clearAllHeldTransactions,
    loadHeldTransactions: store.loadHeldTransactions,
    openHoldLookup: store.openHoldLookup,
    dismissHoldLookup: store.dismissHoldLookup,
    viewingTransaction: store.viewingTransaction,
    isViewingTransaction: store.viewingTransaction !== null,
    recallTransaction: store.recallTransaction,
    dismissRecalledTransaction: store.dismissRecalledTransaction
  }
}
