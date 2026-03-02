import { InventoryModal } from '@renderer/components/inventory/InventoryModal'
import { PaymentModal } from '@renderer/components/payment/PaymentModal'
import { ActionPanel } from '@renderer/components/action/ActionPanel'
import { BottomShortcutBar } from '@renderer/components/layout/BottomShortcutBar'
import { TicketPanel } from '@renderer/components/ticket/TicketPanel'
import { usePosScreen } from '@renderer/store/usePosScreen'
import { useCallback, useRef, useState } from 'react'
import '../styles/pos-screen.css'
import type { PaymentMethod } from '@renderer/types/pos'

export function POSScreen(): React.JSX.Element {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPaymentComplete, setIsPaymentComplete] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    activeCategory,
    addToCart,
    addToCartBySku,
    applyDiscount,
    cart,
    cartLines,
    categories,
    clearTransaction,
    filteredProducts,
    quantity,
    productsLoadError,
    reloadProducts,
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
    total,
    transactionDiscountPercent,
    updateSelectedLinePrice,
    updateSelectedLineQuantity
  } = usePosScreen()

  const handleInventoryClose = useCallback(() => {
    setIsInventoryOpen(false)
    reloadProducts()
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [reloadProducts])

  const handlePaymentOpen = useCallback(
    (method?: PaymentMethod) => {
      if (cart.length === 0) return
      setPaymentMethod(method)
      setIsPaymentOpen(true)
    },
    [cart.length]
  )

  const handlePaymentComplete = useCallback(() => {
    setIsPaymentOpen(false)
    setIsPaymentComplete(false)
    setPaymentMethod(undefined)
    clearTransaction()
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [clearTransaction])

  const handlePaymentCancel = useCallback(() => {
    setIsPaymentOpen(false)
    setIsPaymentComplete(false)
    setPaymentMethod(undefined)
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const handlePaymentStatusChange = useCallback(
    (status: import('@renderer/types/pos').PaymentStatus) => {
      setIsPaymentComplete(status === 'complete')
    },
    []
  )

  const handleAddToCart = useCallback(
    (product: Parameters<typeof addToCart>[0]) => {
      if (isPaymentComplete) {
        setIsPaymentOpen(false)
        setIsPaymentComplete(false)
        clearTransaction()
      }
      addToCart(product)
      setTimeout(() => searchRef.current?.focus(), 0)
    },
    [addToCart, isPaymentComplete, clearTransaction]
  )

  const handleSearchSubmit = useCallback(() => {
    if (isPaymentComplete) {
      setIsPaymentOpen(false)
      setIsPaymentComplete(false)
      clearTransaction()
    }
    addToCartBySku(search)
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [addToCartBySku, search, isPaymentComplete, clearTransaction])

  return (
    <div className="pc-pos-layout">
      <main className="pc-main-area">
        <TicketPanel
          cart={cartLines}
          quantity={quantity}
          search={search}
          searchRef={searchRef}
          selectedCartId={selectedCartId}
          selectedCartItem={selectedCartItem}
          transactionDiscountPercent={transactionDiscountPercent}
          setQuantity={setQuantity}
          setSearch={setSearch}
          setSelectedCartId={setSelectedCartId}
          clearTransaction={clearTransaction}
          removeSelectedLine={removeSelectedLine}
          applyDiscount={applyDiscount}
          updateSelectedLinePrice={updateSelectedLinePrice}
          updateSelectedLineQuantity={updateSelectedLineQuantity}
          onSearchSubmit={handleSearchSubmit}
        />

        <ActionPanel
          activeCategory={activeCategory}
          categories={categories}
          cartCount={cart.length}
          filteredProducts={filteredProducts}
          setActiveCategory={setActiveCategory}
          addToCart={handleAddToCart}
          subtotalBeforeDiscount={subtotalBeforeDiscount}
          subtotalDiscounted={subtotalDiscounted}
          tax={tax}
          total={total}
          onPay={() => handlePaymentOpen()}
          onCash={() => handlePaymentOpen('cash')}
          onCredit={() => handlePaymentOpen('credit')}
          onDebit={() => handlePaymentOpen('debit')}
        />
      </main>

      <BottomShortcutBar onInventoryClick={() => setIsInventoryOpen(true)} />

      <InventoryModal isOpen={isInventoryOpen} onClose={handleInventoryClose} />

      <PaymentModal
        isOpen={isPaymentOpen}
        total={total}
        initialMethod={paymentMethod}
        onComplete={handlePaymentComplete}
        onCancel={handlePaymentCancel}
        onStatusChange={handlePaymentStatusChange}
      />

      {productsLoadError && <div className="pos-screen-error">{productsLoadError}</div>}
    </div>
  )
}
