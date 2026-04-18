import { useEffect, useState, useRef } from 'react'
import type { CartItem, CartLineItem, TransactionDetail } from '../../types/pos'
import { Button } from '../ui/button'
import { AppButton } from '../common/AppButton'
import { Input } from '../ui/input'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'
import './ticket-panel.css'

type EditMode = 'quantity' | 'price' | 'discount' | null

type TicketPanelProps = {
  applyDiscount: (percent: number, scope: 'item' | 'transaction') => void
  cart: CartLineItem[]
  clearTransaction: () => void
  onSearchSubmit?: () => void
  onSearchClick?: () => void
  onFocusSearch?: () => void
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
  isViewingTransaction?: boolean
  viewingTransaction?: TransactionDetail | null
  onDismissRecall?: () => void
  returnItems?: Record<number, number>
  onToggleReturnItem?: (cartItemId: number) => void
  onToggleReturnAll?: () => void
  onSetReturnItemQuantity?: (cartItemId: number, qty: number) => void
}

export function TicketPanel({
  applyDiscount,
  cart,
  clearTransaction,
  onSearchSubmit,
  onSearchClick,
  onFocusSearch,
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
  setSelectedCartId,
  isViewingTransaction,
  viewingTransaction,
  onDismissRecall,
  returnItems,
  onToggleReturnItem,
  onToggleReturnAll,
  onSetReturnItemQuantity
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
  const isRefundTransaction = viewingTransaction?.status === 'refund'
  const canReturn = !!isViewingTransaction && !isRefundTransaction
  const isSelectedMarkedForReturn =
    selectedCartId != null && returnItems != null && returnItems[selectedCartId] != null
  const returnCount = returnItems ? Object.keys(returnItems).length : 0

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
      if (canReturn && selectedCartId != null && returnItems?.[selectedCartId] != null) {
        setEditRawValue(String(returnItems[selectedCartId]))
      } else {
        setEditRawValue(selectedCartItem ? String(selectedCartItem.lineQuantity) : '')
      }
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
    onFocusSearch?.()
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
        if (canReturn && selectedCartId != null && returnItems?.[selectedCartId] != null) {
          onSetReturnItemQuantity?.(selectedCartId, parsedQuantity)
        } else {
          updateSelectedLineQuantity(parsedQuantity)
        }
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
    <section
      className={cn('ticket-panel', isViewingTransaction && 'ticket-panel--viewing')}
      style={{
        gridTemplateRows: isViewingTransaction ? 'auto 3rem 1fr 5.25rem' : '3rem 1fr 5.25rem'
      }}
    >
      {/* ── Recall banner ── */}
      {isViewingTransaction && viewingTransaction && (
        <div
          className="ticket-panel__recall-banner"
          style={{
            background: returnCount > 0 ? 'var(--semantic-danger-text)' : 'var(--accent-peach)',
            color: returnCount > 0 ? '#fff' : '#000'
          }}
          data-testid="recall-banner"
        >
          <span>
            {returnCount > 0 ? (
              <>
                Returning {returnCount} item{returnCount > 1 ? 's' : ''} from{' '}
                {viewingTransaction.transaction_number}
              </>
            ) : (
              <>
                Viewing Transaction: {viewingTransaction.transaction_number} —{' '}
                {new Date(viewingTransaction.created_at).toLocaleString()} —{' '}
                {viewingTransaction.payment_method}
                {viewingTransaction.total != null && ` — $${viewingTransaction.total.toFixed(2)}`}
              </>
            )}
          </span>
          <button
            type="button"
            className="ticket-panel__recall-dismiss"
            onClick={onDismissRecall}
            data-testid="dismiss-recall-btn"
          >
            Back to POS
          </button>
        </div>
      )}
      {/* ── Search & Qty controls ── */}
      <div className="ticket-panel__search-row">
        <Input
          ref={searchRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && onSearchSubmit) {
              event.preventDefault()
              onSearchSubmit()
            }
          }}
          placeholder="Search item"
          className={cn(
            'ticket-panel__search-input',
            search && 'ticket-panel__search-input--active'
          )}
          autoFocus
        />
        <Input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          inputMode="numeric"
          placeholder="Qty"
        />
        <Button
          size="md"
          variant="outline"
          className="ticket-panel__search-btn"
          onClick={onSearchClick}
        >
          Search
        </Button>
      </div>

      {/* ── Ticket table ── */}
      <div className="ticket-panel__table">
        <div className="ticket-panel__table-header">
          <span className="ticket-panel__table-header-cell" style={{ gridColumn: 'span 1' }}>
            #
          </span>
          <span className="ticket-panel__table-header-cell" style={{ gridColumn: 'span 6' }}>
            Item Description
          </span>
          <span
            className="ticket-panel__table-header-cell ticket-panel__table-header-cell--right"
            style={{ gridColumn: 'span 2' }}
          >
            Qty
          </span>
          <span
            className="ticket-panel__table-header-cell ticket-panel__table-header-cell--right"
            style={{ gridColumn: 'span 3' }}
          >
            Price
          </span>
        </div>

        <div className="ticket-panel__lines" data-testid="ticket-lines">
          {cart.length === 0 ? (
            <div className="ticket-panel__empty">No items in current transaction</div>
          ) : (
            productLines.map((item, index) => {
              const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
              const effectiveUnitPrice = item.promo ? item.promo.promoUnitPrice : item.price
              const baseLineTotal = item.price * item.lineQuantity
              const effectiveLineTotal = effectiveUnitPrice * item.lineQuantity
              const discountedLineTotal = effectiveLineTotal * (1 - itemDiscountRate)
              const isDiscountedLine = itemDiscountRate > 0
              const hasPromo = !!item.promo
              const markedReturnQty = returnItems?.[item.id]
              const isMarkedForReturn = markedReturnQty != null

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
                  className={cn(
                    'ticket-panel__line',
                    selectedCartId === item.id && 'active',
                    isDiscountedLine && 'discounted',
                    (hasPromo || isDiscountedLine || isMarkedForReturn) &&
                      'ticket-panel__line--border-left'
                  )}
                  style={{
                    background:
                      selectedCartId === item.id
                        ? 'var(--ledger-active-bg)'
                        : index % 2 === 1
                          ? 'var(--ledger-row-alt)'
                          : 'var(--ledger-bg)',
                    borderColor:
                      selectedCartId === item.id
                        ? 'var(--ledger-active-border)'
                        : 'var(--ledger-border)',
                    color:
                      selectedCartId === item.id
                        ? 'var(--ledger-active-text)'
                        : 'var(--ledger-line-text)',
                    ...(hasPromo && !isDiscountedLine
                      ? { borderLeftColor: 'var(--accent-mint)' }
                      : {}),
                    ...(isDiscountedLine ? { borderLeftColor: 'var(--accent-peach)' } : {}),
                    ...(isMarkedForReturn ? { borderLeftColor: 'var(--semantic-danger-text)' } : {})
                  }}
                  onClick={() => setSelectedCartId(item.id)}
                >
                  <span
                    className="ticket-panel__line-num"
                    style={{
                      color:
                        selectedCartId === item.id
                          ? 'var(--ledger-active-text)'
                          : 'var(--ledger-line-muted)'
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="ticket-panel__line-desc">
                    <span className="ticket-panel__line-name">{item.name}</span>
                    {item.sku && (
                      <span
                        className="ticket-panel__line-sku"
                        style={{
                          color:
                            selectedCartId === item.id
                              ? 'var(--ledger-active-text)'
                              : 'var(--ledger-line-muted)'
                        }}
                      >
                        SKU: {item.sku}
                      </span>
                    )}
                    {hasPromo && (
                      <span
                        className="ticket-panel__badge-row"
                        style={{ color: 'var(--semantic-success-text)' }}
                      >
                        <span className="ticket-panel__promo-badge">PROMO</span>
                        <span>
                          {item.promo!.promoLabel} — Save ${item.promo!.promoLineSavings.toFixed(2)}
                        </span>
                      </span>
                    )}
                    {isDiscountedLine && (
                      <span
                        className="ticket-panel__badge-row"
                        style={{ color: 'var(--semantic-warning-text)' }}
                      >
                        <span className="ticket-panel__discount-badge">
                          DISCOUNT {(item.itemDiscountPercent ?? 0).toFixed(2)}%
                        </span>
                        <span>
                          New ${discountedLineTotal.toFixed(2)} (was ${baseLineTotal.toFixed(2)})
                        </span>
                      </span>
                    )}
                    {isMarkedForReturn && (
                      <span
                        className="ticket-panel__badge-row"
                        style={{ color: 'var(--semantic-danger-text)' }}
                        data-testid="return-badge"
                      >
                        <span className="ticket-panel__return-badge">RETURN</span>
                        <span>
                          Returning {markedReturnQty} of {item.lineQuantity}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="ticket-panel__line-qty">
                    {isMarkedForReturn ? (
                      <span style={{ color: 'var(--semantic-danger-text)' }}>
                        -{markedReturnQty}
                      </span>
                    ) : isRefundTransaction ? (
                      <span style={{ color: 'var(--semantic-danger-text)' }}>
                        -{item.lineQuantity}
                      </span>
                    ) : (
                      item.lineQuantity
                    )}
                  </span>
                  <span className="ticket-panel__line-price">
                    {isMarkedForReturn ? (
                      <span style={{ color: 'var(--semantic-danger-text)' }}>
                        (
                        {formatMoney(effectiveUnitPrice * markedReturnQty * (1 - itemDiscountRate))}
                        )
                      </span>
                    ) : isRefundTransaction ? (
                      <span style={{ color: 'var(--semantic-danger-text)' }}>
                        ({formatMoney(discountedLineTotal)})
                      </span>
                    ) : (
                      formatMoney(discountedLineTotal)
                    )}
                  </span>
                </button>
              )
            })
          )}
          {transactionDiscountLine && (
            <button
              type="button"
              className="ticket-panel__tx-discount-line"
              style={{
                background:
                  selectedCartId === transactionDiscountLine.id
                    ? 'var(--ledger-active-bg)'
                    : 'var(--accent-lavender-soft)',
                borderColor: 'var(--border-strong)',
                color: 'var(--ledger-line-text)'
              }}
              onClick={() => setSelectedCartId(transactionDiscountLine.id)}
            >
              <span
                className="ticket-panel__line-num"
                style={{ color: 'var(--ledger-line-muted)' }}
              >
                #
              </span>
              <span className="ticket-panel__line-desc">
                <span className="ticket-panel__line-name">{transactionDiscountLine.name}</span>
              </span>
              <span className="ticket-panel__line-qty">1</span>
              <span className="ticket-panel__line-price">
                {formatMoney(transactionDiscountLine.price)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="ticket-panel__actions">
        {canReturn ? (
          <Button
            variant={isSelectedMarkedForReturn ? 'neutral' : 'danger'}
            className="ticket-panel__action-btn"
            disabled={!selectedCartId || isTransactionDiscountSelected}
            onClick={() => {
              if (selectedCartId != null && onToggleReturnItem) onToggleReturnItem(selectedCartId)
            }}
            data-testid="return-btn"
          >
            {isSelectedMarkedForReturn ? 'Undo' : 'Return'}
          </Button>
        ) : (
          <Button
            variant="danger"
            className="ticket-panel__action-btn"
            disabled={!!isViewingTransaction}
            onClick={() => {
              removeSelectedLine()
              onFocusSearch?.()
            }}
          >
            Delete
          </Button>
        )}
        {canReturn ? (
          <Button
            variant="warning"
            className="ticket-panel__action-btn"
            onClick={() => onToggleReturnAll?.()}
            data-testid="return-all-btn"
          >
            {returnCount > 0 && returnCount === productLines.length ? 'Undo All' : 'Return All'}
          </Button>
        ) : (
          <Button
            variant="warning"
            className="ticket-panel__action-btn"
            disabled={!!isViewingTransaction}
            onClick={() => {
              clearTransaction()
              onFocusSearch?.()
            }}
          >
            Void
          </Button>
        )}
        <Button
          className="ticket-panel__action-btn"
          disabled={
            canReturn
              ? !isSelectedMarkedForReturn
              : !!isViewingTransaction || !selectedCartId || isTransactionDiscountSelected
          }
          onClick={() => openEditModal('quantity')}
        >
          Qty Change
        </Button>
        <Button
          className="ticket-panel__action-btn"
          disabled={!!isViewingTransaction || !selectedCartId || isTransactionDiscountSelected}
          onClick={() => openEditModal('price')}
        >
          Price Change
        </Button>
        <Button
          className="ticket-panel__action-btn"
          disabled={!!isViewingTransaction || (!selectedCartId && cart.length === 0)}
          onClick={() => openEditModal('discount')}
        >
          Discount
        </Button>
      </div>

      {/* ── Edit keypad modal ── */}
      {editMode && (
        <div
          className="ticket-panel__edit-overlay"
          data-testid="edit-modal"
          onKeyDown={(e) => {
            if (!isKeypadMode) return
            if (e.key === 'Escape') {
              e.preventDefault()
              closeEditModal()
              return
            }
            if (e.key === 'Enter') {
              // Allow form submit to handle it
              return
            }
            if (e.key === 'Backspace') {
              e.preventDefault()
              handleKeypadInput('⌫')
              return
            }
            if (/^[0-9]$/.test(e.key)) {
              e.preventDefault()
              handleKeypadInput(e.key)
              return
            }
            if (e.key === '.' && editMode === 'discount') {
              e.preventDefault()
              handleKeypadInput('.')
              return
            }
            if (e.key === 'c' || e.key === 'C') {
              e.preventDefault()
              handleKeypadInput('C')
            }
          }}
        >
          <div className="ticket-panel__edit-dialog" role="dialog" aria-modal="true">
            <h3 className="ticket-panel__edit-title">
              {editMode === 'quantity' && 'Qty Change'}
              {editMode === 'price' && 'Price Change'}
              {editMode === 'discount' && 'Discount'}
            </h3>
            <p className="ticket-panel__edit-info">
              {editMode === 'quantity' && `Original Qty: ${selectedCartItem?.lineQuantity ?? 0}`}
              {editMode === 'price' && (
                <button
                  type="button"
                  className="ticket-panel__edit-restore-btn"
                  onClick={restoreOriginalPrice}
                >
                  Original Price: ${getPriceOriginalValue().toFixed(2)}
                </button>
              )}
              {editMode === 'discount' &&
                `Original Discount: ${getDiscountOriginalValue(discountScope).toFixed(2)}%`}
            </p>
            <form
              className="ticket-panel__edit-form"
              onSubmit={(event) => {
                event.preventDefault()
                submitEdit()
              }}
            >
              {editMode === 'discount' && (
                <RadioGroup
                  value={discountScope}
                  onValueChange={(v) => updateDiscountScope(v as 'item' | 'transaction')}
                  className="ticket-panel__edit-radio-row"
                >
                  <div className="ticket-panel__edit-radio-item">
                    <RadioGroupItem value="item" id="scope-item" disabled={!selectedCartId} />
                    <Label htmlFor="scope-item" className="ticket-panel__edit-radio-label">
                      Selected Item
                    </Label>
                  </div>
                  <div className="ticket-panel__edit-radio-item">
                    <RadioGroupItem value="transaction" id="scope-transaction" />
                    <Label htmlFor="scope-transaction" className="ticket-panel__edit-radio-label">
                      Entire Transaction
                    </Label>
                  </div>
                </RadioGroup>
              )}
              <Input
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
                className="ticket-panel__edit-input"
                autoFocus
              />
              {isKeypadMode && (
                <div className="ticket-panel__keypad" aria-label="POS Keypad">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'].map((key) => (
                    <Button
                      key={key}
                      type="button"
                      className="ticket-panel__keypad-btn"
                      onClick={() => handleKeypadInput(key)}
                    >
                      {key}
                    </Button>
                  ))}
                  {editMode === 'discount' && (
                    <Button
                      type="button"
                      className="ticket-panel__keypad-btn ticket-panel__keypad-btn--wide"
                      onClick={() => handleKeypadInput('.')}
                    >
                      .
                    </Button>
                  )}
                </div>
              )}
              <div className="ticket-panel__edit-footer">
                <AppButton
                  type="button"
                  variant="danger"
                  className="ticket-panel__edit-footer-btn"
                  onClick={closeEditModal}
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  variant="success"
                  className="ticket-panel__edit-footer-btn"
                >
                  Save
                </AppButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
