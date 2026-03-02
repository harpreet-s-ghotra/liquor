import { useMemo, useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { validateField } from '@renderer/components/common/validation'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { Vendor } from '@renderer/types/pos'
import '../crud-panel.css'

export function VendorPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getVendors === 'function'

  const crud = useCrudPanel<Vendor>({
    entityName: 'vendor',
    loadFn: hasApi ? () => api.getVendors() : undefined
  })

  const [newName, setNewName] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [editingName, setEditingName] = useState('')
  const [editingContact, setEditingContact] = useState('')
  const [editingPhone, setEditingPhone] = useState('')
  const [editingEmail, setEditingEmail] = useState('')

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

    const ok = await crud.runAction(
      () =>
        api.createVendor({
          vendor_name: newName.trim(),
          contact_name: newContact.trim() || undefined,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined
        }),
      'Vendor created'
    )
    if (ok) {
      setNewName('')
      setNewContact('')
      setNewPhone('')
      setNewEmail('')
      crud.setShowValidation(false)
    }
  }

  const handleUpdate = async (vendorNumber: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    const trimmed = editingName.trim()
    if (!trimmed) {
      crud.setError('Vendor name is required')
      return
    }

    const phoneErr = validateField('phone', editingPhone)
    if (phoneErr) {
      crud.setError(phoneErr)
      return
    }

    const emailErr = validateField('email', editingEmail)
    if (emailErr) {
      crud.setError(emailErr)
      return
    }

    const ok = await crud.runAction(
      () =>
        api.updateVendor({
          vendor_number: vendorNumber,
          vendor_name: trimmed,
          contact_name: editingContact.trim() || undefined,
          phone: editingPhone.trim() || undefined,
          email: editingEmail.trim() || undefined
        }),
      'Vendor updated'
    )
    if (ok) {
      crud.setEditingId(null)
    }
  }

  const handleDelete = async (vendorNumber: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    await crud.runAction(() => api.deleteVendor(vendorNumber), 'Vendor deleted')
  }

  const startEdit = (v: Vendor): void => {
    crud.clearMessages()
    crud.setEditingId(v.vendor_number)
    setEditingName(v.vendor_name)
    setEditingContact(v.contact_name ?? '')
    setEditingPhone(v.phone ?? '')
    setEditingEmail(v.email ?? '')
  }

  const cancelEdit = (): void => {
    crud.setEditingId(null)
    setEditingName('')
    setEditingContact('')
    setEditingPhone('')
    setEditingEmail('')
  }

  return (
    <div className="crud-panel" aria-label="Vendors">
      <div className="crud-panel__form crud-panel__form--equal-4">
        <FormField
          label="Vendor Name"
          required
          error={fieldErrors.name}
          showError={crud.showValidation}
        >
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
        <AppButton size="md" variant="success" onClick={() => void handleCreate()}>
          Add Vendor
        </AppButton>
      </div>

      <div className="crud-panel__list">
        {crud.items.length === 0 ? (
          <p className="crud-panel__empty">No vendors yet. Add one above to get started.</p>
        ) : (
          <table className="crud-panel__table" aria-label="Vendors list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {crud.items.map((v) => (
                <tr key={v.vendor_number}>
                  <td>
                    {crud.editingId === v.vendor_number ? (
                      <ValidatedInput
                        fieldType="name"
                        className="crud-panel__edit-input"
                        aria-label="Edit Vendor Name"
                        value={editingName}
                        onChange={setEditingName}
                        autoFocus
                      />
                    ) : (
                      v.vendor_name
                    )}
                  </td>
                  <td>
                    {crud.editingId === v.vendor_number ? (
                      <ValidatedInput
                        fieldType="name"
                        className="crud-panel__edit-input"
                        aria-label="Edit Contact Name"
                        value={editingContact}
                        onChange={setEditingContact}
                      />
                    ) : (
                      (v.contact_name ?? '—')
                    )}
                  </td>
                  <td>
                    {crud.editingId === v.vendor_number ? (
                      <ValidatedInput
                        fieldType="phone"
                        className="crud-panel__edit-input"
                        aria-label="Edit Phone"
                        value={editingPhone}
                        onChange={setEditingPhone}
                      />
                    ) : (
                      (v.phone ?? '—')
                    )}
                  </td>
                  <td>
                    {crud.editingId === v.vendor_number ? (
                      <ValidatedInput
                        fieldType="email"
                        className="crud-panel__edit-input"
                        aria-label="Edit Email"
                        value={editingEmail}
                        onChange={setEditingEmail}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleUpdate(v.vendor_number)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    ) : (
                      (v.email ?? '—')
                    )}
                  </td>
                  <td>
                    <div className="crud-panel__actions">
                      {crud.editingId === v.vendor_number ? (
                        <>
                          <AppButton
                            size="sm"
                            variant="success"
                            onClick={() => void handleUpdate(v.vendor_number)}
                          >
                            Save
                          </AppButton>
                          <AppButton size="sm" variant="neutral" onClick={cancelEdit}>
                            Cancel
                          </AppButton>
                        </>
                      ) : (
                        <>
                          <AppButton size="sm" onClick={() => startEdit(v)}>
                            Edit
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDelete(v.vendor_number)}
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
