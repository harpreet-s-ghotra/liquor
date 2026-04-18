import { ClockOutModal } from '@renderer/components/clock-out/ClockOutModal'
import { InventoryModal } from '@renderer/components/inventory/InventoryModal'
import { UnpricedItemPrompt } from '@renderer/components/inventory/items/UnpricedItemPrompt'
import { ManagerModal } from '@renderer/components/manager/ManagerModal'
import { PaymentModal } from '@renderer/components/payment/PaymentModal'
import { PrinterSettingsModal } from '@renderer/components/printer/PrinterSettingsModal'
import { ReportsModal } from '@renderer/components/reports/ReportsModal'
import { SalesHistoryModal } from '@renderer/components/sales-history/SalesHistoryModal'
import { SearchModal } from '@renderer/components/search/SearchModal'
import { ActionPanel } from '@renderer/components/action/ActionPanel'
import { AlertBar } from '@renderer/components/common/AlertBar'
import { ErrorModal } from '@renderer/components/common/ErrorModal'
import { HoldLookupModal } from '@renderer/components/hold/HoldLookupModal'
import { BottomShortcutBar } from '@renderer/components/layout/BottomShortcutBar'
import { HeaderBar } from '@renderer/components/layout/HeaderBar'
import { TicketPanel } from '@renderer/components/ticket/TicketPanel'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { usePosScreen } from '@renderer/store/usePosScreen'
import { useAlertStore } from '@renderer/store/useAlertStore'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/auth.css'
import './pos-screen.css'
import type { PaymentMethod, PaymentResult } from '@renderer/types/pos'
import type { Product } from '../../../shared/types'

export function POSScreen(): React.JSX.Element {
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [pendingInventoryItemNumber, setPendingInventoryItemNumber] = useState<number | undefined>(
    undefined
  )
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isPaymentComplete, setIsPaymentComplete] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false)
  const [isClockOutOpen, setIsClockOutOpen] = useState(false)
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false)
  const [isReportsOpen, setIsReportsOpen] = useState(false)
  const [isManagerOpen, setIsManagerOpen] = useState(false)
  const [alwaysPrint, setAlwaysPrint] = useState(false)
  const [searchKey, setSearchKey] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined)
  const [skuError, setSkuError] = useState('')
  const [unpricedProduct, setUnpricedProduct] = useState<Product | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const isRefundingRef = useRef(false)

  const currentCashier = useAuthStore((s) => s.currentCashier)
  const isAdmin = currentCashier?.role === 'admin'
  const merchantConfig = useAuthStore((s) => s.merchantConfig)
  const logout = useAuthStore((s) => s.logout)
  const showError = useAlertStore((s) => s.showError)
  const showInfo = useAlertStore((s) => s.showInfo)
  const showSuccess = useAlertStore((s) => s.showSuccess)

  useEffect(() => {
    if (!window.api?.onUpdateAvailable) return
    window.api.onUpdateAvailable(({ version }) => {
      showInfo(`Downloading update ${version}...`)
    })
    window.api.onUpdateNotAvailable(() => {
      showInfo('You are up to date.')
    })
    window.api.onUpdateDownloaded(({ version }) => {
      showSuccess(`Update ${version} ready — it will install the next time the app is closed.`)
    })
    window.api.onUpdateError(() => {
      showError('Update check failed. Please try again later.')
    })
  }, [showError, showInfo, showSuccess])

  // Keyboard shortcuts: Ctrl/Cmd+L logout and footer F-key actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault()
        logout()
      }
      if (e.key === 'F2' && isAdmin) {
        e.preventDefault()
        setIsInventoryOpen(true)
      }
      if (e.key === 'F3') {
        e.preventDefault()
        setIsClockOutOpen(true)
      }
      if (e.key === 'F5' && isAdmin) {
        e.preventDefault()
        setIsReportsOpen(true)
      }
      if (e.key === 'F6' && isAdmin) {
        e.preventDefault()
        setIsManagerOpen(true)
      }
      if (e.key === 'F7' && isAdmin) {
        e.preventDefault()
        setIsSalesHistoryOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [logout, isAdmin])

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
    setReturnItemQuantity,
    toggleFavoriteProduct
  } = usePosScreen()

  // Load held transactions on mount so the badge is accurate on startup
  useEffect(() => {
    loadHeldTransactions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load alwaysPrint setting on mount
  useEffect(() => {
    void window.api?.getReceiptConfig?.()?.then((cfg) => {
      if (cfg) setAlwaysPrint(cfg.alwaysPrint ?? false)
    })
  }, [])

  const focusSearch = useCallback(() => {
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const handleHold = useCallback(async () => {
    if (cart.length === 0) return
    await holdTransaction()
    focusSearch()
  }, [cart.length, holdTransaction, focusSearch])

  const handlePrintReceipt = useCallback(async () => {
    if (!viewingTransaction) return
    try {
      await window.api?.printReceipt?.({
        transaction_number: viewingTransaction.transaction_number,
        store_name: merchantConfig?.merchant_name ?? 'Liquor Store',
        cashier_name: currentCashier?.name ?? '',
        items: viewingTransaction.items.map((li) => ({
          product_name: li.product_name,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total_price: li.total_price
        })),
        subtotal: viewingTransaction.subtotal,
        tax_amount: viewingTransaction.tax_amount,
        total: viewingTransaction.total,
        payment_method: viewingTransaction.payment_method,
        card_last_four: viewingTransaction.card_last_four ?? null,
        card_type: viewingTransaction.card_type ?? null
      })
    } catch (err) {
      console.error('Receipt print failed:', err)
      showError('Failed to print receipt.')
    }
  }, [viewingTransaction, merchantConfig, currentCashier, showError])

  const handleOpenDrawer = useCallback(async () => {
    try {
      await window.api?.openCashDrawer?.()
    } catch (err) {
      console.error('Cash drawer failed:', err)
      showError('Failed to open cash drawer.')
    }
  }, [showError])

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

        const tendersForSave = result.payments?.map((p) => ({
          method: p.method,
          amount: p.amount,
          card_last_four: p.card_last_four ?? null,
          card_type: p.card_type ?? null,
          finix_authorization_id: p.finix_authorization_id ?? null,
          finix_transfer_id: p.finix_transfer_id ?? null
        }))

        window.api
          .saveTransaction({
            subtotal: subtotalDiscounted,
            tax_amount: tax,
            total,
            payment_method: result.method,
            finix_authorization_id: result.finix_authorization_id ?? null,
            finix_transfer_id: result.finix_transfer_id ?? null,
            card_last_four: result.card_last_four ?? null,
            card_type: result.card_type ?? null,
            payments: tendersForSave,
            items: lineItems
          })
          .then((savedTxn) => {
            if (alwaysPrint || result.shouldPrint) {
              void window.api
                ?.printReceipt?.({
                  transaction_number: savedTxn.transaction_number,
                  store_name: merchantConfig?.merchant_name ?? 'Liquor Store',
                  cashier_name: currentCashier?.name ?? '',
                  items: lineItems.map((li) => ({
                    product_name: li.product_name,
                    quantity: li.quantity,
                    unit_price: li.unit_price,
                    total_price: li.total_price
                  })),
                  subtotal: subtotalDiscounted,
                  subtotal_before_discount:
                    subtotalBeforeDiscount > subtotalDiscounted ? subtotalBeforeDiscount : null,
                  discount_amount:
                    subtotalBeforeDiscount > subtotalDiscounted
                      ? Math.round((subtotalBeforeDiscount - subtotalDiscounted) * 100) / 100
                      : null,
                  tax_amount: tax,
                  total,
                  payment_method: result.method,
                  card_last_four: result.card_last_four ?? null,
                  card_type: result.card_type ?? null,
                  payments: tendersForSave
                })
                ?.catch((err: unknown) => {
                  console.error('Receipt print failed:', err)
                  showError('Transaction saved. Receipt failed to print.')
                })
            }
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
      alwaysPrint,
      cart,
      subtotalBeforeDiscount,
      subtotalDiscounted,
      tax,
      total,
      transactionDiscountPercent,
      merchantConfig,
      currentCashier,
      clearTransaction,
      focusSearch,
      showError
    ]
  )

  const handleRefundComplete = useCallback(
    async (result: PaymentResult) => {
      if (!viewingTransaction || !window.api?.saveRefundTransaction) return
      if (isRefundingRef.current) return
      if (viewingTransaction.has_refund) {
        showError('This transaction has already been refunded.')
        setIsPaymentOpen(false)
        setIsPaymentComplete(false)
        setPaymentMethod(undefined)
        dismissRecalledTransaction()
        return
      }
      isRefundingRef.current = true

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

      try {
        const refundAmountCents = Math.round(Math.abs(returnTotal) * 100)

        if (result.method !== 'cash') {
          const originalTransferId = viewingTransaction.finix_transfer_id
          if (!originalTransferId || !window.api?.finixRefundTransfer) {
            showError(
              'This card refund cannot be sent to Finix because the original transfer ID is missing.'
            )
            return
          }

          await window.api.finixRefundTransfer(originalTransferId, refundAmountCents)
        }

        await window.api.saveRefundTransaction({
          original_transaction_id: viewingTransaction.id,
          original_transaction_number: viewingTransaction.transaction_number,
          subtotal: Math.abs(returnSubtotal),
          tax_amount: Math.abs(returnTax),
          total: Math.abs(returnTotal),
          payment_method: result.method,
          finix_authorization_id: result.finix_authorization_id ?? null,
          finix_transfer_id:
            result.method === 'cash' ? null : (viewingTransaction.finix_transfer_id ?? null),
          card_last_four: result.card_last_four ?? null,
          card_type: result.card_type ?? null,
          items: refundItems
        })

        setIsPaymentOpen(false)
        setIsPaymentComplete(false)
        setPaymentMethod(undefined)
        dismissRecalledTransaction()
        focusSearch()
      } catch (err) {
        console.error('Failed to process refund:', err)
        showError('Failed to process refund. Please try again.')
      } finally {
        isRefundingRef.current = false
      }
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
    if (!trimmed) {
      focusSearch()
      return
    }
    if (/^TXN-/i.test(trimmed)) {
      void recallTransaction(trimmed)
      focusSearch()
      return
    }
    const found = addToCartBySku(search)
    if (!found) {
      // Check if the item exists but has no price set
      void window.api?.findProductBySku?.(trimmed).then((product) => {
        if (product) {
          // Item exists — price is missing
          setSearch('')
          if (isAdmin) {
            // Admin/manager: open inventory to set the price
            setPendingInventoryItemNumber(product.id)
            setIsInventoryOpen(true)
          } else {
            // Cashier: allow one-off price entry
            setUnpricedProduct(product)
          }
        } else {
          setSkuError(`Item "${trimmed}" not found`)
          setSearch('')
        }
        focusSearch()
      })
      return
    }
    focusSearch()
  }, [
    addToCartBySku,
    search,
    isPaymentComplete,
    clearTransaction,
    focusSearch,
    recallTransaction,
    setSearch,
    isAdmin
  ])

  return (
    <div className="pos-screen">
      <HeaderBar
        cashierName={currentCashier?.name}
        cashierRole={currentCashier?.role}
        onPrinterSettings={() => setIsPrinterSettingsOpen(true)}
        onCheckForUpdates={() => window.api?.checkForUpdates()}
      />
      <AlertBar />
      <main className="pos-screen__main" style={{ gridTemplateColumns: '56% 44%' }}>
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
          onToggleFavorite={isAdmin ? (p) => void toggleFavoriteProduct(p.id) : undefined}
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
          onPrintReceipt={handlePrintReceipt}
          onOpenDrawer={handleOpenDrawer}
          canPrintReceipt={!!viewingTransaction}
          isViewingTransaction={isViewingTransaction}
          isReturning={isReturning}
          isViewingRefund={viewingTransaction?.status === 'refund'}
        />
      </main>

      <BottomShortcutBar
        isAdmin={isAdmin}
        onInventoryClick={() => setIsInventoryOpen(true)}
        onClockOutClick={() => setIsClockOutOpen(true)}
        onSalesHistoryClick={() => setIsSalesHistoryOpen(true)}
        onReportsClick={() => setIsReportsOpen(true)}
        onManagerClick={() => setIsManagerOpen(true)}
      />

      <PrinterSettingsModal
        isOpen={isPrinterSettingsOpen}
        onClose={() => {
          setIsPrinterSettingsOpen(false)
          void window.api?.getReceiptConfig?.()?.then((cfg) => {
            if (cfg) setAlwaysPrint(cfg.alwaysPrint ?? false)
          })
        }}
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
        onOpenInInventory={
          isAdmin
            ? (product) => {
                setIsSearchOpen(false)
                setPendingInventoryItemNumber(product.id)
                setIsInventoryOpen(true)
              }
            : undefined
        }
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
        total={isReturning ? Math.abs(returnTotal) : total}
        initialMethod={paymentMethod}
        onComplete={isReturning ? handleRefundComplete : handlePaymentComplete}
        onCancel={handlePaymentCancel}
        onStatusChange={handlePaymentStatusChange}
        isRefund={isReturning}
        alwaysPrint={alwaysPrint}
      />

      <ClockOutModal
        isOpen={isClockOutOpen}
        onClose={() => {
          setIsClockOutOpen(false)
          focusSearch()
        }}
      />

      <ReportsModal
        isOpen={isReportsOpen}
        onClose={() => {
          setIsReportsOpen(false)
          focusSearch()
        }}
      />

      <ManagerModal
        isOpen={isManagerOpen}
        onClose={() => {
          setIsManagerOpen(false)
          focusSearch()
        }}
      />

      <ErrorModal
        isOpen={!!skuError}
        message={skuError}
        onDismiss={() => {
          setSkuError('')
          setTimeout(() => searchRef.current?.focus(), 0)
        }}
      />

      <Dialog open={!!unpricedProduct} onOpenChange={(open) => !open && setUnpricedProduct(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="dialog__sr-only">Item Has No Price</DialogTitle>
          {unpricedProduct && (
            <UnpricedItemPrompt
              product={unpricedProduct}
              onConfirm={(price) => {
                addToCart({ ...unpricedProduct, price })
                setUnpricedProduct(null)
                focusSearch()
              }}
              onCancel={() => {
                setUnpricedProduct(null)
                focusSearch()
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {productsLoadError && <div className="pos-screen__error">{productsLoadError}</div>}
    </div>
  )
}
