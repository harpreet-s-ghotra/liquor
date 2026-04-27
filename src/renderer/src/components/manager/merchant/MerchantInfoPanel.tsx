import { useCallback, useEffect, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { stripIpcPrefix } from '@renderer/utils/ipc-error'
import type { CardSurchargeConfig, MerchantStatus } from '../../../../../shared/types'
import './merchant-info-panel.css'

const MAX_SURCHARGE_PERCENT = 10

export function MerchantInfoPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const merchantConfig = useAuthStore((s) => s.merchantConfig)

  const [status, setStatus] = useState<MerchantStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [surchargeEnabled, setSurchargeEnabled] = useState(false)
  const [surchargePercent, setSurchargePercent] = useState('0')
  const [surchargeError, setSurchargeError] = useState<string | null>(null)
  const [surchargeSuccess, setSurchargeSuccess] = useState<string | null>(null)
  const [surchargeSaving, setSurchargeSaving] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!api) return
    try {
      setLoading(true)
      setError(null)
      const result = await api.getFinixMerchantStatus()
      setStatus(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch merchant status')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!api?.getCardSurcharge) return
    void api
      .getCardSurcharge()
      .then((cfg: CardSurchargeConfig) => {
        setSurchargeEnabled(cfg.enabled)
        setSurchargePercent(String(cfg.percent ?? 0))
      })
      .catch(() => {
        // Surcharge load failure should not block the merchant panel
      })
  }, [api])

  const handleSaveSurcharge = async (): Promise<void> => {
    if (!api?.setCardSurcharge) return
    setSurchargeError(null)
    setSurchargeSuccess(null)

    const percent = Number.parseFloat(surchargePercent.replace(/,/g, '.'))
    if (!Number.isFinite(percent) || percent < 0) {
      setSurchargeError('Enter a percent of 0 or higher')
      return
    }
    if (percent > MAX_SURCHARGE_PERCENT) {
      setSurchargeError(`Percent must be ${MAX_SURCHARGE_PERCENT}% or less`)
      return
    }

    setSurchargeSaving(true)
    try {
      const saved = await api.setCardSurcharge({ enabled: surchargeEnabled, percent })
      setSurchargeEnabled(saved.enabled)
      setSurchargePercent(String(saved.percent))
      setSurchargeSuccess('Card surcharge saved')
    } catch (err) {
      setSurchargeError(err instanceof Error ? stripIpcPrefix(err.message) : 'Save failed')
    } finally {
      setSurchargeSaving(false)
    }
  }

  const handleRefresh = (): void => {
    void fetchStatus()
  }

  if (loading && !status) {
    return (
      <div className="merchant-info">
        <div className="merchant-info__loading">Loading merchant info...</div>
      </div>
    )
  }

  return (
    <div className="merchant-info">
      <div className="merchant-info__cards">
        {/* Store Name */}
        <div className="merchant-info__card">
          <span className="merchant-info__card-label">Store Name</span>
          <span className="merchant-info__card-value">
            {status?.merchant_name ?? merchantConfig?.merchant_name ?? '--'}
          </span>
        </div>

        {/* Finix Merchant ID */}
        <div className="merchant-info__card">
          <span className="merchant-info__card-label">Finix Merchant ID</span>
          <span className="merchant-info__card-value merchant-info__card-value--mono">
            {status?.merchant_id ?? merchantConfig?.merchant_id ?? '--'}
          </span>
        </div>

        {/* Processing Status */}
        <div className="merchant-info__card">
          <span className="merchant-info__card-label">Processing Status</span>
          {status ? (
            <span
              className={`merchant-info__badge merchant-info__badge--${status.processing_enabled ? 'enabled' : 'disabled'}`}
            >
              {status.processing_enabled ? 'Enabled' : 'Disabled'}
            </span>
          ) : (
            <span className="merchant-info__card-value">--</span>
          )}
        </div>

        {/* Activated Date */}
        <div className="merchant-info__card">
          <span className="merchant-info__card-label">Activated</span>
          <span className="merchant-info__card-value">
            {merchantConfig?.activated_at
              ? new Date(merchantConfig.activated_at).toLocaleDateString()
              : '--'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="merchant-info__actions">
        <AppButton variant="default" size="md" onClick={handleRefresh}>
          Refresh Status
        </AppButton>
        <p className="merchant-info__hint">To update banking details, visit the Finix dashboard.</p>
      </div>

      {/* Status messages */}
      {error && <p className="merchant-info__msg--error">{error}</p>}

      {/* Card surcharge section */}
      <div className="merchant-info__section" data-testid="card-surcharge-section">
        <h3 className="merchant-info__section-title">Card Surcharge</h3>
        <p className="merchant-info__section-help">
          Adds a percentage to credit and debit charges to offset processing fees. Cash payments are
          never surcharged.
        </p>

        <div className="merchant-info__surcharge-row">
          <label className="merchant-info__surcharge-toggle">
            <Checkbox
              checked={surchargeEnabled}
              onCheckedChange={(checked) => setSurchargeEnabled(checked === true)}
              aria-label="Apply surcharge on credit and debit"
            />
            Apply surcharge on credit/debit
          </label>

          <div className="merchant-info__surcharge-percent">
            <ValidatedInput
              fieldType="decimal"
              aria-label="Card surcharge percent"
              value={surchargePercent}
              onChange={setSurchargePercent}
              disabled={!surchargeEnabled}
              placeholder="0"
            />
            <span>%</span>
          </div>

          <AppButton
            variant="default"
            size="md"
            onClick={() => void handleSaveSurcharge()}
            disabled={surchargeSaving}
          >
            {surchargeSaving ? 'Saving…' : 'Save'}
          </AppButton>
        </div>

        {surchargeError && <p className="merchant-info__msg--error">{surchargeError}</p>}
        {surchargeSuccess && <p className="merchant-info__msg--success">{surchargeSuccess}</p>}
      </div>
    </div>
  )
}
