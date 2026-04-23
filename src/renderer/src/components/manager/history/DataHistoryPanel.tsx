import { useCallback, useEffect, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import type {
  LocalTransactionHistoryStats,
  TransactionBackfillStatus
} from '../../../../../shared/types'
import { scoped } from '@renderer/lib/logger'
import './data-history-panel.css'

const SAFE_BACKFILL_DAYS = 365

const log = scoped('data-history')

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function formatInt(n: number): string {
  return n.toLocaleString()
}

export function DataHistoryPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [stats, setStats] = useState<LocalTransactionHistoryStats | null>(null)
  const [backfill, setBackfill] = useState<TransactionBackfillStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [daysInput, setDaysInput] = useState<string>(String(SAFE_BACKFILL_DAYS))
  const [confirmLargePull, setConfirmLargePull] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    try {
      const [s, b] = await Promise.all([api.getLocalHistoryStats(), api.getBackfillStatus()])
      setStats(s)
      setBackfill(b)
      setLoadError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load history info'
      log.error(msg)
      setLoadError(msg)
    }
  }, [api])

  useEffect(() => {
    // Fire in a microtask so any setState inside `refresh` settles outside the
    // effect's synchronous path — avoids the cascading-render lint complaint.
    const id = setTimeout(() => {
      void refresh()
    }, 0)
    return () => clearTimeout(id)
  }, [refresh])

  useEffect(() => {
    if (!api || typeof api.onBackfillStatusChanged !== 'function') return
    const dispose = api.onBackfillStatusChanged((status) => {
      setBackfill(status)
      // Refresh stats when a backfill finishes so the earliest-date card reflects reality.
      if (status.state === 'done' || status.state === 'failed') {
        void api
          .getLocalHistoryStats()
          .then(setStats)
          .catch(() => {})
      }
    })
    return dispose
  }, [api])

  const running = backfill?.state === 'running'

  const handlePull = useCallback(
    async (days: number) => {
      if (!api) return
      try {
        setActionError(null)
        await api.triggerBackfill(days)
        await refresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start backfill'
        setActionError(msg)
        log.error(msg)
      }
    },
    [api, refresh]
  )

  const handleSubmit = useCallback(() => {
    const n = Number(daysInput)
    if (!Number.isFinite(n) || n <= 0) {
      setActionError('Enter a positive number of days')
      return
    }
    if (n > SAFE_BACKFILL_DAYS) {
      setConfirmLargePull(n)
      return
    }
    void handlePull(n)
  }, [daysInput, handlePull])

  const earliestRelative = formatRelative(stats?.earliest ?? null)
  const lastRunRelative = formatRelative(backfill?.finishedAt ?? null)

  return (
    <div className="data-history">
      <div className="data-history__intro">
        <p>
          Sales reports are generated from data stored on this computer. Use this page to see how
          far back your local records go and to pull older data from the cloud when needed.
        </p>
      </div>

      {loadError && (
        <div className="data-history__error">
          <strong>Couldn&apos;t load history info.</strong> {loadError}
        </div>
      )}

      {/* Stats cards */}
      <div className="data-history__cards">
        <div className="data-history__card">
          <span className="data-history__card-label">Local transactions</span>
          <span className="data-history__card-value">{stats ? formatInt(stats.count) : '—'}</span>
        </div>

        <div className="data-history__card">
          <span className="data-history__card-label">Earliest record</span>
          <span className="data-history__card-value">{formatDate(stats?.earliest ?? null)}</span>
          {earliestRelative && <span className="data-history__card-sub">{earliestRelative}</span>}
        </div>

        <div className="data-history__card">
          <span className="data-history__card-label">Most recent record</span>
          <span className="data-history__card-value">{formatDate(stats?.latest ?? null)}</span>
        </div>
      </div>

      {/* Backfill status */}
      <div className="data-history__section">
        <h3 className="data-history__section-title">Background history pull</h3>

        {backfill?.state === 'running' ? (
          <div className="data-history__status data-history__status--running">
            <div className="data-history__status-row">
              <strong>Pulling last {backfill.days} days…</strong>
              <span>{formatInt(backfill.applied)} applied</span>
              <span>{formatInt(backfill.skipped)} already local</span>
              {backfill.errors > 0 && (
                <span className="data-history__status-errors">
                  {formatInt(backfill.errors)} errors
                </span>
              )}
            </div>
            <div className="data-history__status-hint">
              You can keep using the app — this runs in the background.
            </div>
          </div>
        ) : backfill?.state === 'done' || backfill?.state === 'failed' ? (
          <div className={`data-history__status data-history__status--${backfill.state}`}>
            <div className="data-history__status-row">
              <strong>
                {backfill.state === 'done' ? 'Last pull complete' : 'Last pull failed'}
              </strong>
              <span>{formatInt(backfill.applied)} applied</span>
              <span>{formatInt(backfill.skipped)} already local</span>
              {backfill.errors > 0 && (
                <span className="data-history__status-errors">
                  {formatInt(backfill.errors)} errors
                </span>
              )}
              {lastRunRelative && (
                <span className="data-history__status-relative">{lastRunRelative}</span>
              )}
            </div>
            {backfill.lastError && (
              <div className="data-history__status-hint">Last error: {backfill.lastError}</div>
            )}
          </div>
        ) : (
          <div className="data-history__status data-history__status--idle">
            <span>No pull running.</span>
          </div>
        )}
      </div>

      {/* Manual pull */}
      <div className="data-history__section">
        <h3 className="data-history__section-title">Manual pull from cloud</h3>
        <p className="data-history__section-hint">
          Downloads transaction history from the cloud into this computer. Pulls up to{' '}
          {SAFE_BACKFILL_DAYS} days without confirmation. Anything longer is a heavy request and
          asks for confirmation first.
        </p>

        <div className="data-history__form">
          <label className="data-history__label" htmlFor="backfill-days">
            Days to pull
          </label>
          <input
            id="backfill-days"
            type="number"
            min={1}
            step={1}
            className="data-history__input"
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            disabled={running}
          />
          <AppButton variant="default" onClick={handleSubmit} disabled={running || !api}>
            {running ? 'Running…' : 'Start pull'}
          </AppButton>
        </div>

        {actionError && <div className="data-history__error">{actionError}</div>}
      </div>

      <ConfirmDialog
        isOpen={confirmLargePull !== null}
        title="Heavy history pull"
        message={
          confirmLargePull
            ? `Pulling ${confirmLargePull} days of transactions from the cloud is a heavy request and may slow the database down during the pull. Continue?`
            : ''
        }
        confirmLabel="Start heavy pull"
        cancelLabel="Cancel"
        onConfirm={() => {
          const d = confirmLargePull
          setConfirmLargePull(null)
          if (d !== null) void handlePull(d)
        }}
        onCancel={() => setConfirmLargePull(null)}
      />
    </div>
  )
}
