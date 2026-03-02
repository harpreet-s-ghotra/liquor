import { useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { TaxCode } from '@renderer/types/pos'
import '../crud-panel.css'

export function TaxCodePanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getTaxCodes === 'function'

  const crud = useCrudPanel<TaxCode>({
    entityName: 'tax code',
    loadFn: hasApi ? () => api.getTaxCodes() : undefined
  })

  const [newCode, setNewCode] = useState('')
  const [newRate, setNewRate] = useState('')
  const [editingCode, setEditingCode] = useState('')
  const [editingRate, setEditingRate] = useState('')

  const fieldErrors = {
    code: !newCode.trim() ? 'Code is required' : undefined,
    rate: (() => {
      if (!newRate.trim()) return 'Rate is required'
      const parsed = Number.parseFloat(newRate)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 'Rate must be 0–100'
      return undefined
    })()
  }

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Run the app via Electron (npm run dev).')
      return
    }

    if (fieldErrors.code || fieldErrors.rate) return

    const rate = Number.parseFloat(newRate) / 100

    const ok = await crud.runAction(
      () => api.createTaxCode({ code: newCode.trim(), rate }),
      'Tax code created'
    )
    if (ok) {
      setNewCode('')
      setNewRate('')
      crud.setShowValidation(false)
    }
  }

  const handleUpdate = async (id: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    const trimmedCode = editingCode.trim()
    if (!trimmedCode) {
      crud.setError('Code is required')
      return
    }

    const parsedRate = Number.parseFloat(editingRate)
    if (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      crud.setError('Rate must be 0–100')
      return
    }

    const ok = await crud.runAction(
      () => api.updateTaxCode({ id, code: trimmedCode, rate: parsedRate / 100 }),
      'Tax code updated'
    )
    if (ok) {
      crud.setEditingId(null)
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    await crud.runAction(() => api.deleteTaxCode(id), 'Tax code deleted')
  }

  const startEdit = (tc: TaxCode): void => {
    crud.clearMessages()
    crud.setEditingId(tc.id)
    setEditingCode(tc.code)
    setEditingRate(String((tc.rate * 100).toFixed(2)))
  }

  const cancelEdit = (): void => {
    crud.setEditingId(null)
    setEditingCode('')
    setEditingRate('')
  }

  return (
    <div className="crud-panel" aria-label="Tax Codes">
      <div className="crud-panel__form crud-panel__form--wide">
        <FormField label="Code" required error={fieldErrors.code} showError={crud.showValidation}>
          <ValidatedInput
            fieldType="name"
            aria-label="Tax Code Name"
            placeholder="e.g. HST, GST"
            value={newCode}
            onChange={setNewCode}
          />
        </FormField>
        <FormField
          label="Rate (%)"
          required
          error={fieldErrors.rate}
          showError={crud.showValidation}
        >
          <ValidatedInput
            fieldType="decimal"
            aria-label="Tax Rate"
            placeholder="e.g. 13"
            value={newRate}
            onChange={setNewRate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
        </FormField>
        <AppButton size="md" variant="success" onClick={() => void handleCreate()}>
          Add Tax Code
        </AppButton>
      </div>

      <div className="crud-panel__list">
        {crud.items.length === 0 ? (
          <p className="crud-panel__empty">No tax codes yet. Add one above to get started.</p>
        ) : (
          <table className="crud-panel__table" aria-label="Tax codes list">
            <thead>
              <tr>
                <th>Code</th>
                <th>Rate</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {crud.items.map((tc) => (
                <tr key={tc.id}>
                  <td>
                    {crud.editingId === tc.id ? (
                      <ValidatedInput
                        fieldType="name"
                        className="crud-panel__edit-input"
                        aria-label="Edit Tax Code Name"
                        value={editingCode}
                        onChange={setEditingCode}
                        autoFocus
                      />
                    ) : (
                      tc.code
                    )}
                  </td>
                  <td>
                    {crud.editingId === tc.id ? (
                      <ValidatedInput
                        fieldType="decimal"
                        className="crud-panel__edit-input"
                        aria-label="Edit Tax Rate"
                        value={editingRate}
                        onChange={setEditingRate}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleUpdate(tc.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    ) : (
                      `${(tc.rate * 100).toFixed(2)}%`
                    )}
                  </td>
                  <td>
                    <div className="crud-panel__actions">
                      {crud.editingId === tc.id ? (
                        <>
                          <AppButton
                            size="sm"
                            variant="success"
                            onClick={() => void handleUpdate(tc.id)}
                          >
                            Save
                          </AppButton>
                          <AppButton size="sm" variant="neutral" onClick={cancelEdit}>
                            Cancel
                          </AppButton>
                        </>
                      ) : (
                        <>
                          <AppButton size="sm" onClick={() => startEdit(tc)}>
                            Edit
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDelete(tc.id)}
                          >
                            Delete
                          </AppButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="crud-panel__status">
        {crud.success && <p className="crud-panel__message success">{crud.success}</p>}
        {crud.error && <p className="crud-panel__message error">{crud.error}</p>}
      </div>
    </div>
  )
}
