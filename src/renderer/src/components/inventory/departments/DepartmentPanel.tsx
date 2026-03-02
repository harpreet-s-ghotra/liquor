import { useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { FormField } from '@renderer/components/common/FormField'
import { ValidatedInput } from '@renderer/components/common/ValidatedInput'
import { useCrudPanel } from '@renderer/hooks/useCrudPanel'
import type { Department } from '@renderer/types/pos'
import '../crud-panel.css'

export function DepartmentPanel(): React.JSX.Element {
  const api = typeof window !== 'undefined' ? window.api : undefined
  const hasApi = typeof api?.getDepartments === 'function'

  const crud = useCrudPanel<Department>({
    entityName: 'department',
    loadFn: hasApi ? () => api.getDepartments() : undefined
  })

  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState('')

  const handleCreate = async (): Promise<void> => {
    crud.clearMessages()
    crud.setShowValidation(true)

    if (!hasApi) {
      crud.setError('Backend API unavailable. Run the app via Electron (npm run dev).')
      return
    }

    const trimmed = newName.trim()
    if (!trimmed) return

    const ok = await crud.runAction(
      () => api.createDepartment({ name: trimmed }),
      'Department created'
    )
    if (ok) {
      setNewName('')
      crud.setShowValidation(false)
    }
  }

  const handleUpdate = async (id: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    const trimmed = editingName.trim()
    if (!trimmed) {
      crud.setError('Department name is required')
      return
    }

    const ok = await crud.runAction(
      () => api.updateDepartment({ id, name: trimmed }),
      'Department updated'
    )
    if (ok) {
      crud.setEditingId(null)
      setEditingName('')
    }
  }

  const handleDelete = async (id: number): Promise<void> => {
    crud.clearMessages()

    if (!hasApi) {
      crud.setError('Backend API unavailable.')
      return
    }

    await crud.runAction(() => api.deleteDepartment(id), 'Department deleted')
  }

  const startEdit = (dept: Department): void => {
    crud.clearMessages()
    crud.setEditingId(dept.id)
    setEditingName(dept.name)
  }

  const cancelEdit = (): void => {
    crud.setEditingId(null)
    setEditingName('')
  }

  const nameError = !newName.trim() ? 'Name is required' : undefined

  return (
    <div className="crud-panel" aria-label="Departments">
      <div className="crud-panel__form">
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
        <AppButton size="md" variant="success" onClick={() => void handleCreate()}>
          Add Department
        </AppButton>
      </div>

      <div className="crud-panel__list">
        {crud.items.length === 0 ? (
          <p className="crud-panel__empty">No departments yet. Add one above to get started.</p>
        ) : (
          <table className="crud-panel__table" aria-label="Departments list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {crud.items.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    {crud.editingId === dept.id ? (
                      <ValidatedInput
                        fieldType="name"
                        className="crud-panel__edit-input"
                        aria-label="Edit Department Name"
                        value={editingName}
                        onChange={setEditingName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleUpdate(dept.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                      />
                    ) : (
                      dept.name
                    )}
                  </td>
                  <td>
                    <div className="crud-panel__actions">
                      {crud.editingId === dept.id ? (
                        <>
                          <AppButton
                            size="sm"
                            variant="success"
                            onClick={() => void handleUpdate(dept.id)}
                          >
                            Save
                          </AppButton>
                          <AppButton size="sm" variant="neutral" onClick={cancelEdit}>
                            Cancel
                          </AppButton>
                        </>
                      ) : (
                        <>
                          <AppButton size="sm" onClick={() => startEdit(dept)}>
                            Edit
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDelete(dept.id)}
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
