import { useCallback, useState } from 'react'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { AppButton } from '@renderer/components/common/AppButton'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import type { Cashier, CashierRole } from '../../../../../shared/types'
import './cashier-panel.css'

export function CashierPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined

  const loadFn = useCallback(() => api!.getCashiers(), [api])
  const { items, error, success, editingId, setEditingId, runAction, clearMessages } =
    useCrudPanel<Cashier>({ entityName: 'cashier', loadFn: api ? loadFn : undefined })

  // ── New cashier form ──
  const [newName, setNewName] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newRole, setNewRole] = useState<CashierRole>('cashier')

  // ── Edit state ──
  const [editName, setEditName] = useState('')
  const [editPin, setEditPin] = useState('')
  const [editRole, setEditRole] = useState<CashierRole>('cashier')
  const [editActive, setEditActive] = useState(true)

  // ── Delete confirm ──
  const [deleteTarget, setDeleteTarget] = useState<Cashier | null>(null)

  const editingCashier = items.find((c) => c.id === editingId) ?? null

  const handleAdd = async (): Promise<void> => {
    if (!newName.trim() || newPin.length !== 4) return
    await runAction(
      () => api!.createCashier({ name: newName.trim(), pin: newPin, role: newRole }),
      'Cashier created'
    )
    setNewName('')
    setNewPin('')
    setNewRole('cashier')
  }

  const handleSelectRow = (cashier: Cashier): void => {
    clearMessages()
    setEditingId(cashier.id)
    setEditName(cashier.name)
    setEditPin('')
    setEditRole(cashier.role)
    setEditActive(cashier.is_active === 1)
  }

  const handleSave = async (): Promise<void> => {
    if (!editingId || !editName.trim()) return
    await runAction(
      () =>
        api!.updateCashier({
          id: editingId,
          name: editName.trim(),
          ...(editPin.length === 4 ? { pin: editPin } : {}),
          role: editRole,
          is_active: editActive ? 1 : 0
        }),
      'Cashier updated'
    )
    setEditPin('')
  }

  const handleCancelEdit = (): void => {
    setEditingId(null)
    clearMessages()
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    await runAction(() => api!.deleteCashier(deleteTarget.id), 'Cashier deleted')
    setDeleteTarget(null)
    if (editingId === deleteTarget.id) setEditingId(null)
  }

  return (
    <div className="cashier-panel">
      {/* ── Add form ── */}
      <div className="cashier-panel__form">
        <ValidatedInput
          value={newName}
          onChange={setNewName}
          placeholder="Cashier name"
          fieldType="text"
        />
        <input
          className="cashier-panel__pin-input"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit PIN"
          type="password"
          maxLength={4}
        />
        <select
          className="cashier-panel__select"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as CashierRole)}
        >
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
        <AppButton variant="success" size="md" onClick={() => void handleAdd()}>
          Add
        </AppButton>
      </div>

      {/* ── List ── */}
      <div className="cashier-panel__list-wrap">
        {items.length === 0 ? (
          <p className="cashier-panel__empty">No cashiers yet. Add one above.</p>
        ) : (
          <table className="cashier-panel__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  className={`cashier-panel__row${editingId === c.id ? ' cashier-panel__row--selected' : ''}`}
                  onClick={() => handleSelectRow(c)}
                >
                  <td>{c.name}</td>
                  <td>
                    <span className={`cashier-panel__badge cashier-panel__badge--${c.role}`}>
                      {c.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`cashier-panel__badge cashier-panel__badge--${c.is_active ? 'active' : 'inactive'}`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <AppButton
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(c)
                      }}
                    >
                      Delete
                    </AppButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit section / status ── */}
      {editingCashier ? (
        <div className="cashier-panel__edit-section">
          <div className="cashier-panel__edit-header">
            <span className="cashier-panel__edit-title">Editing: {editingCashier.name}</span>
            <div className="cashier-panel__edit-actions">
              <AppButton variant="success" size="sm" onClick={() => void handleSave()}>
                Save
              </AppButton>
              <AppButton variant="neutral" size="sm" onClick={handleCancelEdit}>
                Cancel
              </AppButton>
            </div>
          </div>
          <div className="cashier-panel__edit-fields">
            <ValidatedInput
              value={editName}
              onChange={setEditName}
              placeholder="Name"
              fieldType="text"
            />
            <input
              className="cashier-panel__pin-input"
              value={editPin}
              onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="New PIN"
              type="password"
              maxLength={4}
            />
            <select
              className="cashier-panel__select"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as CashierRole)}
            >
              <option value="cashier">Cashier</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <label
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}
          >
            <input
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
            />
            <span style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>Active</span>
          </label>
        </div>
      ) : (
        <div className="cashier-panel__edit-placeholder">
          <p className="cashier-panel__edit-placeholder-text">Select a cashier to edit</p>
        </div>
      )}

      {/* ── Status messages ── */}
      <div className="cashier-panel__status-area">
        {error && <p className="cashier-panel__msg--error">{error}</p>}
        {success && <p className="cashier-panel__msg--success">{success}</p>}
      </div>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Cashier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
