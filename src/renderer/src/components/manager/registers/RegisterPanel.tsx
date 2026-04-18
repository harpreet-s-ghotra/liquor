import { useCallback, useEffect, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { cn } from '@renderer/lib/utils'
import type { Register } from '../../../../../shared/types'
import './register-panel.css'

export function RegisterPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Register | null>(null)

  const loadRegisters = useCallback(async () => {
    if (!api) return
    try {
      setLoading(true)
      const data = await api.listRegisters()
      setRegisters(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load registers')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadRegisters()
  }, [loadRegisters])

  const handleStartRename = (reg: Register): void => {
    setRenamingId(reg.id)
    setRenameValue(reg.device_name)
    setError(null)
    setSuccess(null)
  }

  const handleSaveRename = async (): Promise<void> => {
    if (!renamingId || !renameValue.trim()) return
    try {
      await api!.renameRegister(renamingId, renameValue.trim())
      setSuccess('Register renamed')
      setRenamingId(null)
      await loadRegisters()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename register')
    }
  }

  const handleCancelRename = (): void => {
    setRenamingId(null)
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await api!.deleteRegister(deleteTarget.id)
      setSuccess('Register deleted')
      setDeleteTarget(null)
      await loadRegisters()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete register')
    }
  }

  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString()
  }

  const formatDateTime = (iso: string): string => {
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  if (loading) {
    return (
      <div className="register-panel">
        <div className="register-panel__loading">Loading registers...</div>
      </div>
    )
  }

  return (
    <div className="register-panel">
      <div className="register-panel__list-wrap">
        {registers.length === 0 ? (
          <p className="register-panel__empty">No registers found.</p>
        ) : (
          <table className="register-panel__table">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Fingerprint</th>
                <th>Last Seen</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {registers.map((reg) => (
                <tr
                  key={reg.id}
                  className={cn(
                    'register-panel__row',
                    reg.is_current && 'register-panel__row--current'
                  )}
                >
                  <td>
                    <div className="register-panel__name-cell">
                      {renamingId === reg.id ? (
                        <>
                          <input
                            className="register-panel__rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleSaveRename()
                              if (e.key === 'Escape') handleCancelRename()
                            }}
                            autoFocus
                          />
                          <div className="register-panel__actions">
                            <AppButton
                              variant="success"
                              size="sm"
                              onClick={() => void handleSaveRename()}
                            >
                              Save
                            </AppButton>
                            <AppButton variant="neutral" size="sm" onClick={handleCancelRename}>
                              Cancel
                            </AppButton>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>{reg.device_name}</span>
                          {reg.is_current && (
                            <span className="register-panel__badge register-panel__badge--current">
                              Current
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="register-panel__fingerprint">
                      {reg.device_fingerprint.slice(0, 12)}...
                    </span>
                  </td>
                  <td>{formatDateTime(reg.last_seen_at)}</td>
                  <td>{formatDate(reg.created_at)}</td>
                  <td>
                    <div className="register-panel__actions">
                      {renamingId !== reg.id && (
                        <AppButton
                          variant="neutral"
                          size="sm"
                          onClick={() => handleStartRename(reg)}
                        >
                          Rename
                        </AppButton>
                      )}
                      {!reg.is_current && (
                        <AppButton variant="danger" size="sm" onClick={() => setDeleteTarget(reg)}>
                          Delete
                        </AppButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status messages */}
      <div className="register-panel__status-area">
        {error && <p className="register-panel__msg--error">{error}</p>}
        {success && <p className="register-panel__msg--success">{success}</p>}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Register"
        message={`Are you sure you want to delete register "${deleteTarget?.device_name}"? This cannot be undone.`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
