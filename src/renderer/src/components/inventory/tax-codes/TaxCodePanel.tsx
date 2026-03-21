import { useCallback, useMemo, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { Input } from '@renderer/components/ui/input'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { TaxCode } from '@renderer/types/pos'
import '../crud-panel.css'

export function TaxCodePanel(): React.JSX.Element {
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

  const [searchFilter, setSearchFilter] = useState('')
  const [selectedTcId, setSelectedTcId] = useState<number | null>(null)

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
      crud.setError('Backend API unavailable. Run the app via Electron (npm run dev).')
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

  const handleDelete = async (): Promise<void> => {
    crud.clearMessages()

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
    <div
      className="grid grid-rows-[auto_1fr_auto_auto] gap-2 h-full min-h-0 p-3"
      aria-label="Tax Codes"
    >
      {/* Section 1: New entry form */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
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
          size="lg"
          variant="success"
          className="self-center min-w-[6rem]"
          onClick={() => void handleCreate()}
        >
          Add
        </AppButton>
      </div>

      {/* Section 2: Scrollable tax code list */}
      <div className="min-h-0 overflow-auto rounded-[var(--radius)] border border-[var(--border-default)]">
        {filteredTaxCodes.length === 0 ? (
          <p className="p-4 text-center text-[var(--text-muted)] italic text-sm">
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
                  className={`cursor-pointer hover:bg-[var(--bg-hover)] ${selectedTcId === tc.id ? 'bg-[var(--bg-selected)]' : ''}`}
                  onClick={() => selectTaxCode(tc)}
                >
                  <td className="font-semibold">{tc.code}</td>
                  <td>{`${parseFloat((tc.rate * 100).toFixed(4))}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] p-3">
        {selectedTc ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--text-on-dark)]">
                Editing: {selectedTc.code}
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
              Select a tax code above to view and edit its details.
            </p>
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
          aria-label="Search Tax Codes"
          placeholder="Filter by code or rate..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>
    </div>
  )
}
