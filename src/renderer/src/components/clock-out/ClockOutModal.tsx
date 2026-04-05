import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { cn } from '@renderer/lib/utils'
import { ClockOutReportView } from './ClockOutReport'
import type { Session, ClockOutReport } from '@renderer/types/pos'
import './clock-out-modal.css'

type ClockOutModalProps = {
  isOpen: boolean
  onClose: () => void
}

type ModalView = 'list' | 'pin' | 'report'

const PAGE_SIZE = 25

export function ClockOutModal({ isOpen, onClose }: ClockOutModalProps): React.JSX.Element {
  const currentCashier = useAuthStore((s) => s.currentCashier)
  const setCurrentSessionId = useAuthStore((s) => s.setCurrentSessionId)
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [view, setView] = useState<ModalView>('list')
  const [sessions, setSessions] = useState<Session[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PIN state
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null)

  // Report state
  const [report, setReport] = useState<ClockOutReport | null>(null)
  const [printing, setPrinting] = useState(false)

  const loadSessions = useCallback(
    async (pageNum: number) => {
      if (!api?.listSessions) return
      setLoading(true)
      setError(null)
      try {
        const result = await api.listSessions(PAGE_SIZE, pageNum * PAGE_SIZE)
        setSessions(result.sessions)
        setTotalCount(result.total_count)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  // Load sessions when modal opens
  useEffect(() => {
    if (isOpen) {
      setView('list')
      setPin('')
      setPinError(null)
      setReport(null)
      setError(null)
      setPage(0)
      void loadSessions(0)
    }
  }, [isOpen, loadSessions])

  const handleClockOut = (sessionId: number): void => {
    setTargetSessionId(sessionId)
    setPin('')
    setPinError(null)
    setView('pin')
  }

  const handleViewReport = async (sessionId: number): Promise<void> => {
    if (!api?.getSessionReport) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.getSessionReport(sessionId)
      setReport(r)
      setView('report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handlePinSubmit = async (): Promise<void> => {
    if (!api?.validatePin || !api?.closeSession || !api?.getSessionReport) return
    if (pin.length !== 4) return

    setPinError(null)
    try {
      const cashier = await api.validatePin(pin)
      if (!cashier) {
        setPinError('Invalid PIN')
        setPin('')
        return
      }

      // Accept if it's the current cashier or an admin
      if (cashier.id !== currentCashier?.id && cashier.role !== 'admin') {
        setPinError('Invalid PIN')
        setPin('')
        return
      }

      // Close the session
      await api.closeSession({
        session_id: targetSessionId!,
        cashier_id: cashier.id,
        cashier_name: cashier.name
      })

      // Load the report
      const r = await api.getSessionReport(targetSessionId!)
      setReport(r)
      setView('report')

      // Auto-create a new session so the register is ready for the next shift
      try {
        const newSession = await api.createSession({
          cashier_id: currentCashier!.id,
          cashier_name: currentCashier!.name
        })
        setCurrentSessionId(newSession.id)
      } catch {
        // Non-critical — next login will create the session
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Failed to close session')
      setPin('')
    }
  }

  const handlePinDigit = (digit: string): void => {
    if (pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setPinError(null)
  }

  const handlePinBackspace = (): void => {
    setPin((prev) => prev.slice(0, -1))
    setPinError(null)
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && view === 'pin') {
      void handlePinSubmit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // Keyboard support for PIN pad
  useEffect(() => {
    if (view !== 'pin') return
    const handler = (e: KeyboardEvent): void => {
      if (e.key >= '0' && e.key <= '9') handlePinDigit(e.key)
      else if (e.key === 'Backspace') handlePinBackspace()
      else if (e.key === 'Escape') setView('list')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pin])

  const handlePrint = async (): Promise<void> => {
    if (!api?.printClockOutReport || !report) return
    setPrinting(true)
    try {
      const merchantConfig = await api.getMerchantConfig()
      await api.printClockOutReport({
        store_name: merchantConfig?.merchant_name ?? 'Store',
        cashier_name: currentCashier?.name ?? 'Unknown',
        report
      })
    } catch {
      // Print errors are non-critical
    } finally {
      setPrinting(false)
    }
  }

  const handleClose = (): void => {
    onClose()
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handlePrevPage = (): void => {
    const prev = Math.max(0, page - 1)
    setPage(prev)
    void loadSessions(prev)
  }

  const handleNextPage = (): void => {
    const next = Math.min(totalPages - 1, page + 1)
    setPage(next)
    void loadSessions(next)
  }

  function formatSessionDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatSessionTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="clock-out-modal"
        aria-label="Clock Out"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {view === 'list' && 'Sessions'}
            {view === 'pin' && 'Confirm Clock Out'}
            {view === 'report' && 'End of Day Report'}
          </DialogTitle>
          <AppButton size="sm" variant="danger" onClick={handleClose}>
            Close
          </AppButton>
        </DialogHeader>

        {error && <p className="clock-out-modal__error">{error}</p>}

        {/* View 1: Session List */}
        {view === 'list' && (
          <div className="clock-out-modal__list">
            {sessions.length === 0 && !loading ? (
              <p className="clock-out-modal__empty">No sessions found.</p>
            ) : (
              <table className="clock-out-modal__table" data-testid="session-list">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Opened By</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      className={cn(
                        'clock-out-modal__row',
                        s.status === 'active' && 'clock-out-modal__row--active'
                      )}
                    >
                      <td>{s.id}</td>
                      <td>{formatSessionDate(s.started_at)}</td>
                      <td>
                        {formatSessionTime(s.started_at)}
                        {s.ended_at ? ` - ${formatSessionTime(s.ended_at)}` : ''}
                      </td>
                      <td>{s.opened_by_cashier_name}</td>
                      <td>
                        <span
                          className={cn(
                            'clock-out-modal__status',
                            s.status === 'active'
                              ? 'clock-out-modal__status--active'
                              : 'clock-out-modal__status--closed'
                          )}
                        >
                          {s.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td>
                        {s.status === 'active' ? (
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={() => handleClockOut(s.id)}
                            data-testid="clock-out-btn"
                          >
                            Clock Out
                          </AppButton>
                        ) : (
                          <AppButton
                            size="sm"
                            variant="neutral"
                            onClick={() => void handleViewReport(s.id)}
                            data-testid={`view-report-btn-${s.id}`}
                          >
                            View Report
                          </AppButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {totalPages > 1 && (
              <div className="clock-out-modal__pagination">
                <AppButton
                  size="sm"
                  variant="neutral"
                  disabled={page === 0}
                  onClick={handlePrevPage}
                >
                  Prev
                </AppButton>
                <span className="clock-out-modal__page-info">
                  Page {page + 1} of {totalPages}
                </span>
                <AppButton
                  size="sm"
                  variant="neutral"
                  disabled={page >= totalPages - 1}
                  onClick={handleNextPage}
                >
                  Next
                </AppButton>
              </div>
            )}
          </div>
        )}

        {/* View 2: PIN Verification */}
        {view === 'pin' && (
          <div className="clock-out-modal__pin" data-testid="pin-entry">
            <p className="clock-out-modal__pin-prompt">
              Enter your PIN or an admin PIN to clock out
            </p>

            <div className="clock-out-modal__pin-dots" data-testid="pin-dots">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'clock-out-modal__pin-dot',
                    i < pin.length && 'clock-out-modal__pin-dot--filled'
                  )}
                />
              ))}
            </div>

            {pinError && (
              <p className="clock-out-modal__pin-error" data-testid="pin-error">
                {pinError}
              </p>
            )}

            <div className="clock-out-modal__pin-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
                if (key === '') return <div key="empty" />
                if (key === 'back') {
                  return (
                    <button
                      key="back"
                      type="button"
                      className="clock-out-modal__pin-key"
                      onClick={handlePinBackspace}
                    >
                      Del
                    </button>
                  )
                }
                return (
                  <button
                    key={key}
                    type="button"
                    className="clock-out-modal__pin-key"
                    onClick={() => handlePinDigit(key)}
                  >
                    {key}
                  </button>
                )
              })}
            </div>

            <AppButton size="md" variant="neutral" onClick={() => setView('list')}>
              Cancel
            </AppButton>
          </div>
        )}

        {/* View 3: Report */}
        {view === 'report' && report && (
          <div className="clock-out-modal__report">
            <div className="clock-out-modal__report-scroll">
              <ClockOutReportView report={report} />
            </div>
            <div className="clock-out-modal__report-actions">
              <AppButton
                size="md"
                variant="default"
                onClick={() => void handlePrint()}
                disabled={printing}
              >
                {printing ? 'Printing...' : 'Print Report'}
              </AppButton>
              <AppButton size="md" variant="neutral" onClick={handleClose}>
                Close
              </AppButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
