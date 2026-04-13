import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import { cn } from '@renderer/lib/utils'
import type { Distributor, SalesRep } from '@renderer/types/pos'
import { ImportDistributorsDialog } from './ImportDistributorsDialog'
import '../crud-panel.css'

type DistributorPanelProps = {
  searchFilter?: string
}

export function DistributorPanel({ searchFilter = '' }: DistributorPanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getDistributors === 'function'

  const loadDistributors = useCallback(async (): Promise<Distributor[]> => {
    const a = window.api
    if (typeof a?.getDistributors !== 'function') return []
    return a.getDistributors()
  }, [])

  const crud = useCrudPanel<Distributor>({
    entityName: 'distributor',
    loadFn: hasApi ? loadDistributors : undefined
  })

  const [selectedNum, setSelectedNum] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // New entry form — only name required
  const [newName, setNewName] = useState('')

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editLicenseId, setEditLicenseId] = useState('')
  const [editSerial, setEditSerial] = useState('')
  const [editPremisesName, setEditPremisesName] = useState('')
  const [editPremisesAddr, setEditPremisesAddr] = useState('')
  const [showEditValidation, setShowEditValidation] = useState(false)

  // Sales reps state
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [newRepName, setNewRepName] = useState('')
  const [newRepPhone, setNewRepPhone] = useState('')
  const [newRepEmail, setNewRepEmail] = useState('')
  const [repError, setRepError] = useState<string | null>(null)

  // Import dialog state
  const [showImportDialog, setShowImportDialog] = useState(false)

  const filteredDistributors = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return crud.items
    return crud.items.filter(
      (d) =>
        d.distributor_name.toLowerCase().includes(q) ||
        (d.license_id && d.license_id.toLowerCase().includes(q)) ||
        (d.premises_name && d.premises_name.toLowerCase().includes(q))
    )
  }, [crud.items, searchFilter])

  const selectedDistributor = useMemo(
    () => crud.items.find((d) => d.distributor_number === selectedNum) ?? null,
    [crud.items, selectedNum]
  )

  const hasEditChanges = useMemo(() => {
    if (!selectedDistributor) return false
    return (
      editName !== selectedDistributor.distributor_name ||
      editLicenseId !== (selectedDistributor.license_id ?? '') ||
      editSerial !== (selectedDistributor.serial_number ?? '') ||
      editPremisesName !== (selectedDistributor.premises_name ?? '') ||
      editPremisesAddr !== (selectedDistributor.premises_address ?? '')
    )
  }, [selectedDistributor, editName, editLicenseId, editSerial, editPremisesName, editPremisesAddr])

  // Load sales reps when a distributor is selected
  useEffect(() => {
    if (selectedNum == null || typeof api?.getSalesRepsByDistributor !== 'function') return
    let stale = false
    void api.getSalesRepsByDistributor(selectedNum).then((reps) => {
      if (!stale) setSalesReps(reps)
    })
    return () => {
      stale = true
    }
  }, [selectedNum, api])

  const { clearMessages } = crud
  const clearSelection = useCallback((): void => {
    setSelectedNum(null)
    setEditName('')
    setEditLicenseId('')
    setEditSerial('')
    setEditPremisesName('')
    setEditPremisesAddr('')
    setShowEditValidation(false)
    setSalesReps([])
    setRepError(null)
    clearMessages()
  }, [clearMessages])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedNum !== null) clearSelection()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedNum, clearSelection])

  const selectDistributor = (d: Distributor): void => {
    crud.clearMessages()
    setRepError(null)
    setSelectedNum(d.distributor_number)
    setEditName(d.distributor_name)
    setEditLicenseId(d.license_id ?? '')
    setEditSerial(d.serial_number ?? '')
    setEditPremisesName(d.premises_name ?? '')
    setEditPremisesAddr(d.premises_address ?? '')
    setShowEditValidation(false)
  }

  const newNameError =
    crud.showValidation && !newName.trim() ? 'Distributor name is required' : undefined

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Please restart the application.')
      return
    }

    if (!newName.trim()) return

    const freshItems = await crud.runAction(
      () => api.createDistributor({ distributor_name: newName.trim() }),
      'Distributor created'
    )
    if (freshItems) {
      setNewName('')
      crud.setShowValidation(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    crud.clearMessages()
    setShowEditValidation(true)

    if (!hasApi || !selectedNum) return

    const trimmed = editName.trim()
    if (!trimmed) return

    const distNum = selectedNum
    const freshItems = await crud.runAction(
      () =>
        api.updateDistributor({
          distributor_number: distNum,
          distributor_name: trimmed,
          license_id: editLicenseId.trim() || undefined,
          serial_number: editSerial.trim() || undefined,
          premises_name: editPremisesName.trim() || undefined,
          premises_address: editPremisesAddr.trim() || undefined
        }),
      'Distributor saved'
    )
    if (freshItems) {
      setShowEditValidation(false)
      const saved = freshItems.find((d) => d.distributor_number === distNum)
      if (saved) {
        setEditName(saved.distributor_name)
        setEditLicenseId(saved.license_id ?? '')
        setEditSerial(saved.serial_number ?? '')
        setEditPremisesName(saved.premises_name ?? '')
        setEditPremisesAddr(saved.premises_address ?? '')
      }
    }
  }

  const handleDelete = (): void => {
    if (!hasApi || !selectedNum) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (!hasApi || !selectedNum) return

    const freshItems = await crud.runAction(
      () => api.deleteDistributor(selectedNum),
      'Distributor deleted'
    )
    if (freshItems) {
      clearSelection()
      crud.setSuccess('Distributor deleted')
    }
  }

  const editNameError =
    showEditValidation && !editName.trim() ? 'Distributor name is required' : undefined

  // ── Sales rep handlers ──

  const handleAddRep = async (): Promise<void> => {
    setRepError(null)
    if (!newRepName.trim()) {
      setRepError('Rep name is required')
      return
    }
    if (selectedNum == null || typeof api?.createSalesRep !== 'function') return

    try {
      await api.createSalesRep({
        distributor_number: selectedNum,
        rep_name: newRepName.trim(),
        phone: newRepPhone.trim() || undefined,
        email: newRepEmail.trim() || undefined
      })
      const reps = await api.getSalesRepsByDistributor(selectedNum)
      setSalesReps(reps)
      setNewRepName('')
      setNewRepPhone('')
      setNewRepEmail('')
    } catch (err) {
      setRepError(err instanceof Error ? err.message : 'Failed to add sales rep')
    }
  }

  const handleDeleteRep = async (repId: number): Promise<void> => {
    setRepError(null)
    if (selectedNum == null || typeof api?.deleteSalesRep !== 'function') return

    try {
      await api.deleteSalesRep(repId)
      const reps = await api.getSalesRepsByDistributor(selectedNum)
      setSalesReps(reps)
    } catch (err) {
      setRepError(err instanceof Error ? err.message : 'Failed to delete sales rep')
    }
  }

  return (
    <div className="crud-panel__root" aria-label="Distributors">
      {/* Section 1: New entry form — name only */}
      <div className="crud-panel__new-form--distributor">
        <FormField
          label="Distributor Name"
          required
          error={newNameError}
          showError={crud.showValidation}
        >
          <ValidatedInput
            fieldType="name"
            aria-label="Distributor Name"
            placeholder="e.g. Empire Merchants North LLC"
            value={newName}
            onChange={setNewName}
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
        <AppButton
          size="md"
          variant="default"
          className="crud-panel__add-btn"
          onClick={() => setShowImportDialog(true)}
        >
          Import from Catalog
        </AppButton>
      </div>

      {/* Section 2: Scrollable distributor list */}
      <div className="crud-panel__list-wrap">
        {filteredDistributors.length === 0 ? (
          <p className="crud-panel__empty-text">
            {crud.items.length === 0
              ? 'No distributors yet. Add one above to get started.'
              : 'No distributors match your search.'}
          </p>
        ) : (
          <table className="crud-panel__table" aria-label="Distributors list">
            <thead>
              <tr>
                <th>Name</th>
                <th>License ID</th>
                <th>Premises Name</th>
              </tr>
            </thead>
            <tbody>
              {filteredDistributors.map((d) => (
                <tr
                  key={d.distributor_number}
                  className={cn(
                    'crud-panel__row',
                    selectedNum === d.distributor_number && 'crud-panel__row--selected'
                  )}
                  onClick={() => selectDistributor(d)}
                >
                  <td>{d.distributor_name}</td>
                  <td className="crud-panel__td--muted">{d.license_id ?? '—'}</td>
                  <td className="crud-panel__td--muted">{d.premises_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="crud-panel__edit-section">
        {selectedDistributor ? (
          <div className="crud-panel__edit-grid">
            <div className="crud-panel__edit-header">
              <span className="crud-panel__edit-title">
                Editing: {selectedDistributor.distributor_name}
              </span>
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
              </div>
            </div>
            <div className="crud-panel__edit-fields">
              <FormField
                label="Distributor Name"
                required
                error={editNameError}
                showError={showEditValidation}
              >
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Distributor Name"
                  value={editName}
                  onChange={setEditName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
              <FormField label="License ID">
                <ValidatedInput
                  fieldType="text"
                  aria-label="Edit License ID"
                  placeholder="e.g. 1234567"
                  value={editLicenseId}
                  onChange={setEditLicenseId}
                />
              </FormField>
              <FormField label="Serial Number">
                <ValidatedInput
                  fieldType="text"
                  aria-label="Edit Serial Number"
                  placeholder="e.g. SN-001"
                  value={editSerial}
                  onChange={setEditSerial}
                />
              </FormField>
              <FormField label="Premises Name">
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Premises Name"
                  placeholder="e.g. Main Warehouse"
                  value={editPremisesName}
                  onChange={setEditPremisesName}
                />
              </FormField>
              <FormField label="Premises Address">
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Premises Address"
                  placeholder="e.g. 123 Distillery Rd"
                  value={editPremisesAddr}
                  onChange={setEditPremisesAddr}
                />
              </FormField>
            </div>

            {/* Sales Reps sub-section */}
            <div className="crud-panel__sales-reps">
              <div className="crud-panel__sales-reps-header">Sales Representatives</div>
              <div className="crud-panel__sales-reps-form">
                <ValidatedInput
                  fieldType="name"
                  aria-label="New Rep Name"
                  placeholder="Rep name"
                  value={newRepName}
                  onChange={setNewRepName}
                />
                <ValidatedInput
                  fieldType="phone"
                  aria-label="New Rep Phone"
                  placeholder="Phone"
                  value={newRepPhone}
                  onChange={setNewRepPhone}
                />
                <ValidatedInput
                  fieldType="email"
                  aria-label="New Rep Email"
                  placeholder="Email"
                  value={newRepEmail}
                  onChange={setNewRepEmail}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleAddRep()
                  }}
                />
                <AppButton size="sm" variant="success" onClick={() => void handleAddRep()}>
                  Add
                </AppButton>
              </div>
              {repError && <p className="crud-panel__msg--error">{repError}</p>}
              {salesReps.length === 0 ? (
                <p className="crud-panel__empty-text">No sales reps yet.</p>
              ) : (
                <table className="crud-panel__sales-reps-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {salesReps.map((rep) => (
                      <tr key={rep.sales_rep_id}>
                        <td>{rep.rep_name}</td>
                        <td>{rep.phone ?? '—'}</td>
                        <td>{rep.email ?? '—'}</td>
                        <td>
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDeleteRep(rep.sales_rep_id)}
                          >
                            Remove
                          </AppButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
              Select a distributor above to view and edit its details.
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
        title="Delete Distributor"
        message={`Are you sure you want to delete "${selectedDistributor?.distributor_name}"? This will also remove all associated sales reps. This cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ImportDistributorsDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={() => void crud.loadItems()}
      />
    </div>
  )
}
