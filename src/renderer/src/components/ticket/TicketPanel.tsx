import { useEffect, useState, useRef } from 'react'
import type { CartItem, CartLineItem } from '../../types/pos'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

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
    <section
      className="ticket-panel grid gap-2 overflow-hidden rounded-(--radius) border p-1.5 relative"
      style={{
        gridTemplateRows: '3rem 1fr 5.25rem',
        background: 'var(--bg-surface)',
        borderColor: 'var(--ledger-border)'
      }}
    >
      {/* ── Search & Qty controls ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 5.5rem 5.5rem' }}>
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
          className="text-lg"
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
          className="text-base font-semibold"
          onClick={onSearchClick}
        >
          Search
        </Button>
      </div>

      {/* ── Ticket table ── */}
      <div
        className="grid overflow-hidden rounded-(--radius) border"
        style={{
          gridTemplateRows: '2.5rem 1fr',
          background: 'var(--ledger-bg)',
          borderColor: 'var(--ledger-border)'
        }}
      >
        <div
          className="grid grid-cols-12 items-center px-6 text-[10px] font-black uppercase tracking-[2px]"
          style={{ background: 'var(--ledger-header-bg)', color: 'var(--ledger-header-text)' }}
        >
          <span className="col-span-1">#</span>
          <span className="col-span-6">Item Description</span>
          <span className="col-span-2 text-right">Qty</span>
          <span className="col-span-3 text-right">Price</span>
        </div>

        <div className="overflow-auto" data-testid="ticket-lines">
          {cart.length === 0 ? (
            <div className="p-4 text-base text-(--text-muted)">No items in current transaction</div>
          ) : (
            productLines.map((item, index) => {
              const itemDiscountRate = (item.itemDiscountPercent ?? 0) / 100
              const effectiveUnitPrice = item.promo ? item.promo.promoUnitPrice : item.price
              const baseLineTotal = item.price * item.lineQuantity
              const effectiveLineTotal = effectiveUnitPrice * item.lineQuantity
              const discountedLineTotal = effectiveLineTotal * (1 - itemDiscountRate)
              const isDiscountedLine = itemDiscountRate > 0
              const hasPromo = !!item.promo

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
                    'ticket-line w-full grid grid-cols-12 items-center min-h-18 px-6 py-4 cursor-pointer text-left border-b',
                    selectedCartId === item.id ? 'active' : '',
                    index % 2 === 1 && selectedCartId !== item.id && 'ticket-line-alt',
                    hasPromo && !isDiscountedLine && 'promo border-l-4',
                    isDiscountedLine && 'discounted border-l-4'
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
                    ...(isDiscountedLine ? { borderLeftColor: 'var(--accent-peach)' } : {})
                  }}
                  onClick={() => setSelectedCartId(item.id)}
                >
                  <span
                    className="col-span-1 text-base font-bold"
                    style={{
                      color:
                        selectedCartId === item.id
                          ? 'var(--ledger-active-text)'
                          : 'var(--ledger-line-muted)'
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="col-span-6 grid gap-0">
                    <span className="text-base font-extrabold uppercase">{item.name}</span>
                    {item.sku && (
                      <span
                        className="text-xs font-medium opacity-70"
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
                        className="inline-flex flex-wrap items-center gap-1.5 text-xs font-bold"
                        style={{ color: 'var(--semantic-success-text)' }}
                      >
                        <span className="rounded-(--radius) bg-(--accent-mint) px-1.5 py-px text-xs font-extrabold text-(--btn-success-text)">
                          PROMO
                        </span>
                        <span>
                          {item.promo!.promoLabel} — Save ${item.promo!.promoLineSavings.toFixed(2)}
                        </span>
                      </span>
                    )}
                    {isDiscountedLine && (
                      <span
                        className="inline-flex flex-wrap items-center gap-1.5 text-xs font-bold"
                        style={{ color: 'var(--semantic-warning-text)' }}
                      >
                        <span className="rounded-(--radius) bg-(--accent-peach) px-1.5 py-px text-xs font-extrabold text-white">
                          DISCOUNT {(item.itemDiscountPercent ?? 0).toFixed(2)}%
                        </span>
                        <span>
                          New ${discountedLineTotal.toFixed(2)} (was ${baseLineTotal.toFixed(2)})
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="ticket-line-qty col-span-2 text-right text-lg font-black">
                    {item.lineQuantity}
                  </span>
                  <span className="ticket-line-price col-span-3 text-right text-lg font-black">
                    {formatMoney(discountedLineTotal)}
                  </span>
                </button>
              )
            })
          )}
          {transactionDiscountLine && (
            <button
              type="button"
              className={cn(
                'ticket-line w-full grid grid-cols-12 items-center min-h-18 px-6 py-4 cursor-pointer text-left sticky bottom-0 z-[2] border-t-2',
                selectedCartId === transactionDiscountLine.id && 'active'
              )}
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
                className="col-span-1 text-base font-bold"
                style={{ color: 'var(--ledger-line-muted)' }}
              >
                #
              </span>
              <span className="col-span-6 grid gap-0">
                <span className="text-base font-extrabold uppercase">
                  {transactionDiscountLine.name}
                </span>
              </span>
              <span className="ticket-line-qty col-span-2 text-right text-lg font-black">1</span>
              <span className="ticket-line-price col-span-3 text-right text-lg font-black">
                {formatMoney(transactionDiscountLine.price)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="grid grid-cols-5 gap-2">
        <Button
          variant="danger"
          className="min-h-18 text-xl font-bold"
          onClick={() => {
            removeSelectedLine()
            onFocusSearch?.()
          }}
        >
          Delete
        </Button>
        <Button
          variant="warning"
          className="min-h-18 text-xl font-bold"
          onClick={() => {
            clearTransaction()
            onFocusSearch?.()
          }}
        >
          Void
        </Button>
        <Button
          className="min-h-18 text-xl font-bold"
          disabled={!selectedCartId || isTransactionDiscountSelected}
          onClick={() => openEditModal('quantity')}
        >
          Qty Change
        </Button>
        <Button
          className="min-h-18 text-xl font-bold"
          disabled={!selectedCartId || isTransactionDiscountSelected}
          onClick={() => openEditModal('price')}
        >
          Price Change
        </Button>
        <Button
          className="min-h-18 text-xl font-bold"
          disabled={!selectedCartId && cart.length === 0}
          onClick={() => openEditModal('discount')}
        >
          Discount
        </Button>
      </div>

      {/* ── Edit keypad modal ── */}
      {editMode && (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-[color-mix(in_srgb,var(--bg-shell)_55%,transparent)]"
          data-testid="edit-modal"
        >
          <div
            className="w-[min(34rem,calc(100%-2rem))] grid gap-4 rounded-(--radius) bg-(--bg-panel) p-4 shadow-lg"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="m-0 rounded-(--radius) bg-(--bg-shell) px-4 py-3 text-2xl font-bold text-(--text-on-dark)">
              {editMode === 'quantity' && 'Qty Change'}
              {editMode === 'price' && 'Price Change'}
              {editMode === 'discount' && 'Discount'}
            </h3>
            <p className="m-0 rounded-(--radius) bg-(--bg-surface-soft) px-4 py-2.5 text-lg font-semibold text-(--text-primary)">
              {editMode === 'quantity' && `Original Qty: ${selectedCartItem?.lineQuantity ?? 0}`}
              {editMode === 'price' && (
                <button
                  type="button"
                  className="appearance-none border-none bg-transparent text-inherit font-inherit underline cursor-pointer p-0"
                  onClick={restoreOriginalPrice}
                >
                  Original Price: ${getPriceOriginalValue().toFixed(2)}
                </button>
              )}
              {editMode === 'discount' &&
                `Original Discount: ${getDiscountOriginalValue(discountScope).toFixed(2)}%`}
            </p>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                submitEdit()
              }}
            >
              {editMode === 'discount' && (
                <RadioGroup
                  value={discountScope}
                  onValueChange={(v) => updateDiscountScope(v as 'item' | 'transaction')}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="item" id="scope-item" disabled={!selectedCartId} />
                    <Label htmlFor="scope-item" className="text-lg text-(--text-primary)">
                      Selected Item
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="transaction" id="scope-transaction" />
                    <Label htmlFor="scope-transaction" className="text-lg text-(--text-primary)">
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
                className="text-[1.75rem] min-h-16 px-4 py-3"
                autoFocus
              />
              {isKeypadMode && (
                <div className="grid grid-cols-3 gap-3" aria-label="POS Keypad">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'].map((key) => (
                    <Button
                      key={key}
                      type="button"
                      className="min-h-18 text-[1.75rem] font-bold"
                      onClick={() => handleKeypadInput(key)}
                    >
                      {key}
                    </Button>
                  ))}
                  {editMode === 'discount' && (
                    <Button
                      type="button"
                      className="col-span-3 min-h-18 text-[1.75rem] font-bold"
                      onClick={() => handleKeypadInput('.')}
                    >
                      .
                    </Button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  className="min-h-[4.75rem] text-2xl font-bold"
                  onClick={closeEditModal}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-[4.75rem] text-2xl font-bold">
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
