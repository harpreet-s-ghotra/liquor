import { InventoryModal } from '@renderer/components/inventory/InventoryModal'
import { PaymentModal } from '@renderer/components/payment/PaymentModal'
import { SalesHistoryModal } from '@renderer/components/sales-history/SalesHistoryModal'
import { SearchModal } from '@renderer/components/search/SearchModal'
import { ActionPanel } from '@renderer/components/action/ActionPanel'
import { AlertBar } from '@renderer/components/common/AlertBar'
import { HoldLookupModal } from '@renderer/components/hold/HoldLookupModal'
import { BottomShortcutBar } from '@renderer/components/layout/BottomShortcutBar'
import { HeaderBar } from '@renderer/components/layout/HeaderBar'
import { TicketPanel } from '@renderer/components/ticket/TicketPanel'
import { usePosScreen } from '@renderer/store/usePosScreen'
import { useAlertStore } from '@renderer/store/useAlertStore'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/auth.css'
import type { PaymentMethod, PaymentResult } from '@renderer/types/pos'

export function POSScreen(): React.JSX.Element {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [pendingInventoryItemNumber, setPendingInventoryItemNumber] = useState<number | undefined>(
    undefined
  )
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPaymentComplete, setIsPaymentComplete] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)

  const currentCashier = useAuthStore((s) => s.currentCashier)
  const logout = useAuthStore((s) => s.logout)
  const showError = useAlertStore((s) => s.showError)

  // Ctrl+L keyboard shortcut for logout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault()
        logout()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [logout])

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
    updateSelectedLineQuantity,
    heldTransactions,
    isHoldLookupOpen,
    holdTransaction,
    recallHeldTransaction,
    deleteOneHeldTransaction,
    clearAllHeldTransactions,
    loadHeldTransactions,
    openHoldLookup,
    dismissHoldLookup,
    viewingTransaction,
    isViewingTransaction,
    recallTransaction,
    dismissRecalledTransaction,
    returnItems,
    isReturning,
    returnSubtotal,
    returnTax,
    returnTotal,
    toggleReturnItem,
    toggleReturnAll,
    setReturnItemQuantity
  } = usePosScreen()

  // Load held transactions on mount so the badge is accurate on startup
  useEffect(() => {
    loadHeldTransactions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const focusSearch = useCallback(() => {
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const handleHold = useCallback(async () => {
    if (cart.length === 0) return
    await holdTransaction()
    focusSearch()
  }, [cart.length, holdTransaction, focusSearch])

  const handleInventoryClose = useCallback(() => {
    setIsInventoryOpen(false)
    setPendingInventoryItemNumber(undefined)
    reloadProducts()
    focusSearch()
  }, [reloadProducts, focusSearch])

  const handlePaymentOpen = useCallback(
    (method?: PaymentMethod) => {
      if (cart.length === 0) return
      setPaymentMethod(method)
      setIsPaymentOpen(true)
    },
    [cart.length]
  )

  const handlePaymentComplete = useCallback(
    (result: PaymentResult) => {
      // Save transaction to the database (fire-and-forget)
      if (window.api?.saveTransaction && cart.length > 0) {
        const txDiscountMultiplier =
          transactionDiscountPercent > 0 ? 1 - transactionDiscountPercent / 100 : 1

        const lineItems = cart.map((item) => {
          const itemDiscountMultiplier = item.itemDiscountPercent
            ? 1 - item.itemDiscountPercent / 100
            : 1
          const effectiveUnitPrice = item.price * itemDiscountMultiplier * txDiscountMultiplier
          return {
            product_id: item.id,
            product_name: item.name,
            quantity: item.lineQuantity,
            unit_price: Math.round(effectiveUnitPrice * 100) / 100,
            total_price: Math.round(effectiveUnitPrice * item.lineQuantity * 100) / 100
          }
        })

        window.api
          .saveTransaction({
            subtotal: subtotalDiscounted,
            tax_amount: tax,
            total,
            payment_method: result.method,
            stax_transaction_id: result.stax_transaction_id ?? null,
            card_last_four: result.card_last_four ?? null,
            card_type: result.card_type ?? null,
            items: lineItems
          })
          .catch((err) => {
            console.error('Failed to save transaction:', err)
            showError('Failed to save transaction. Please try again.')
          })
      }

      setIsPaymentOpen(false)
      setIsPaymentComplete(false)
      setPaymentMethod(undefined)
      clearTransaction()
      focusSearch()
    },
    [
      cart,
      subtotalDiscounted,
      tax,
      total,
      transactionDiscountPercent,
      clearTransaction,
      focusSearch,
      showError
    ]
  )

  const handleRefundComplete = useCallback(
    (result: PaymentResult) => {
      if (!viewingTransaction || !window.api?.saveRefundTransaction) return

      const refundItems = Object.entries(returnItems)
        .map(([cartItemIdStr, returnQty]) => {
          const cartItemId = Number(cartItemIdStr)
          const cartItem = cart.find((i) => i.id === cartItemId)
          if (!cartItem) return null

          // Recalled cart items have synthetic negative IDs: -(index + 100).
          // Resolve the real product_id from the original transaction line items.
          const originalIndex = -cartItemId - 100
          const originalItem = viewingTransaction.items[originalIndex]
          const realProductId = originalItem?.product_id ?? cartItem.id

          const itemDiscountMultiplier = cartItem.itemDiscountPercent
            ? 1 - cartItem.itemDiscountPercent / 100
            : 1
          const effectiveUnitPrice = cartItem.price * itemDiscountMultiplier
          return {
            product_id: realProductId,
            product_name: cartItem.name,
            quantity: returnQty,
            unit_price: Math.round(effectiveUnitPrice * 100) / 100,
            total_price: Math.round(effectiveUnitPrice * returnQty * 100) / 100
          }
        })
        .filter(Boolean) as {
        product_id: number
        product_name: string
        quantity: number
        unit_price: number
        total_price: number
      }[]

      window.api
        .saveRefundTransaction({
          original_transaction_id: viewingTransaction.id,
          original_transaction_number: viewingTransaction.transaction_number,
          subtotal: Math.abs(returnSubtotal),
          tax_amount: Math.abs(returnTax),
          total: Math.abs(returnTotal),
          payment_method: result.method,
          stax_transaction_id: result.stax_transaction_id ?? null,
          card_last_four: result.card_last_four ?? null,
          card_type: result.card_type ?? null,
          items: refundItems
        })
        .catch((err) => {
          console.error('Failed to save refund transaction:', err)
          showError('Failed to process refund. Please try again.')
        })

      setIsPaymentOpen(false)
      setIsPaymentComplete(false)
      setPaymentMethod(undefined)
      dismissRecalledTransaction()
      focusSearch()
    },
    [
      viewingTransaction,
      returnItems,
      cart,
      returnSubtotal,
      returnTax,
      returnTotal,
      dismissRecalledTransaction,
      focusSearch,
      showError
    ]
  )

  const handlePaymentCancel = useCallback(() => {
    setIsPaymentOpen(false)
    setIsPaymentComplete(false)
    setPaymentMethod(undefined)
    focusSearch()
  }, [focusSearch])

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
      focusSearch()
    },
    [addToCart, isPaymentComplete, clearTransaction, focusSearch]
  )

  const handleSearchSubmit = useCallback(() => {
    if (isPaymentComplete) {
      setIsPaymentOpen(false)
      setIsPaymentComplete(false)
      clearTransaction()
    }
    const trimmed = search.trim()
    if (/^TXN-/i.test(trimmed)) {
      void recallTransaction(trimmed)
      focusSearch()
      return
    }
    addToCartBySku(search)
    focusSearch()
  }, [addToCartBySku, search, isPaymentComplete, clearTransaction, focusSearch, recallTransaction])

  return (
    <div className="grid h-full overflow-hidden" style={{ gridTemplateRows: 'auto auto 1fr auto' }}>
      <HeaderBar cashierName={currentCashier?.name} />
      <AlertBar />
      <main
        className="grid gap-2 p-2 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: '56% 44%' }}
      >
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
          onFocusSearch={focusSearch}
          onSearchClick={() => {
            setSearchKey((k) => k + 1)
            setIsSearchOpen(true)
          }}
          isViewingTransaction={isViewingTransaction}
          viewingTransaction={viewingTransaction}
          onDismissRecall={dismissRecalledTransaction}
          returnItems={returnItems}
          onToggleReturnItem={toggleReturnItem}
          onToggleReturnAll={toggleReturnAll}
          onSetReturnItemQuantity={setReturnItemQuantity}
        />

        <ActionPanel
          activeCategory={activeCategory}
          categories={categories}
          cartCount={cart.length}
          filteredProducts={filteredProducts}
          setActiveCategory={setActiveCategory}
          addToCart={handleAddToCart}
          subtotalBeforeDiscount={
            isReturning
              ? returnSubtotal
              : viewingTransaction
                ? viewingTransaction.subtotal
                : subtotalBeforeDiscount
          }
          subtotalDiscounted={
            isReturning
              ? returnSubtotal
              : viewingTransaction
                ? viewingTransaction.subtotal
                : subtotalDiscounted
          }
          tax={isReturning ? returnTax : viewingTransaction ? viewingTransaction.tax_amount : tax}
          total={isReturning ? returnTotal : viewingTransaction ? viewingTransaction.total : total}
          onPay={() => handlePaymentOpen()}
          onCash={() => handlePaymentOpen('cash')}
          onCredit={() => handlePaymentOpen('credit')}
          onDebit={() => handlePaymentOpen('debit')}
          heldCount={heldTransactions.length}
          onHold={handleHold}
          onTsLookup={openHoldLookup}
          isViewingTransaction={isViewingTransaction}
          isReturning={isReturning}
          isViewingRefund={viewingTransaction?.status === 'refund'}
        />
      </main>

      <BottomShortcutBar
        onInventoryClick={() => setIsInventoryOpen(true)}
        onSalesHistoryClick={() => setIsSalesHistoryOpen(true)}
      />

      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={handleInventoryClose}
        openItemNumber={pendingInventoryItemNumber}
        onRecallTransaction={(txnNumber) => {
          void recallTransaction(txnNumber)
        }}
      />

      <SalesHistoryModal
        isOpen={isSalesHistoryOpen}
        onClose={() => {
          setIsSalesHistoryOpen(false)
          focusSearch()
        }}
        onRecallTransaction={(txnNumber) => {
          void recallTransaction(txnNumber)
        }}
      />

      <SearchModal
        key={searchKey}
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false)
          focusSearch()
        }}
        onAddToCart={(product) => {
          handleAddToCart(product)
        }}
        onOpenInInventory={(product) => {
          setIsSearchOpen(false)
          setPendingInventoryItemNumber(product.id)
          setIsInventoryOpen(true)
        }}
      />

      <HoldLookupModal
        isOpen={isHoldLookupOpen}
        heldTransactions={heldTransactions}
        onRecall={recallHeldTransaction}
        onDelete={deleteOneHeldTransaction}
        onClearAll={clearAllHeldTransactions}
        onClose={dismissHoldLookup}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        total={isReturning ? returnTotal : total}
        initialMethod={paymentMethod}
        onComplete={isReturning ? handleRefundComplete : handlePaymentComplete}
        onCancel={handlePaymentCancel}
        onStatusChange={handlePaymentStatusChange}
        isRefund={isReturning}
      />

      {productsLoadError && (
        <div className="absolute right-3 bottom-18.5 text-[0.8125rem] text-(--semantic-danger-text) bg-(--bg-surface-soft) border border-(--border-soft) rounded-(--radius) px-2 py-1 shadow-sm">
          {productsLoadError}
        </div>
      )}
    </div>
  )
}
