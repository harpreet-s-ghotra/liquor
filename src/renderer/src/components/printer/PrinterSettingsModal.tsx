import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { SuccessModal } from '@renderer/components/common/SuccessModal'
import { ErrorModal } from '@renderer/components/common/ErrorModal'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReceiptConfig } from '../../../../shared/types'
import './printer-settings-modal.css'

type SampleType = 'basic' | 'with-promo' | 'many-items' | 'with-message'

const SAMPLE_LABELS: Record<SampleType, string> = {
  basic: 'Basic (2 items, cash)',
  'with-promo': 'With Discount',
  'many-items': 'Many Items (wrap test)',
  'with-message': 'With Footer Message'
}

const DEFAULT_CONFIG: ReceiptConfig = {
  fontSize: 10,
  paddingY: 4,
  paddingX: 4,
  storeName: '',
  footerMessage: ''
}

type PrinterSettingsModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function PrinterSettingsModal({
  isOpen,
  onClose
}: PrinterSettingsModalProps): React.JSX.Element {
  const [cfg, setCfg] = useState<ReceiptConfig>(DEFAULT_CONFIG)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isSaveSuccessOpen, setIsSaveSuccessOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [sampleType, setSampleType] = useState<SampleType>('basic')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load config once on open
  useEffect(() => {
    if (!isOpen) return
    void window.api?.getReceiptConfig?.().then((c) => setCfg(c))
  }, [isOpen])

  // Poll printer status every 4s while modal is open
  useEffect(() => {
    if (!isOpen) return

    const checkStatus = (): void => {
      void window.api?.getPrinterStatus?.().then((s) => {
        setConnected(s.connected)
        setPrinterName(s.printerName)
      })
    }

    checkStatus()
    pollRef.current = setInterval(checkStatus, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isOpen])

  const updateCfg = useCallback(
    (patch: Partial<ReceiptConfig>) => {
      const next = { ...cfg, ...patch }
      setCfg(next)
    },
    [cfg]
  )

  const handleSaveSettings = useCallback(async () => {
    setSaving(true)
    try {
      await window.api?.saveReceiptConfig?.(cfg)
      setIsSaveSuccessOpen(true)
    } catch {
      setSaveError('Failed to save printer settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [cfg])

  const handleResetToDefaults = useCallback(() => {
    setCfg(DEFAULT_CONFIG)
    setSaveError('')
  }, [])

  const handlePrintSample = useCallback(async () => {
    setPrinting(true)
    try {
      const storeName = cfg.storeName || 'Sample Store'
      const footerMessage = cfg.footerMessage.trim() || undefined

      if (sampleType === 'basic') {
        await window.api?.printReceipt?.({
          transaction_number: 'TXN-SAMPLE-0001',
          store_name: storeName,
          cashier_name: 'Test Cashier',
          items: [
            {
              product_name: 'Cabernet Sauvignon 750ml',
              quantity: 2,
              unit_price: 19.99,
              total_price: 39.98
            },
            { product_name: 'Heineken 6-Pack', quantity: 1, unit_price: 11.99, total_price: 11.99 }
          ],
          subtotal: 51.97,
          tax_amount: 6.76,
          total: 58.73,
          payment_method: 'cash',
          footer_message: footerMessage
        })
      } else if (sampleType === 'with-promo') {
        await window.api?.printReceipt?.({
          transaction_number: 'TXN-SAMPLE-0002',
          store_name: storeName,
          cashier_name: 'Test Cashier',
          items: [
            {
              product_name: 'Johnnie Walker Black',
              quantity: 1,
              unit_price: 33.99,
              total_price: 33.99
            },
            { product_name: "Tito's Vodka 1L", quantity: 1, unit_price: 25.49, total_price: 25.49 }
          ],
          subtotal: 53.57,
          subtotal_before_discount: 59.48,
          discount_amount: 5.91,
          tax_amount: 6.96,
          total: 60.53,
          payment_method: 'credit',
          card_last_four: '4242',
          card_type: 'visa',
          footer_message: footerMessage
        })
      } else if (sampleType === 'many-items') {
        await window.api?.printReceipt?.({
          transaction_number: 'TXN-SAMPLE-0003',
          store_name: storeName,
          cashier_name: 'Test Cashier',
          items: [
            {
              product_name: 'Cabernet Sauvignon Reserve 750ml Napa',
              quantity: 2,
              unit_price: 29.99,
              total_price: 59.98
            },
            {
              product_name: 'Modelo Especial 12-Pack Cans',
              quantity: 1,
              unit_price: 18.99,
              total_price: 18.99
            },
            {
              product_name: 'Ketel One Botanical Cucumber',
              quantity: 1,
              unit_price: 24.99,
              total_price: 24.99
            },
            {
              product_name: 'Woodford Reserve Bourbon',
              quantity: 1,
              unit_price: 39.99,
              total_price: 39.99
            },
            {
              product_name: 'Meiomi Pinot Noir',
              quantity: 3,
              unit_price: 14.99,
              total_price: 44.97
            },
            {
              product_name: 'Corona Extra 24-Pack',
              quantity: 1,
              unit_price: 27.49,
              total_price: 27.49
            }
          ],
          subtotal: 216.41,
          tax_amount: 28.13,
          total: 244.54,
          payment_method: 'debit',
          card_last_four: '1234',
          card_type: 'mastercard',
          footer_message: footerMessage
        })
      } else {
        await window.api?.printReceipt?.({
          transaction_number: 'TXN-SAMPLE-0004',
          store_name: storeName,
          cashier_name: 'Test Cashier',
          items: [
            {
              product_name: 'Dom Perignon Champagne',
              quantity: 1,
              unit_price: 189.99,
              total_price: 189.99
            }
          ],
          subtotal: 189.99,
          tax_amount: 24.7,
          total: 214.69,
          payment_method: 'cash',
          footer_message: footerMessage ?? 'Thank you for shopping with us!\nHave a great day.'
        })
      }
    } catch {
      /* errors surfaced by main process */
    } finally {
      setPrinting(false)
    }
  }, [cfg.footerMessage, cfg.storeName, sampleType])

  // Clamp helpers
  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="printer-settings-modal"
        aria-label="Printer Settings"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="printer-settings-modal__header">
          <h2 className="printer-settings-modal__title">Printer Settings</h2>
          <button type="button" className="printer-settings-modal__close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="printer-settings-modal__body">
          {/* ── Printer Status ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Printer Status</h3>
            <div className="printer-settings-modal__status-row">
              <span className="printer-settings-modal__status-label">Status</span>
              <span
                className={
                  connected
                    ? 'printer-settings-modal__status-badge--connected'
                    : 'printer-settings-modal__status-badge--disconnected'
                }
              >
                <span className="printer-settings-modal__status-dot" />
                {connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {printerName && (
              <div className="printer-settings-modal__status-row">
                <span className="printer-settings-modal__status-label">Printer Name</span>
                <span className="printer-settings-modal__status-value">{printerName}</span>
              </div>
            )}
          </div>

          {/* ── Store Name ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Store Name on Receipt</h3>
            <input
              className="printer-settings-modal__text-input"
              type="text"
              value={cfg.storeName}
              placeholder="Leave blank to use merchant name"
              onChange={(e) => updateCfg({ storeName: e.target.value })}
            />
          </div>

          {/* ── Footer Message ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Footer Message</h3>
            <input
              className="printer-settings-modal__text-input"
              type="text"
              value={cfg.footerMessage}
              placeholder="Optional message printed below barcode"
              onChange={(e) => updateCfg({ footerMessage: e.target.value })}
            />
          </div>

          {/* ── Font Size ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Font Size</h3>
            <div className="printer-settings-modal__stepper">
              <AppButton
                variant="neutral"
                size="md"
                onClick={() => updateCfg({ fontSize: clamp(cfg.fontSize - 1, 8, 16) })}
                disabled={cfg.fontSize <= 8}
              >
                -
              </AppButton>
              <span className="printer-settings-modal__stepper-value">{cfg.fontSize} pt</span>
              <AppButton
                variant="neutral"
                size="md"
                onClick={() => updateCfg({ fontSize: clamp(cfg.fontSize + 1, 8, 16) })}
                disabled={cfg.fontSize >= 16}
              >
                +
              </AppButton>
              <span className="printer-settings-modal__stepper-hint">Range: 8 – 16 pt</span>
            </div>
          </div>

          {/* ── Padding ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Receipt Margins</h3>
            <div className="printer-settings-modal__padding-layout">
              {/* Visual box-model diagram */}
              <div className="printer-settings-modal__box-model">
                <div className="printer-settings-modal__box-outer">
                  <div className="printer-settings-modal__box-y-label printer-settings-modal__box-y-label--top">
                    {cfg.paddingY} pt
                  </div>
                  <div className="printer-settings-modal__box-middle-row">
                    <div className="printer-settings-modal__box-x-label">{cfg.paddingX} pt</div>
                    <div className="printer-settings-modal__box-content">content</div>
                    <div className="printer-settings-modal__box-x-label">{cfg.paddingX} pt</div>
                  </div>
                  <div className="printer-settings-modal__box-y-label printer-settings-modal__box-y-label--bottom">
                    {cfg.paddingY} pt
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="printer-settings-modal__padding-controls">
                <div className="printer-settings-modal__padding-row">
                  <span className="printer-settings-modal__padding-axis">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <line
                        x1="7"
                        y1="1"
                        x2="7"
                        y2="13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <polyline
                        points="4,4 7,1 10,4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="4,10 7,13 10,10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Top / Bottom
                  </span>
                  <div className="printer-settings-modal__stepper printer-settings-modal__stepper--sm">
                    <AppButton
                      variant="neutral"
                      size="sm"
                      onClick={() => updateCfg({ paddingY: clamp(cfg.paddingY - 2, 4, 40) })}
                      disabled={cfg.paddingY <= 4}
                    >
                      -
                    </AppButton>
                    <span className="printer-settings-modal__stepper-value">{cfg.paddingY} pt</span>
                    <AppButton
                      variant="neutral"
                      size="sm"
                      onClick={() => updateCfg({ paddingY: clamp(cfg.paddingY + 2, 4, 40) })}
                      disabled={cfg.paddingY >= 40}
                    >
                      +
                    </AppButton>
                  </div>
                </div>

                <div className="printer-settings-modal__padding-row">
                  <span className="printer-settings-modal__padding-axis">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <line
                        x1="1"
                        y1="7"
                        x2="13"
                        y2="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <polyline
                        points="4,4 1,7 4,10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="10,4 13,7 10,10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Left / Right
                  </span>
                  <div className="printer-settings-modal__stepper printer-settings-modal__stepper--sm">
                    <AppButton
                      variant="neutral"
                      size="sm"
                      onClick={() => updateCfg({ paddingX: clamp(cfg.paddingX - 2, 4, 30) })}
                      disabled={cfg.paddingX <= 4}
                    >
                      -
                    </AppButton>
                    <span className="printer-settings-modal__stepper-value">{cfg.paddingX} pt</span>
                    <AppButton
                      variant="neutral"
                      size="sm"
                      onClick={() => updateCfg({ paddingX: clamp(cfg.paddingX + 2, 4, 30) })}
                      disabled={cfg.paddingX >= 30}
                    >
                      +
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Test Print ── */}
          <div className="printer-settings-modal__section">
            <h3 className="printer-settings-modal__section-title">Test Print</h3>
            <select
              className="printer-settings-modal__select"
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value as SampleType)}
            >
              {(Object.keys(SAMPLE_LABELS) as SampleType[]).map((k) => (
                <option key={k} value={k}>
                  {SAMPLE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="printer-settings-modal__footer">
          <div className="printer-settings-modal__footer-left">
            <AppButton variant="neutral" size="lg" onClick={handleResetToDefaults}>
              Reset to Defaults
            </AppButton>
            <AppButton variant="default" size="lg" onClick={handleSaveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </AppButton>
          </div>
          <AppButton
            variant="success"
            size="lg"
            onClick={handlePrintSample}
            disabled={!connected || printing}
          >
            {printing ? 'Printing...' : 'Print Sample'}
          </AppButton>
        </div>

        <SuccessModal
          isOpen={isSaveSuccessOpen}
          title="Printer Settings Saved"
          message="Receipt settings were saved successfully."
          onDismiss={() => setIsSaveSuccessOpen(false)}
        />

        <ErrorModal
          isOpen={saveError.length > 0}
          title="Save Failed"
          message={saveError}
          onDismiss={() => setSaveError('')}
        />
      </DialogContent>
    </Dialog>
  )
}
