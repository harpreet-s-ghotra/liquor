import { useState, useCallback } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { parseCurrencyDigitsToDollars, formatCurrency } from '@renderer/utils/currency'
import type { Product } from '../../../../../shared/types'
import './unpriced-item-prompt.css'

type UnpricedItemPromptProps = {
  product: Product
  onConfirm: (price: number) => void
  onCancel: () => void
}

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'] as const

export function UnpricedItemPrompt({
  product,
  onConfirm,
  onCancel
}: UnpricedItemPromptProps): React.JSX.Element {
  const [digits, setDigits] = useState('')

  const handleKey = useCallback(
    (key: (typeof KEYPAD_KEYS)[number]) => {
      if (key === 'C') return setDigits('')
      if (key === '⌫') return setDigits((d) => d.slice(0, -1))
      if (digits.length >= 8) return
      setDigits((d) => d + key)
    },
    [digits]
  )

  const price = parseCurrencyDigitsToDollars(digits || '0')

  const handleConfirm = (): void => {
    if (price <= 0) return
    onConfirm(price)
  }

  return (
    <div className="unpriced-item-prompt">
      <div className="unpriced-item-prompt__header">
        <div className="unpriced-item-prompt__title">Item Has No Price</div>
        <div className="unpriced-item-prompt__product-name">
          {product.name}
          {product.sku && (
            <span className="unpriced-item-prompt__sku"> &mdash; SKU {product.sku}</span>
          )}
        </div>
        <div className="unpriced-item-prompt__hint">
          Enter a one-time price to add this item to the cart.
        </div>
      </div>

      <div className="unpriced-item-prompt__display">{formatCurrency(price)}</div>

      <div className="unpriced-item-prompt__keypad">
        {KEYPAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`unpriced-item-prompt__key${key === 'C' ? ' unpriced-item-prompt__key--clear' : ''}${key === '⌫' ? ' unpriced-item-prompt__key--back' : ''}`}
            onClick={() => handleKey(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="unpriced-item-prompt__actions">
        <AppButton variant="neutral" size="lg" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton variant="success" size="lg" onClick={handleConfirm} disabled={price <= 0}>
          Add to Cart
        </AppButton>
      </div>
    </div>
  )
}
