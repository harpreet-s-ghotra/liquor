import { ActionPanel } from '@renderer/components/action/ActionPanel'
import { BottomShortcutBar } from '@renderer/components/layout/BottomShortcutBar'
import { TicketPanel } from '@renderer/components/ticket/TicketPanel'
import { usePosScreen } from '@renderer/store/usePosScreen'
import '../styles/pos-screen.css'

export function POSScreen(): React.JSX.Element {
  const {
    activeCategory,
    addToCart,
    applyDiscount,
    cart,
    cartLines,
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
    subtotalBeforeDiscount,
    subtotalDiscounted,
    tax,
    totalSavings,
    total,
    transactionDiscountPercent,
    updateSelectedLinePrice,
    updateSelectedLineQuantity
  } = usePosScreen()

  return (
    <div className="pc-pos-layout">
      <main className="pc-main-area">
        <TicketPanel
          cart={cartLines}
          quantity={quantity}
          search={search}
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
        />

        <ActionPanel
          activeCategory={activeCategory}
          categories={categories}
          cartCount={cart.length}
          filteredProducts={filteredProducts}
          setActiveCategory={setActiveCategory}
          addToCart={addToCart}
          subtotalBeforeDiscount={subtotalBeforeDiscount}
          subtotalDiscounted={subtotalDiscounted}
          tax={tax}
          totalSavings={totalSavings}
          total={total}
        />
      </main>

      <BottomShortcutBar />

      {isPreviewMode && <div className="selection-info">Browser preview mode (mock products)</div>}
      {selectedCartItem && (
        <div className="selection-info selection-info-selected">
          Selected: {selectedCartItem.name}
        </div>
      )}
    </div>
  )
}
