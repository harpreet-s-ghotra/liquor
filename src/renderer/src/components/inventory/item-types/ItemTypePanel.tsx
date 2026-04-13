import { useState, useMemo, useCallback, useEffect } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { Input } from '@renderer/components/ui/input'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import { cn } from '@renderer/lib/utils'
import type { ItemType, TaxCode } from '@renderer/types/pos'
import '../crud-panel.css'

type ItemTypePanelProps = {
  searchFilter?: string
}

export function ItemTypePanel({ searchFilter = '' }: ItemTypePanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getItemTypes === 'function'

  const crud = useCrudPanel<ItemType>({
    entityName: 'item type',
    loadFn: hasApi ? () => window.api!.getItemTypes() : undefined
  })

  // Tax codes from backend for the dropdown
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])

  useEffect(() => {
    const a = window.api
    if (typeof a?.getTaxCodes !== 'function') return
    let stale = false
    a.getTaxCodes()
      .then((data: TaxCode[]) => {
        if (!stale) setTaxCodes(data)
      })
      .catch(() => {
        /* ignore - dropdown will just be empty */
      })
    return (): void => {
      stale = true
    }
  }, [])

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editProfitMargin, setEditProfitMargin] = useState('')
  const [editTaxRate, setEditTaxRate] = useState('')
  const [showEditValidation, setShowEditValidation] = useState(false)

  // New item type form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newProfitMargin, setNewProfitMargin] = useState('')
  const [newTaxRate, setNewTaxRate] = useState('')

  const filteredItemTypes = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return crud.items
    return crud.items.filter(
      (itemType) =>
        itemType.name.toLowerCase().includes(q) ||
        (itemType.description && itemType.description.toLowerCase().includes(q))
    )
  }, [crud.items, searchFilter])

  const selectedItemType = useMemo(
    () => crud.items.find((d) => d.id === selectedId) ?? null,
    [crud.items, selectedId]
  )

  const hasEditChanges = useMemo(() => {
    if (!selectedItemType) return false
    const origMargin = selectedItemType.default_profit_margin
      ? String(selectedItemType.default_profit_margin)
      : ''
    const origRate = selectedItemType.default_tax_rate
      ? String(selectedItemType.default_tax_rate)
      : ''
    return (
      editName !== selectedItemType.name ||
      editDescription !== (selectedItemType.description ?? '') ||
      editProfitMargin !== origMargin ||
      editTaxRate !== origRate
    )
  }, [selectedItemType, editName, editDescription, editProfitMargin, editTaxRate])

  /** Resolve a tax rate to its tax code label, or show the raw rate if no match. */
  const taxRateLabel = useCallback(
    (rate: number): string => {
      if (!rate) return '—'
      const tc = taxCodes.find(
        (t) => Math.abs(parseFloat((t.rate * 100).toFixed(4)) - rate) < 0.001
      )
      return tc ? `${tc.code} (${parseFloat((tc.rate * 100).toFixed(4))}%)` : `${rate}%`
    },
    [taxCodes]
  )

  const { clearMessages } = crud
  const clearSelection = useCallback((): void => {
    setSelectedId(null)
    setEditName('')
    setEditDescription('')
    setEditProfitMargin('')
    setEditTaxRate('')
    setShowEditValidation(false)
    clearMessages()
  }, [clearMessages])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedId !== null) clearSelection()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedId, clearSelection])

  const selectItemType = (itemType: ItemType): void => {
    crud.clearMessages()
    setSelectedId(itemType.id)
    setEditName(itemType.name)
    setEditDescription(itemType.description ?? '')
    setEditProfitMargin(
      itemType.default_profit_margin ? String(itemType.default_profit_margin) : ''
    )
    setEditTaxRate(itemType.default_tax_rate ? String(itemType.default_tax_rate) : '')
    setShowEditValidation(false)
  }

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Please restart the application.')
      return
    }

    const trimmed = newName.trim()
    if (!trimmed) return

    const profitMargin = newProfitMargin ? parseFloat(newProfitMargin) : 0
    const taxRate = newTaxRate ? parseFloat(newTaxRate) : 0

    if (newProfitMargin && (isNaN(profitMargin) || profitMargin < 0 || profitMargin > 100)) {
      crud.setError('Profit margin must be between 0 and 100')
      return
    }

    const freshItems = await crud.runAction(
      () =>
        window.api!.createItemType({
          name: trimmed,
          description: newDescription.trim() || null,
          default_profit_margin: profitMargin,
          default_tax_rate: taxRate
        }),
      'Item type created'
    )
    if (freshItems) {
      setNewName('')
      setNewDescription('')
      setNewProfitMargin('')
      setNewTaxRate('')
      crud.setShowValidation(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    crud.clearMessages()
    setShowEditValidation(true)

    if (!hasApi || !selectedId) return

    const trimmedName = editName.trim()
    if (!trimmedName) {
      crud.setError('Item type name is required')
      return
    }

    const profitMargin = editProfitMargin ? parseFloat(editProfitMargin) : 0
    const taxRate = editTaxRate ? parseFloat(editTaxRate) : 0

    if (editProfitMargin && (isNaN(profitMargin) || profitMargin < 0 || profitMargin > 100)) {
      crud.setError('Profit margin must be between 0 and 100')
      return
    }

    const id = selectedId
    const freshItems = await crud.runAction(
      () =>
        window.api!.updateItemType({
          id,
          name: trimmedName,
          description: editDescription.trim() || null,
          default_profit_margin: profitMargin,
          default_tax_rate: taxRate
        }),
      'Item type saved'
    )
    if (freshItems) {
      setShowEditValidation(false)
      const saved = freshItems.find((d) => d.id === id)
      if (saved) {
        setEditName(saved.name)
        setEditDescription(saved.description ?? '')
        setEditProfitMargin(saved.default_profit_margin ? String(saved.default_profit_margin) : '')
        setEditTaxRate(saved.default_tax_rate ? String(saved.default_tax_rate) : '')
      }
    }
  }

  const handleDelete = (): void => {
    if (!hasApi || !selectedId) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (!hasApi || !selectedId) return

    const freshItems = await crud.runAction(
      () => window.api!.deleteItemType(selectedId),
      'Item type deleted'
    )
    if (freshItems) {
      setSelectedId(null)
      setEditName('')
      setEditDescription('')
      setEditProfitMargin('')
      setEditTaxRate('')
    }
  }

  const nameError = !newName.trim() ? 'Name is required' : undefined
  const editNameError = showEditValidation && !editName.trim() ? 'Name is required' : undefined

  return (
    <div className="crud-panel__root" aria-label="Item Types">
      {/* Section 1: New entry form */}
      <div className="crud-panel__new-form--dept">
        <FormField
          label="Item Type Name"
          required
          error={nameError}
          showError={crud.showValidation}
        >
          <ValidatedInput
            fieldType="name"
            aria-label="Item Type Name"
            placeholder="e.g. Wine, Beer, Spirits"
            value={newName}
            onChange={setNewName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
        </FormField>
        <FormField label="Description">
          <Input
            aria-label="Item Type Description"
            placeholder="Optional description"
            maxLength={30}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </FormField>
        <FormField label="Profit Margin (%)">
          <Input
            aria-label="Default Profit Margin"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 25"
            value={newProfitMargin}
            onChange={(e) => setNewProfitMargin(e.target.value)}
          />
        </FormField>
        <FormField label="Tax Code">
          <select
            aria-label="Default Tax Rate"
            className="crud-panel__select"
            value={newTaxRate}
            onChange={(e) => setNewTaxRate(e.target.value)}
          >
            <option value="">None</option>
            {taxCodes.map((tc) => {
              const pct = parseFloat((tc.rate * 100).toFixed(4))
              return (
                <option key={tc.id} value={String(pct)}>
                  {tc.code} ({pct}%)
                </option>
              )
            })}
          </select>
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

      {/* Section 2: Scrollable item type list */}
      <div className="crud-panel__list-wrap">
        {filteredItemTypes.length === 0 ? (
          <p className="crud-panel__empty-text">
            {crud.items.length === 0
              ? 'No item types yet. Add one above to get started.'
              : 'No item types match your search.'}
          </p>
        ) : (
          <table className="crud-panel__table" aria-label="Item types list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Margin %</th>
                <th>Tax Code</th>
              </tr>
            </thead>
            <tbody>
              {filteredItemTypes.map((it) => (
                <tr
                  key={it.id}
                  className={cn(
                    'crud-panel__row',
                    selectedId === it.id && 'crud-panel__row--selected'
                  )}
                  onClick={() => selectItemType(it)}
                >
                  <td>{it.name}</td>
                  <td className="crud-panel__td--muted">{it.description || '—'}</td>
                  <td>{it.default_profit_margin ? `${it.default_profit_margin}%` : '—'}</td>
                  <td>{taxRateLabel(it.default_tax_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="crud-panel__edit-section">
        {selectedItemType ? (
          <div className="crud-panel__edit-grid">
            <div className="crud-panel__edit-header">
              <span className="crud-panel__edit-title">Editing: {selectedItemType.name}</span>
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
              <FormField label="Name" required error={editNameError} showError={showEditValidation}>
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Item Type Name"
                  value={editName}
                  onChange={setEditName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
              <FormField label="Description" error={undefined} showError={false}>
                <Input
                  aria-label="Edit Item Type Description"
                  placeholder="Optional description"
                  maxLength={30}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </FormField>
              <FormField label="Default Profit Margin (%)" error={undefined} showError={false}>
                <Input
                  aria-label="Edit Default Profit Margin"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 25"
                  value={editProfitMargin}
                  onChange={(e) => setEditProfitMargin(e.target.value)}
                />
              </FormField>
              <FormField label="Default Tax Rate" error={undefined} showError={false}>
                <select
                  aria-label="Edit Default Tax Rate"
                  className="crud-panel__select"
                  value={editTaxRate}
                  onChange={(e) => setEditTaxRate(e.target.value)}
                >
                  <option value="">None</option>
                  {taxCodes.map((tc) => {
                    const pct = parseFloat((tc.rate * 100).toFixed(4))
                    return (
                      <option key={tc.id} value={String(pct)}>
                        {tc.code} ({pct}%)
                      </option>
                    )
                  })}
                </select>
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
              Select an item type above to view and edit its details.
            </p>
            {/* Status messages when no item type selected */}
            <div className="crud-panel__status-area--mt">
              {crud.success && <p className="crud-panel__msg--success">{crud.success}</p>}
              {crud.error && <p className="crud-panel__msg--error">{crud.error}</p>}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Item Type"
        message={`Are you sure you want to delete "${selectedItemType?.name}"? This cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
