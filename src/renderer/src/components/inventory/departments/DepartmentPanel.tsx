import { useState, useMemo, useCallback, useEffect } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { Input } from '@renderer/components/ui/input'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { Department, TaxCode } from '@renderer/types/pos'
import '../crud-panel.css'

export function DepartmentPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getDepartments === 'function'

  const loadDepartments = useCallback(async (): Promise<Department[]> => {
    const a = window.api
    if (typeof a?.getDepartments !== 'function') return []
    return a.getDepartments()
  }, [])

  const crud = useCrudPanel<Department>({
    entityName: 'department',
    loadFn: hasApi ? loadDepartments : undefined
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
        /* ignore – dropdown will just be empty */
      })
    return (): void => {
      stale = true
    }
  }, [])

  const [searchFilter, setSearchFilter] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null)

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editProfitMargin, setEditProfitMargin] = useState('')
  const [editTaxRate, setEditTaxRate] = useState('')
  const [showEditValidation, setShowEditValidation] = useState(false)

  // New department form
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newProfitMargin, setNewProfitMargin] = useState('')
  const [newTaxRate, setNewTaxRate] = useState('')

  const filteredDepartments = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return crud.items
    return crud.items.filter(
      (dept) =>
        dept.name.toLowerCase().includes(q) ||
        (dept.description && dept.description.toLowerCase().includes(q))
    )
  }, [crud.items, searchFilter])

  const selectedDept = useMemo(
    () => crud.items.find((d) => d.id === selectedDeptId) ?? null,
    [crud.items, selectedDeptId]
  )

  const hasEditChanges = useMemo(() => {
    if (!selectedDept) return false
    const origMargin = selectedDept.default_profit_margin
      ? String(selectedDept.default_profit_margin)
      : ''
    const origRate = selectedDept.default_tax_rate ? String(selectedDept.default_tax_rate) : ''
    return (
      editName !== selectedDept.name ||
      editDescription !== (selectedDept.description ?? '') ||
      editProfitMargin !== origMargin ||
      editTaxRate !== origRate
    )
  }, [selectedDept, editName, editDescription, editProfitMargin, editTaxRate])

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

  const selectDepartment = (dept: Department): void => {
    crud.clearMessages()
    setSelectedDeptId(dept.id)
    setEditName(dept.name)
    setEditDescription(dept.description ?? '')
    setEditProfitMargin(dept.default_profit_margin ? String(dept.default_profit_margin) : '')
    setEditTaxRate(dept.default_tax_rate ? String(dept.default_tax_rate) : '')
    setShowEditValidation(false)
  }

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Run the app via Electron (npm run dev).')
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
        api.createDepartment({
          name: trimmed,
          description: newDescription.trim() || null,
          default_profit_margin: profitMargin,
          default_tax_rate: taxRate
        }),
      'Department created'
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

    if (!hasApi || !selectedDeptId) return

    const trimmedName = editName.trim()
    if (!trimmedName) {
      crud.setError('Department name is required')
      return
    }

    const profitMargin = editProfitMargin ? parseFloat(editProfitMargin) : 0
    const taxRate = editTaxRate ? parseFloat(editTaxRate) : 0

    if (editProfitMargin && (isNaN(profitMargin) || profitMargin < 0 || profitMargin > 100)) {
      crud.setError('Profit margin must be between 0 and 100')
      return
    }

    const deptId = selectedDeptId
    const freshItems = await crud.runAction(
      () =>
        api.updateDepartment({
          id: deptId,
          name: trimmedName,
          description: editDescription.trim() || null,
          default_profit_margin: profitMargin,
          default_tax_rate: taxRate
        }),
      'Department saved'
    )
    if (freshItems) {
      setShowEditValidation(false)
      // Refresh edit form from the just-reloaded data so the UI is fully in sync
      const saved = freshItems.find((d) => d.id === deptId)
      if (saved) {
        setEditName(saved.name)
        setEditDescription(saved.description ?? '')
        setEditProfitMargin(saved.default_profit_margin ? String(saved.default_profit_margin) : '')
        setEditTaxRate(saved.default_tax_rate ? String(saved.default_tax_rate) : '')
      }
    }
  }

  const handleDelete = async (): Promise<void> => {
    crud.clearMessages()

    if (!hasApi || !selectedDeptId) return

    const freshItems = await crud.runAction(
      () => api.deleteDepartment(selectedDeptId),
      'Department deleted'
    )
    if (freshItems) {
      setSelectedDeptId(null)
      setEditName('')
      setEditDescription('')
      setEditProfitMargin('')
      setEditTaxRate('')
    }
  }

  const nameError = !newName.trim() ? 'Name is required' : undefined
  const editNameError = showEditValidation && !editName.trim() ? 'Name is required' : undefined

  return (
    <div
      className="grid grid-rows-[auto_1fr_auto_auto] gap-2 h-full min-h-0 p-3"
      aria-label="Departments"
    >
      {/* Section 1: New entry form */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
        <FormField
          label="Department Name"
          required
          error={nameError}
          showError={crud.showValidation}
        >
          <ValidatedInput
            fieldType="name"
            aria-label="Department Name"
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
            aria-label="Department Description"
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
            className="flex w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[1.125rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50"
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
          size="lg"
          variant="success"
          className="self-center min-w-[6rem]"
          onClick={() => void handleCreate()}
        >
          Add
        </AppButton>
      </div>

      {/* Section 2: Scrollable department list */}
      <div className="min-h-0 overflow-auto rounded-[var(--radius)] border border-[var(--border-default)]">
        {filteredDepartments.length === 0 ? (
          <p className="p-4 text-center text-[var(--text-muted)] italic text-sm">
            {crud.items.length === 0
              ? 'No departments yet. Add one above to get started.'
              : 'No departments match your search.'}
          </p>
        ) : (
          <table className="crud-panel__table" aria-label="Departments list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Margin %</th>
                <th>Tax Code</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((dept) => (
                <tr
                  key={dept.id}
                  className={`cursor-pointer hover:bg-[var(--bg-hover)] ${selectedDeptId === dept.id ? 'bg-[var(--bg-selected)]' : ''}`}
                  onClick={() => selectDepartment(dept)}
                >
                  <td className="font-semibold">{dept.name}</td>
                  <td className="text-[var(--text-muted)] text-[0.85rem]">
                    {dept.description || '—'}
                  </td>
                  <td>{dept.default_profit_margin ? `${dept.default_profit_margin}%` : '—'}</td>
                  <td>{taxRateLabel(dept.default_tax_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] p-3">
        {selectedDept ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--text-on-dark)]">
                Editing: {selectedDept.name}
              </span>
              <div className="flex gap-2">
                <AppButton
                  size="sm"
                  variant="success"
                  disabled={!hasEditChanges}
                  onClick={() => void handleSave()}
                >
                  Save
                </AppButton>
                <AppButton size="sm" variant="danger" onClick={() => void handleDelete()}>
                  Delete
                </AppButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <FormField label="Name" required error={editNameError} showError={showEditValidation}>
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Department Name"
                  value={editName}
                  onChange={setEditName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
              <FormField label="Description" error={undefined} showError={false}>
                <Input
                  aria-label="Edit Department Description"
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
                  className="flex w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-2 text-[1.125rem] text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/50"
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
            <div className="min-h-[1.25rem]">
              {crud.success && (
                <p className="m-0 text-sm font-semibold text-[var(--semantic-success-text)]">
                  {crud.success}
                </p>
              )}
              {crud.error && (
                <p className="m-0 text-sm font-semibold text-[var(--semantic-danger-text)]">
                  {crud.error}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-[var(--text-muted)] text-sm italic m-0">
              Select a department above to view and edit its details.
            </p>
            {/* Status messages when no dept selected */}
            <div className="min-h-[1.25rem] mt-1">
              {crud.success && (
                <p className="m-0 text-sm font-semibold text-[var(--semantic-success-text)]">
                  {crud.success}
                </p>
              )}
              {crud.error && (
                <p className="m-0 text-sm font-semibold text-[var(--semantic-danger-text)]">
                  {crud.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Bottom search bar */}
      <div className="grid grid-cols-[auto_1fr] gap-2 items-center border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--text-on-dark)] whitespace-nowrap">
          Search
        </span>
        <Input
          aria-label="Search Departments"
          placeholder="Filter by name or description..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>
    </div>
  )
}
