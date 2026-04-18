import { useCallback, useEffect, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { useAuthStore } from '@renderer/store/useAuthStore'
import type { MerchantStatus } from '../../../../../shared/types'
import './merchant-info-panel.css'

export function MerchantInfoPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const merchantConfig = useAuthStore((s) => s.merchantConfig)

  const [status, setStatus] = useState<MerchantStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
