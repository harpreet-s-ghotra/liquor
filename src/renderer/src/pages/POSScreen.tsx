import { ActionPanel } from '@renderer/components/action/ActionPanel'
import { BottomShortcutBar } from '@renderer/components/layout/BottomShortcutBar'
import { TicketPanel } from '@renderer/components/ticket/TicketPanel'
import { usePosScreen } from '@renderer/store/usePosScreen'
import '../styles/pos-screen.css'

export function POSScreen(): React.JSX.Element {
  const {
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
  } = usePosScreen()

  return (
    <div className="pc-pos-layout">
      <main className="pc-main-area">
        <TicketPanel
          cart={cart}
          quantity={quantity}
          search={search}
          selectedCartId={selectedCartId}
          setQuantity={setQuantity}
          setSearch={setSearch}
          setSelectedCartId={setSelectedCartId}
          clearTransaction={clearTransaction}
          removeSelectedLine={removeSelectedLine}
        />

        <ActionPanel
          activeCategory={activeCategory}
          categories={categories}
          cartCount={cart.length}
          filteredProducts={filteredProducts}
          setActiveCategory={setActiveCategory}
          addToCart={addToCart}
          tax={tax}
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
