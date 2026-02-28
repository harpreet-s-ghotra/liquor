import type { CartItem } from '../../types/pos'
import './ticket-panel.css'

type TicketPanelProps = {
  cart: CartItem[]
  quantity: string
  search: string
  selectedCartId: number | null
  setQuantity: (value: string) => void
  setSearch: (value: string) => void
  setSelectedCartId: (id: number) => void
  clearTransaction: () => void
  removeSelectedLine: () => void
}

export function TicketPanel({
  cart,
  quantity,
  search,
  selectedCartId,
  setQuantity,
  setSearch,
  setSelectedCartId,
  clearTransaction,
  removeSelectedLine
}: TicketPanelProps): React.JSX.Element {
  return (
    <section className="ticket-panel">
      <div className="ticket-controls">
        <input
          className="ticket-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search item"
        />
        <input
          className="qty-input"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="numeric"
          placeholder="Qty"
        />
      </div>

      <div className="ticket-table">
        <div className="ticket-header-row">
          <span>#</span>
          <span>Item Info</span>
          <span>Quantity</span>
          <span>Price</span>
        </div>

        <div className="ticket-lines">
          {cart.length === 0 ? (
            <div className="empty-ticket">No items in current transaction</div>
          ) : (
            cart.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`ticket-line ${selectedCartId === item.id ? 'active' : ''}`}
                onClick={() => setSelectedCartId(item.id)}
              >
                <span>{index + 1}</span>
                <span>{item.name}</span>
                <span>{item.lineQuantity}</span>
                <span>${(item.price * item.lineQuantity).toFixed(2)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="ticket-actions">
        <button type="button" className="pos-btn danger" onClick={removeSelectedLine}>
          Delete
        </button>
        <button type="button" className="pos-btn warning" onClick={clearTransaction}>
          Void
        </button>
        <button type="button" className="pos-btn">
          Qty Change
        </button>
        <button type="button" className="pos-btn">
          Price Change
        </button>
      </div>
    </section>
  )
}
