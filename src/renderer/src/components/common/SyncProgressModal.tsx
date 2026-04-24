import { useEffect, useState } from 'react'
import { AppButton } from './AppButton'
import { useInitialSyncStatus } from '../../hooks/useInitialSyncStatus'
import type { InitialSyncEntity } from '../../../../shared/types'
import './sync-progress-modal.css'

const ENTITY_LABELS: Record<InitialSyncEntity, string> = {
  settings: 'Business Settings',
  tax_codes: 'Tax Codes',
  distributors: 'Distributors',
  item_types: 'Item Types',
  departments: 'Departments',
  cashiers: 'Cashiers',
  products: 'Products'
}

const ENTITY_ORDER: InitialSyncEntity[] = [
  'settings',
  'tax_codes',
  'distributors',
  'item_types',
  'departments',
  'cashiers',
  'products'
]

type EntityRowState = 'pending' | 'active' | 'done' | 'failed'

type Props = {
  onComplete: () => void
  onContinueOffline: () => void
}

export function SyncProgressModal({ onComplete, onContinueOffline }: Props): React.JSX.Element {
  const status = useInitialSyncStatus()
  const [retrying, setRetrying] = useState(false)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    if (status.state === 'done') {
      setShowDone(true)
      const t = setTimeout(() => {
        onComplete()
      }, 1000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [status.state, onComplete])

  const getRowState = (entity: InitialSyncEntity): EntityRowState => {
    if (status.completed.includes(entity)) {
      return status.errors.some((e) => e.entity === entity) ? 'failed' : 'done'
    }
    if (status.currentEntity === entity) return 'active'
    return 'pending'
  }

  const handleRetry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await window.api?.retryInitialSync?.()
    } finally {
      setRetrying(false)
    }
  }

  const isFailed = status.state === 'failed'
  const isRunning = status.state === 'running' || status.state === 'idle'

  return (
    <div className="sync-progress-modal">
      <div className="sync-progress-modal__card">
        <div className="sync-progress-modal__header">
          <h1 className="sync-progress-modal__title">Syncing your data</h1>
          <p className="sync-progress-modal__subtitle">Setting up this register — please wait</p>
        </div>

        <div className="sync-progress-modal__entities">
          {ENTITY_ORDER.map((entity) => {
            const rowState = getRowState(entity)
            const error = status.errors.find((e) => e.entity === entity)
            const progress = status.progress[entity]
            const progressPercent =
              progress && progress.total > 0
                ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
                : 0

            return (
              <div
                key={entity}
                className={`sync-progress-modal__row sync-progress-modal__row--${rowState}`}
              >
                <span className="sync-progress-modal__row-icon">
                  {rowState === 'done' && '✓'}
                  {rowState === 'failed' && '✕'}
                  {rowState === 'active' && '›'}
                  {rowState === 'pending' && '·'}
                </span>
                <div className="sync-progress-modal__row-content">
                  <span className="sync-progress-modal__row-label">{ENTITY_LABELS[entity]}</span>
                  {rowState === 'active' && (
                    <span className="sync-progress-modal__row-progress">
                      {progress
                        ? `${progress.processed} / ${progress.total} · ${progressPercent}%`
                        : 'Syncing...'}
                    </span>
                  )}
                  {rowState === 'active' && progress && (
                    <progress
                      className="sync-progress-modal__progress"
                      value={progress.processed}
                      max={progress.total}
                    />
                  )}
                  {rowState === 'done' && (
                    <span className="sync-progress-modal__row-ok">Complete</span>
                  )}
                  {rowState === 'failed' && error && (
                    <span className="sync-progress-modal__row-error">{error.message}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {showDone && (
          <div className="sync-progress-modal__done">
            <span className="sync-progress-modal__done-check">✓</span>
            <span className="sync-progress-modal__done-label">Ready</span>
          </div>
        )}

        {isFailed && !showDone && (
          <div className="sync-progress-modal__footer">
            <p className="sync-progress-modal__footer-note">
              Some data could not be synced. You can continue setting up this register offline —
              data will sync automatically when connectivity is restored.
            </p>
            <div className="sync-progress-modal__footer-actions">
              <AppButton variant="neutral" onClick={onContinueOffline}>
                Continue offline
              </AppButton>
              <AppButton variant="default" disabled={retrying} onClick={() => void handleRetry()}>
                {retrying ? 'Retrying...' : 'Retry sync'}
              </AppButton>
            </div>
          </div>
        )}

        {isRunning && (
          <div className="sync-progress-modal__footer">
            <p className="sync-progress-modal__footer-note">Do not close the application.</p>
          </div>
        )}
      </div>
    </div>
  )
}
