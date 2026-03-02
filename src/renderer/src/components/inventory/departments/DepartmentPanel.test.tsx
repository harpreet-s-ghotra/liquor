import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DepartmentPanel } from './DepartmentPanel'

describe('DepartmentPanel', () => {
  beforeEach(() => {
    const api = {
      getDepartments: vi.fn(async () => [
        { id: 1, name: 'Wine' },
        { id: 2, name: 'Beer' }
      ]),
      createDepartment: vi.fn(async (input: { name: string }) => ({
        id: 3,
        name: input.name
      })),
      updateDepartment: vi.fn(async (input: { id: number; name: string }) => ({
        id: input.id,
        name: input.name
      })),
      deleteDepartment: vi.fn(async () => undefined)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  it('loads and displays departments', async () => {
    render(<DepartmentPanel />)

    expect(await screen.findByText('Wine')).toBeInTheDocument()
    expect(screen.getByText('Beer')).toBeInTheDocument()
  })

  it('shows empty state when no departments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getDepartments = vi.fn(async () => [])

    render(<DepartmentPanel />)

    expect(
      await screen.findByText('No departments yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('shows validation when creating with empty name', async () => {
    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Department' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
  })

  it('creates a department and shows success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Department' }))

    await waitFor(() => {
      expect(api.createDepartment).toHaveBeenCalledWith({ name: 'Spirits' })
    })
    expect(await screen.findByText('Department created')).toBeInTheDocument()
  })

  it('starts editing and saves a department', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const editInput = screen.getByLabelText('Edit Department Name')
    fireEvent.change(editInput, { target: { value: 'Red Wine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateDepartment).toHaveBeenCalledWith({ id: 1, name: 'Red Wine' })
    })
    expect(await screen.findByText('Department updated')).toBeInTheDocument()
  })

  it('deletes a department', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(api.deleteDepartment).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Department deleted')).toBeInTheDocument()
  })

  it('cancels editing', async () => {
    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    expect(screen.getByLabelText('Edit Department Name')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Edit Department Name')).not.toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createDepartment = vi.fn(async () => {
      throw new Error('Duplicate name')
    })

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Duplicate' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Department' }))

    expect(await screen.findByText('Duplicate name')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateDepartment = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: 'Changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteDepartment = vi.fn(async () => {
      throw new Error('In use')
    })

    render(<DepartmentPanel />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])

    expect(await screen.findByText('In use')).toBeInTheDocument()
  })

  it('validates empty edit name', async () => {
    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByLabelText('Edit Department Name'), {
      target: { value: '   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Department name is required')).toBeInTheDocument()
  })

  it('creates department via Enter key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Department Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Department Name'), {
      target: { value: 'Spirits' }
    })
    fireEvent.keyDown(screen.getByLabelText('Department Name'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createDepartment).toHaveBeenCalledWith({ name: 'Spirits' })
    })
  })

  it('saves edit via Enter key and cancels via Escape key', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const input = screen.getByLabelText('Edit Department Name')
    fireEvent.change(input, { target: { value: 'Updated' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateDepartment).toHaveBeenCalledWith({ id: 1, name: 'Updated' })
    })
  })

  it('cancels edit via Escape key', async () => {
    render(<DepartmentPanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const input = screen.getByLabelText('Edit Department Name')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByLabelText('Edit Department Name')).not.toBeInTheDocument()
  })
})
