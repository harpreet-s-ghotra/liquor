import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { RegisterPanel } from './RegisterPanel'
import type { Register } from '../../../../../shared/types'

const mockRegisters: Register[] = [
  {
    id: 'reg-1',
    device_name: 'Register 1',
    device_fingerprint: 'fp-1',
    is_current: true,
    last_seen_at: '2026-01-15T10:30:00Z',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'reg-2',
    device_name: 'Register 2',
    device_fingerprint: 'fp-2',
    is_current: false,
    last_seen_at: '2026-01-14T14:00:00Z',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'reg-3',
    device_name: 'Register 3',
    device_fingerprint: 'fp-3',
    is_current: false,
    last_seen_at: '2026-01-10T09:15:00Z',
    created_at: '2026-01-01T00:00:00Z'
  }
]

describe('RegisterPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      listRegisters: vi.fn().mockResolvedValue(mockRegisters),
      renameRegister: vi.fn().mockResolvedValue({}),
      deleteRegister: vi.fn().mockResolvedValue({})
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('shows loading state initially', async () => {
    render(<RegisterPanel />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    // State updates from useEffect will resolve in background
  })

  it('loads and renders register list on mount', async () => {
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
      expect(screen.getByText('Register 2')).toBeInTheDocument()
      expect(screen.getByText('Register 3')).toBeInTheDocument()
    })

    expect(window.api!.listRegisters).toHaveBeenCalled()
  })

  it('highlights the current device register', async () => {
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const currentDeviceRow = screen.getByText('Register 1').closest('tr')
    expect(currentDeviceRow).toHaveClass(/current|active/i)
  })

  it('displays last seen date for each register', async () => {
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    // Check that dates are displayed (formatter varies)
    expect(screen.getByText(/1\/15|Jan 15/)).toBeInTheDocument()
    expect(screen.getByText(/1\/14|Jan 14/)).toBeInTheDocument()
  })

  it('allows renaming a register', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const renameButtons = screen.getAllByRole('button', { name: /rename|edit/i })
    await user.click(renameButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('Register 1')).toBeInTheDocument()
    })

    vi.mocked(window.api!.listRegisters).mockResolvedValueOnce([
      { ...mockRegisters[0], device_name: 'Main Counter' },
      mockRegisters[1],
      mockRegisters[2]
    ])

    const input = screen.getByDisplayValue('Register 1') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save|confirm/i })

    await user.clear(input)
    await user.type(input, 'Main Counter')
    await user.click(saveButton)

    await waitFor(() => {
      expect(window.api!.renameRegister).toHaveBeenCalledWith('reg-1', 'Main Counter')
    })
  })

  it('displays success message after renaming', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const renameButtons = screen.getAllByRole('button', { name: /rename|edit/i })
    await user.click(renameButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('Register 1')).toBeInTheDocument()
    })

    vi.mocked(window.api!.listRegisters).mockResolvedValueOnce([
      { ...mockRegisters[0], device_name: 'Front' },
      mockRegisters[1],
      mockRegisters[2]
    ])

    const input = screen.getByDisplayValue('Register 1') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save|confirm/i })

    await user.clear(input)
    await user.type(input, 'Front')
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/renamed/i)).toBeInTheDocument()
    })
  })

  it('allows canceling rename operation', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const renameButtons = screen.getAllByRole('button', { name: /rename|edit/i })
    await user.click(renameButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('Register 1')).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // After cancel, rename input should not be visible
    expect(screen.queryByDisplayValue('Register 1')).not.toBeInTheDocument()
  })

  it('validates that name is not empty before saving rename', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const renameButtons = screen.getAllByRole('button', { name: /rename|edit/i })
    await user.click(renameButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('Register 1')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('Register 1') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save|confirm/i })

    await user.clear(input)
    await user.click(saveButton)

    // Should not call API if name is empty
    await waitFor(() => {
      expect(window.api!.renameRegister).not.toHaveBeenCalled()
    })
  })

  it('opens delete confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 2')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })
  })

  it('confirms delete and calls deleteRegister', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 2')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    vi.mocked(window.api!.listRegisters).mockResolvedValueOnce([mockRegisters[0], mockRegisters[2]])

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(window.api!.deleteRegister).toHaveBeenCalledWith('reg-2')
    })
  })

  it('displays success message after deleting a register', async () => {
    const user = userEvent.setup()
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 2')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    vi.mocked(window.api!.listRegisters).mockResolvedValueOnce([mockRegisters[0], mockRegisters[2]])

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/deleted/i)).toBeInTheDocument()
    })
  })

  it('prevents deleting the current register', async () => {
    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    // Current register row should not have a Delete button
    const currentRow = screen.getByText('Register 1').closest('tr')!
    const deleteBtn = currentRow.querySelector('button[class*="danger"]')
    expect(deleteBtn).toBeNull()
  })

  it('handles error when loading registers fails', async () => {
    vi.mocked(window.api!.listRegisters).mockRejectedValueOnce(
      new Error('Failed to load registers')
    )

    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load registers/i)).toBeInTheDocument()
    })
  })

  it('handles error when renaming fails', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api!.renameRegister).mockRejectedValueOnce(
      new Error('Register name already in use')
    )

    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    const renameButtons = screen.getAllByRole('button', { name: /rename|edit/i })
    await user.click(renameButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('Register 1')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('Register 1') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save|confirm/i })

    await user.clear(input)
    await user.type(input, 'Register 2')
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/already in use/i)).toBeInTheDocument()
    })
  })

  it('handles error when deleting fails', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api!.deleteRegister).mockRejectedValueOnce(
      new Error('Cannot delete register in use')
    )

    render(<RegisterPanel />)

    await waitFor(() => {
      expect(screen.getByText('Register 2')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/cannot delete register/i)).toBeInTheDocument()
    })
  })
})
