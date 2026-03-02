import { useEffect, useState, useRef } from 'react'
import type { CartItem, CartLineItem } from '../../types/pos'
import './ticket-panel.css'

type EditMode = 'quantity' | 'price' | 'discount' | null

type TicketPanelProps = {
  applyDiscount: (percent: number, scope: 'item' | 'transaction') => void
  cart: CartLineItem[]
  clearTransaction: () => void
  onSearchSubmit?: () => void
  quantity: string
  removeSelectedLine: () => void
  search: string
  searchRef?: React.RefObject<HTMLInputElement | null>
  selectedCartId: number | null
  selectedCartItem: CartLineItem | null
  transactionDiscountPercent: number
  updateSelectedLinePrice: (price: number) => void
  updateSelectedLineQuantity: (nextQuantity: number) => void
  setQuantity: (value: string) => void
  setSearch: (value: string) => void
  setSelectedCartId: (id: number) => void
}

export function TicketPanel({
  applyDiscount,
  cart,
  clearTransaction,
  onSearchSubmit,
  quantity,
  removeSelectedLine,
  search,
  searchRef,
  selectedCartId,
  selectedCartItem,
  transactionDiscountPercent,
  updateSelectedLinePrice,
  updateSelectedLineQuantity,
  setQuantity,
  setSearch,
  setSelectedCartId
}: TicketPanelProps): React.JSX.Element {
  const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [editRawValue, setEditRawValue] = useState('')
  const [isEditPristine, setIsEditPristine] = useState(false)
  const [discountScope, setDiscountScope] = useState<'item' | 'transaction'>('item')
  const isKeypadMode = editMode !== null
  const productLines = cart.filter((item): item is CartItem => item.kind !== 'transaction-discount')
  const transactionDiscountLine = cart.find(
    (item): item is Extract<CartLineItem, { kind: 'transaction-discount' }> =>
      item.kind === 'transaction-discount'
  )
  const isTransactionDiscountSelected = selectedCartItem?.kind === 'transaction-discount'

  const formatMoney = (amount: number): string => {
    return amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `$${amount.toFixed(2)}`
  }

  const getDiscountOriginalValue = (scope: 'item' | 'transaction'): number => {
    const selectedItemDiscount =
      selectedCartItem && selectedCartItem.kind !== 'transaction-discount'
        ? (selectedCartItem.itemDiscountPercent ?? 0)
        : 0

    return scope === 'item' ? selectedItemDiscount : transactionDiscountPercent
  }

  const getPriceOriginalValue = (): number => {
    if (!selectedCartItem || selectedCartItem.kind === 'transaction-discount') {
      return 0
    }

    return selectedCartItem.basePrice ?? selectedCartItem.price
  }

  const updateDiscountScope = (scope: 'item' | 'transaction'): void => {
    setDiscountScope(scope)
    setEditRawValue(String(getDiscountOriginalValue(scope)))
    setIsEditPristine(true)
  }

  const getEditDisplayValue = (): string => {
    if (editMode === 'price') {
      const cents = Number.parseInt(editRawValue || '0', 10)
      if (Number.isNaN(cents) || cents < 0) {
        return '0.00'
      }

      return (cents / 100).toFixed(2)
    }

    return editRawValue
  }

  const handleKeypadInput = (key: string): void => {
    if (!isKeypadMode) {
      return
    }

    if (key === 'C') {
      setEditRawValue('')
      setIsEditPristine(false)
      return
    }

    if (key === '⌫') {
      setEditRawValue((currentValue) => {
        if (isEditPristine) {
          return ''
        }

        return currentValue.slice(0, -1)
      })
      setIsEditPristine(false)
      return
    }

    if (key === '.') {
      if (editMode === 'quantity' || editMode === 'price') {
        return
      }

      setEditRawValue((currentValue) => {
        const seedValue = isEditPristine ? '' : currentValue

        if (currentValue.includes('.')) {
          return currentValue
        }

        return seedValue.length === 0 ? '0.' : `${seedValue}.`
      })
      setIsEditPristine(false)
      return
    }

    setEditRawValue((currentValue) => {
      if (editMode === 'price') {
        const seedValue = isEditPristine ? '' : currentValue
        return `${seedValue}${key}`
      }

      const seedValue = isEditPristine ? '' : currentValue
      return `${seedValue}${key}`
    })
    setIsEditPristine(false)
  }

  const openEditModal = (mode: EditMode): void => {
    if (!mode) {
      return
    }

    setEditMode(mode)
    setIsEditPristine(true)

    if (mode === 'quantity') {
      setEditRawValue(selectedCartItem ? String(selectedCartItem.lineQuantity) : '')
      return
    }

    if (mode === 'price') {
      const currentPrice =
        selectedCartItem && selectedCartItem.kind !== 'transaction-discount'
          ? Math.round(selectedCartItem.price * 100)
          : 0
      setEditRawValue(String(currentPrice))
      return
    }

    const nextScope = selectedCartId ? 'item' : 'transaction'
    updateDiscountScope(nextScope)
  }

  const closeEditModal = (): void => {
    setEditMode(null)
    setEditRawValue('')
    setIsEditPristine(false)
  }

  const restoreOriginalPrice = (): void => {
    const originalPrice = getPriceOriginalValue()

    if (originalPrice > 0) {
      updateSelectedLinePrice(originalPrice)
    }

    closeEditModal()
  }

  const submitEdit = (): void => {
    if (!editMode) {
      return
    }

    if (editMode === 'quantity') {
      const parsedQuantity = Number.parseInt(editRawValue, 10)
      if (!Number.isNaN(parsedQuantity) && parsedQuantity > 0) {
        updateSelectedLineQuantity(parsedQuantity)
      }
      closeEditModal()
      return
    }

    if (editMode === 'price') {
      const parsedCents = Number.parseInt(editRawValue, 10)
      const parsedPrice = parsedCents / 100
      if (!Number.isNaN(parsedPrice) && parsedPrice > 0) {
        updateSelectedLinePrice(parsedPrice)
      }
      closeEditModal()
      return
    }

    const parsedPercent = Number.parseFloat(editRawValue)
    if (Number.isNaN(parsedPercent) || parsedPercent < 0) {
      closeEditModal()
      return
    }

    if (discountScope === 'item' && !selectedCartId) {
      closeEditModal()
      return
    }

    applyDiscount(parsedPercent, discountScope)
    closeEditModal()
  }

  useEffect(() => {
    if (!selectedCartId) {
      return
    }

    const selectedLine = lineRefs.current.get(selectedCartId)
    if (selectedLine && typeof selectedLine.scrollIntoView === 'function') {
      selectedLine.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedCartId, cart.length])

  return (
    <section className="ticket-panel">
      <div className="ticket-controls">
        <input
          ref={searchRef}
          className="ticket-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSearchSubmit) {
              event.preventDefault()
              onSearchSubmit()
            }
          }}
          placeholder="Search item"
          autoFocus
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

        <div className="ticket-lines" data-testid="ticket-lines">
          {cart.length === 0 ? (
            <div className="empty-ticket">No items in current transaction</div>
          ) : (
            productLines.map((item, index) => {
              const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
              const baseLineTotal = item.price * item.lineQuantity
              const discountedLineTotal = baseLineTotal * (1 - itemDiscountRate)
              const isDiscountedLine = itemDiscountRate > 0

              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    if (element) {
                      lineRefs.current.set(item.id, element)
                    } else {
                      lineRefs.current.delete(item.id)
                    }
                  }}
                  type="button"
                  className={`ticket-line ${selectedCartId === item.id ? 'active' : ''} ${isDiscountedLine ? 'discounted' : ''}`}
                  onClick={() => setSelectedCartId(item.id)}
                >
                  <span>{index + 1}</span>
                  <span className="ticket-line-item-info">
                    <span className="ticket-line-item-name">{item.name}</span>
                    {isDiscountedLine && (
                      <span className="ticket-line-discount-meta">
                        <span className="ticket-line-discount-badge">
                          DISCOUNT {(item.itemDiscountPercent ?? 0).toFixed(2)}%
                        </span>
                        <span>
                          New ${discountedLineTotal.toFixed(2)} (was ${baseLineTotal.toFixed(2)})
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="ticket-line-qty">{item.lineQuantity}</span>
                  <span className="ticket-line-price">{formatMoney(discountedLineTotal)}</span>
                </button>
              )
            })
          )}
          {transactionDiscountLine && (
            <button
              type="button"
              className={`ticket-line transaction-discount-line ${selectedCartId === transactionDiscountLine.id ? 'active' : ''}`}
              onClick={() => setSelectedCartId(transactionDiscountLine.id)}
            >
              <span>#</span>
              <span className="ticket-line-item-info">
                <span className="ticket-line-item-name">{transactionDiscountLine.name}</span>
              </span>
              <span className="ticket-line-qty">1</span>
              <span className="ticket-line-price">
                {formatMoney(transactionDiscountLine.price)}
              </span>
            </button>
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
        <button
          type="button"
          className="pos-btn"
          disabled={!selectedCartId || isTransactionDiscountSelected}
          onClick={() => openEditModal('quantity')}
        >
          Qty Change
        </button>
        <button
          type="button"
          className="pos-btn"
          disabled={!selectedCartId || isTransactionDiscountSelected}
          onClick={() => openEditModal('price')}
        >
          Price Change
        </button>
        <button
          type="button"
          className="pos-btn"
          disabled={!selectedCartId && cart.length === 0}
          onClick={() => openEditModal('discount')}
        >
          Discount
        </button>
      </div>

      {editMode && (
        <div className="pos-modal-backdrop" data-testid="edit-modal">
          <div className="pos-modal" role="dialog" aria-modal="true">
            <h3 className="pos-modal-title">
              {editMode === 'quantity' && 'Qty Change'}
              {editMode === 'price' && 'Price Change'}
              {editMode === 'discount' && 'Discount'}
            </h3>
            <p className="pos-modal-original">
              {editMode === 'quantity' && `Original Qty: ${selectedCartItem?.lineQuantity ?? 0}`}
              {editMode === 'price' && (
                <button
                  type="button"
                  className="pos-modal-original-action"
                  onClick={restoreOriginalPrice}
                >
                  Original Price: ${getPriceOriginalValue().toFixed(2)}
                </button>
              )}
              {editMode === 'discount' &&
                `Original Discount: ${getDiscountOriginalValue(discountScope).toFixed(2)}%`}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitEdit()
              }}
            >
              {editMode === 'discount' && (
                <div className="pos-modal-scope">
                  <label>
                    <input
                      type="radio"
                      name="discount-scope"
                      value="item"
                      checked={discountScope === 'item'}
                      disabled={!selectedCartId}
                      onChange={() => updateDiscountScope('item')}
                    />
                    Selected Item
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="discount-scope"
                      value="transaction"
                      checked={discountScope === 'transaction'}
                      onChange={() => updateDiscountScope('transaction')}
                    />
                    Entire Transaction
                  </label>
                </div>
              )}
              <input
                className="ticket-input"
                inputMode="decimal"
                value={getEditDisplayValue()}
                onChange={(event) => setEditRawValue(event.target.value)}
                placeholder={
                  editMode === 'quantity'
                    ? 'New quantity'
                    : editMode === 'price'
                      ? 'New price'
                      : 'Discount %'
                }
                readOnly={isKeypadMode}
                autoFocus
              />
              {isKeypadMode && (
                <div className="pos-keypad" aria-label="POS Keypad">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="pos-keypad-btn"
                      onClick={() => handleKeypadInput(key)}
                    >
                      {key}
                    </button>
                  ))}
                  {editMode === 'discount' && (
                    <button
                      type="button"
                      className="pos-keypad-btn pos-keypad-btn-wide"
                      onClick={() => handleKeypadInput('.')}
                    >
                      .
                    </button>
                  )}
                </div>
              )}
              <div className="pos-modal-actions">
                <button type="button" className="pos-btn" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="pos-btn">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
