import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import { cn } from '@renderer/lib/utils'
import type { TaxCode } from '@renderer/types/pos'
import '../crud-panel.css'

type TaxCodePanelProps = {
  searchFilter?: string
}

export function TaxCodePanel({ searchFilter = '' }: TaxCodePanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getTaxCodes === 'function'

  const loadTaxCodes = useCallback(async (): Promise<TaxCode[]> => {
    const a = window.api
    if (typeof a?.getTaxCodes !== 'function') return []
    return a.getTaxCodes()
  }, [])

  const crud = useCrudPanel<TaxCode>({
    entityName: 'tax code',
    loadFn: hasApi ? loadTaxCodes : undefined
  })

  const [selectedTcId, setSelectedTcId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showApplyAllConfirm, setShowApplyAllConfirm] = useState(false)
  const [applyingAll, setApplyingAll] = useState(false)
  const applyAllResultRef = useRef<string | null>(null)

  // New entry form
  const [newCode, setNewCode] = useState('')
  const [newRate, setNewRate] = useState('')

  // Edit form fields
  const [editCode, setEditCode] = useState('')
  const [editRate, setEditRate] = useState('')
  const [showEditValidation, setShowEditValidation] = useState(false)

  const filteredTaxCodes = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return crud.items
    return crud.items.filter(
      (tc) =>
        tc.code.toLowerCase().includes(q) ||
        String(parseFloat((tc.rate * 100).toFixed(4))).includes(q)
    )
  }, [crud.items, searchFilter])

  const selectedTc = useMemo(
    () => crud.items.find((tc) => tc.id === selectedTcId) ?? null,
    [crud.items, selectedTcId]
  )

  const hasEditChanges = useMemo(() => {
    if (!selectedTc) return false
    return (
      editCode !== selectedTc.code ||
      editRate !== String(parseFloat((selectedTc.rate * 100).toFixed(4)))
    )
  }, [selectedTc, editCode, editRate])

  const { clearMessages } = crud
  const clearSelection = useCallback((): void => {
    setSelectedTcId(null)
    setEditCode('')
    setEditRate('')
    setShowEditValidation(false)
    clearMessages()
  }, [clearMessages])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedTcId !== null) clearSelection()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedTcId, clearSelection])

  const selectTaxCode = (tc: TaxCode): void => {
    crud.clearMessages()
    setSelectedTcId(tc.id)
    setEditCode(tc.code)
    setEditRate(String(parseFloat((tc.rate * 100).toFixed(4))))
    setShowEditValidation(false)
  }

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
      crud.setError('Backend API unavailable. Please restart the application.')
      return
    }

    if (fieldErrors.code || fieldErrors.rate) return

    const rate = Number.parseFloat(newRate) / 100

    const freshItems = await crud.runAction(
      () => api.createTaxCode({ code: newCode.trim(), rate }),
      'Tax code created'
    )
    if (freshItems) {
      setNewCode('')
      setNewRate('')
      crud.setShowValidation(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    crud.clearMessages()
    setShowEditValidation(true)

    if (!hasApi || !selectedTcId) return

    const trimmedCode = editCode.trim()
    if (!trimmedCode) return

    const parsedRate = Number.parseFloat(editRate)
    if (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      crud.setError('Rate must be 0\u2013100')
      return
    }

    const tcId = selectedTcId
    const freshItems = await crud.runAction(
      () => api.updateTaxCode({ id: tcId, code: trimmedCode, rate: parsedRate / 100 }),
      'Tax code updated'
    )
    if (freshItems) {
      setShowEditValidation(false)
      const saved = freshItems.find((tc) => tc.id === tcId)
      if (saved) {
        setEditCode(saved.code)
        setEditRate(String(parseFloat((saved.rate * 100).toFixed(4))))
      }
    }
  }

  const handleDelete = (): void => {
    if (!hasApi || !selectedTcId) return
    setShowDeleteConfirm(true)
  }

  const handleApplyToAll = async (): Promise<void> => {
    setShowApplyAllConfirm(false)
    if (!hasApi || !selectedTc) return
    setApplyingAll(true)
    crud.clearMessages()
    try {
      const result = await window.api!.applyTaxToAll(selectedTc.rate)
      applyAllResultRef.current = `${selectedTc.code} applied to ${result.updated.toLocaleString()} items.`
      crud.setSuccess(applyAllResultRef.current)
    } catch (err) {
      crud.setError(err instanceof Error ? err.message : 'Failed to apply tax')
    } finally {
      setApplyingAll(false)
    }
  }

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (!hasApi || !selectedTcId) return

    const freshItems = await crud.runAction(
      () => api.deleteTaxCode(selectedTcId),
      'Tax code deleted'
    )
    if (freshItems) {
      setSelectedTcId(null)
      setEditCode('')
      setEditRate('')
    }
  }

  const codeError = !newCode.trim() ? 'Code is required' : undefined
  const rateError = (() => {
    if (!newRate.trim()) return 'Rate is required'
    const parsed = Number.parseFloat(newRate)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return 'Rate must be 0–100'
    return undefined
  })()
  const editCodeError = showEditValidation && !editCode.trim() ? 'Code is required' : undefined

  return (
    <div className="crud-panel__root" aria-label="Tax Codes">
      {/* Section 1: New entry form */}
      <div className="crud-panel__new-form--tc">
        <FormField label="Code" required error={codeError} showError={crud.showValidation}>
          <ValidatedInput
            fieldType="name"
            aria-label="Tax Code Name"
            placeholder="e.g. HST, GST"
            value={newCode}
            onChange={setNewCode}
          />
        </FormField>
        <FormField label="Rate (%)" required error={rateError} showError={crud.showValidation}>
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
        <AppButton
          size="md"
          variant="success"
          className="crud-panel__add-btn"
          onClick={() => void handleCreate()}
        >
          Add
        </AppButton>
      </div>

      {/* Section 2: Scrollable tax code list */}
      <div className="crud-panel__list-wrap">
        {filteredTaxCodes.length === 0 ? (
          <p className="crud-panel__empty-text">
            {crud.items.length === 0
              ? 'No tax codes yet. Add one above to get started.'
              : 'No tax codes match your search.'}
          </p>
        ) : (
          <table className="crud-panel__table" aria-label="Tax codes list">
            <thead>
              <tr>
                <th>Code</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredTaxCodes.map((tc) => (
                <tr
                  key={tc.id}
                  className={cn(
                    'crud-panel__row',
                    selectedTcId === tc.id && 'crud-panel__row--selected'
                  )}
                  onClick={() => selectTaxCode(tc)}
                >
                  <td>{tc.code}</td>
                  <td>{`${parseFloat((tc.rate * 100).toFixed(4))}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="crud-panel__edit-section">
        {selectedTc ? (
          <div className="crud-panel__edit-grid">
            <div className="crud-panel__edit-header">
              <span className="crud-panel__edit-title">Editing: {selectedTc.code}</span>
              <div className="crud-panel__edit-actions">
                <AppButton
                  size="sm"
                  variant="success"
                  disabled={!hasEditChanges}
                  onClick={() => void handleSave()}
                >
                  Save
                </AppButton>
                <AppButton size="sm" variant="danger" onClick={handleDelete}>
                  Delete
                </AppButton>
                <AppButton size="sm" variant="neutral" onClick={clearSelection}>
                  Cancel
                </AppButton>
                <AppButton
                  size="sm"
                  variant="warning"
                  disabled={applyingAll}
                  onClick={() => setShowApplyAllConfirm(true)}
                >
                  {applyingAll ? 'Applying...' : 'Apply to All Items'}
                </AppButton>
              </div>
            </div>
            <div className="crud-panel__edit-fields">
              <FormField label="Code" required error={editCodeError} showError={showEditValidation}>
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Tax Code Name"
                  value={editCode}
                  onChange={setEditCode}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
              <FormField label="Rate (%)" required error={undefined} showError={false}>
                <ValidatedInput
                  fieldType="decimal"
                  aria-label="Edit Tax Rate"
                  value={editRate}
                  onChange={setEditRate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
            </div>
            {/* Status messages */}
            <div className="crud-panel__status-area">
              {crud.success && <p className="crud-panel__msg--success">{crud.success}</p>}
              {crud.error && <p className="crud-panel__msg--error">{crud.error}</p>}
            </div>
          </div>
        ) : (
          <div className="crud-panel__edit-placeholder">
            <p className="crud-panel__edit-placeholder-text">
              Select a tax code above to view and edit its details.
            </p>
            <div className="crud-panel__status-area--mt">
              {crud.success && <p className="crud-panel__msg--success">{crud.success}</p>}
              {crud.error && <p className="crud-panel__msg--error">{crud.error}</p>}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Tax Code"
        message={`Are you sure you want to delete tax code "${selectedTc?.code}"? This cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showApplyAllConfirm}
        title="Apply Tax to All Items"
        message={`This will set "${selectedTc?.code}" (${selectedTc ? parseFloat((selectedTc.rate * 100).toFixed(4)) : 0}%) as the tax rate on every active product. This overwrites existing tax assignments. Continue?`}
        confirmLabel="Yes, Apply to All"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => void handleApplyToAll()}
        onCancel={() => setShowApplyAllConfirm(false)}
      />
    </div>
  )
}
