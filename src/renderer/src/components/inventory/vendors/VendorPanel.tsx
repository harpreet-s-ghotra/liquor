import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog'
import { validateField } from '@renderer/components/common/validation'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { Vendor } from '@renderer/types/pos'
import '../crud-panel.css'

type VendorPanelProps = {
  searchFilter?: string
}

export function VendorPanel({ searchFilter = '' }: VendorPanelProps): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getVendors === 'function'

  const loadVendors = useCallback(async (): Promise<Vendor[]> => {
    const a = window.api
    if (typeof a?.getVendors !== 'function') return []
    return a.getVendors()
  }, [])

  const crud = useCrudPanel<Vendor>({
    entityName: 'vendor',
    loadFn: hasApi ? loadVendors : undefined
  })

  const [selectedVendorNum, setSelectedVendorNum] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // New entry form
  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Edit form fields
  const [editName, setEditName] = useState('')
  const [editContact, setEditContact] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [showEditValidation, setShowEditValidation] = useState(false)

  const filteredVendors = useMemo(() => {
    const q = searchFilter.trim().toLowerCase()
    if (!q) return crud.items
    return crud.items.filter(
      (v) =>
        v.vendor_name.toLowerCase().includes(q) ||
        (v.contact_name && v.contact_name.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q))
    )
  }, [crud.items, searchFilter])

  const selectedVendor = useMemo(
    () => crud.items.find((v) => v.vendor_number === selectedVendorNum) ?? null,
    [crud.items, selectedVendorNum]
  )

  const hasEditChanges = useMemo(() => {
    if (!selectedVendor) return false
    return (
      editName !== selectedVendor.vendor_name ||
      editContact !== (selectedVendor.contact_name ?? '') ||
      editPhone !== (selectedVendor.phone ?? '') ||
      editEmail !== (selectedVendor.email ?? '')
    )
  }, [selectedVendor, editName, editContact, editPhone, editEmail])

  const clearSelection = (): void => {
    setSelectedVendorNum(null)
    setEditName('')
    setEditContact('')
    setEditPhone('')
    setEditEmail('')
    setShowEditValidation(false)
    crud.clearMessages()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && selectedVendorNum !== null) clearSelection()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedVendorNum])

  const selectVendor = (v: Vendor): void => {
    crud.clearMessages()
    setSelectedVendorNum(v.vendor_number)
    setEditName(v.vendor_name)
    setEditContact(v.contact_name ?? '')
    setEditPhone(v.phone ?? '')
    setEditEmail(v.email ?? '')
    setShowEditValidation(false)
  }

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string | undefined> = {}
    errors.name = validateField('name', newName, { required: true })
    if (errors.name === 'Required') errors.name = 'Vendor name is required'
    errors.phone = validateField('phone', newPhone)
    errors.email = validateField('email', newEmail)
    return errors
  }, [newName, newPhone, newEmail])

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean)

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Run the app via Electron (npm run dev).')
      return
    }

    if (hasFieldErrors) return

    const freshItems = await crud.runAction(
      () =>
        api.createVendor({
          vendor_name: newName.trim(),
          contact_name: newContact.trim() || undefined,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined
        }),
      'Vendor created'
    )
    if (freshItems) {
      setNewName('')
      setNewContact('')
      setNewPhone('')
      setNewEmail('')
      crud.setShowValidation(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    crud.clearMessages()
    setShowEditValidation(true)

    if (!hasApi || !selectedVendorNum) return

    const trimmed = editName.trim()
    if (!trimmed) return

    const phoneErr = validateField('phone', editPhone)
    if (phoneErr) {
      crud.setError(phoneErr)
      return
    }

    const emailErr = validateField('email', editEmail)
    if (emailErr) {
      crud.setError(emailErr)
      return
    }

    const vendorNum = selectedVendorNum
    const freshItems = await crud.runAction(
      () =>
        api.updateVendor({
          vendor_number: vendorNum,
          vendor_name: trimmed,
          contact_name: editContact.trim() || undefined,
          phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined
        }),
      'Vendor saved'
    )
    if (freshItems) {
      setShowEditValidation(false)
      const saved = freshItems.find((v) => v.vendor_number === vendorNum)
      if (saved) {
        setEditName(saved.vendor_name)
        setEditContact(saved.contact_name ?? '')
        setEditPhone(saved.phone ?? '')
        setEditEmail(saved.email ?? '')
      }
    }
  }

  const handleDelete = (): void => {
    if (!hasApi || !selectedVendorNum) return
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirmed = async (): Promise<void> => {
    setShowDeleteConfirm(false)
    if (!hasApi || !selectedVendorNum) return

    const freshItems = await crud.runAction(
      () => api.deleteVendor(selectedVendorNum),
      'Vendor deleted'
    )
    if (freshItems) {
      setSelectedVendorNum(null)
      setEditName('')
      setEditContact('')
      setEditPhone('')
      setEditEmail('')
    }
  }

  const nameError = fieldErrors.name

  const editNameError =
    showEditValidation && !editName.trim() ? 'Vendor name is required' : undefined

  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-2 h-full min-h-0 p-3" aria-label="Vendors">
      {/* Section 1: New entry form */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
        <FormField label="Vendor Name" required error={nameError} showError={crud.showValidation}>
          <ValidatedInput
            fieldType="name"
            aria-label="Vendor Name"
            placeholder="e.g. ABC Distributors"
            value={newName}
            onChange={setNewName}
          />
        </FormField>
        <FormField label="Contact Name">
          <ValidatedInput
            fieldType="name"
            aria-label="Contact Name"
            placeholder="Contact person"
            value={newContact}
            onChange={setNewContact}
          />
        </FormField>
        <FormField label="Phone" error={fieldErrors.phone} showError={crud.showValidation}>
          <ValidatedInput
            fieldType="phone"
            aria-label="Phone"
            placeholder="e.g. (555) 123-4567"
            value={newPhone}
            onChange={setNewPhone}
          />
        </FormField>
        <FormField label="Email" error={fieldErrors.email} showError={crud.showValidation}>
          <ValidatedInput
            fieldType="email"
            aria-label="Email"
            placeholder="e.g. contact@vendor.com"
            value={newEmail}
            onChange={setNewEmail}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
            }}
          />
        </FormField>
        <AppButton
          size="md"
          variant="success"
          className="self-end min-w-[6rem]"
          onClick={() => void handleCreate()}
        >
          Add
        </AppButton>
      </div>

      {/* Section 2: Scrollable vendor list */}
      <div className="min-h-0 overflow-auto rounded-[var(--radius)] border border-[var(--border-default)]">
        {filteredVendors.length === 0 ? (
          <p className="p-4 text-center text-[var(--text-muted)] italic text-sm">
            {crud.items.length === 0
              ? 'No vendors yet. Add one above to get started.'
              : 'No vendors match your search.'}
          </p>
        ) : (
          <table className="crud-panel__table" aria-label="Vendors list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((v) => (
                <tr
                  key={v.vendor_number}
                  className={`cursor-pointer hover:bg-[var(--bg-hover)] ${selectedVendorNum === v.vendor_number ? 'bg-[var(--bg-selected)]' : ''}`}
                  onClick={() => selectVendor(v)}
                >
                  <td className="font-semibold">{v.vendor_name}</td>
                  <td className="text-[var(--text-muted)] text-[0.85rem]">
                    {v.contact_name ?? '—'}
                  </td>
                  <td>{v.phone ?? '—'}</td>
                  <td>{v.email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 3: Edit section */}
      <div className="border border-[var(--border-default)] rounded-[var(--radius)] bg-[var(--bg-surface)] p-3">
        {selectedVendor ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[var(--text-primary)]">
                Editing: {selectedVendor.vendor_name}
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
                <AppButton size="sm" variant="danger" onClick={handleDelete}>
                  Delete
                </AppButton>
                <AppButton size="sm" variant="neutral" onClick={clearSelection}>
                  Cancel
                </AppButton>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <FormField
                label="Vendor Name"
                required
                error={editNameError}
                showError={showEditValidation}
              >
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Vendor Name"
                  value={editName}
                  onChange={setEditName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSave()
                  }}
                />
              </FormField>
              <FormField label="Contact Name" error={undefined} showError={false}>
                <ValidatedInput
                  fieldType="name"
                  aria-label="Edit Contact Name"
                  placeholder="Contact person"
                  value={editContact}
                  onChange={setEditContact}
                />
              </FormField>
              <FormField label="Phone" error={undefined} showError={false}>
                <ValidatedInput
                  fieldType="phone"
                  aria-label="Edit Phone"
                  placeholder="e.g. (555) 123-4567"
                  value={editPhone}
                  onChange={setEditPhone}
                />
              </FormField>
              <FormField label="Email" error={undefined} showError={false}>
                <ValidatedInput
                  fieldType="email"
                  aria-label="Edit Email"
                  placeholder="e.g. contact@vendor.com"
                  value={editEmail}
                  onChange={setEditEmail}
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
              Select a vendor above to view and edit its details.
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

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${selectedVendor?.vendor_name}"? This cannot be undone.`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
