import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { CashierPanel } from './CashierPanel'
import type { Cashier } from '../../../../../shared/types'

const mockCashiers: Cashier[] = [
  { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' },
  { id: 2, name: 'Bob', role: 'cashier', is_active: 1, created_at: '2026-01-02' }
]

describe('CashierPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getCashiers: vi.fn().mockResolvedValue(mockCashiers),
      createCashier: vi.fn().mockResolvedValue({}),
      updateCashier: vi.fn().mockResolvedValue({}),
      deleteCashier: vi.fn().mockResolvedValue({})
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('loads and renders cashier list on mount', async () => {
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    expect(window.api!.getCashiers).toHaveBeenCalled()
  })

  it('shows empty state when no cashiers exist', async () => {
    vi.mocked(window.api!.getCashiers).mockResolvedValueOnce([])

    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText(/no cashiers/i)).toBeInTheDocument()
    })
  })

  it('displays cashier name and role in the list', async () => {
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('cashier')).toBeInTheDocument()
  })

  it('allows selecting a cashier row for editing', async () => {
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const aliceRow = screen.getByText('Alice').closest('tr')
    fireEvent.click(aliceRow!)

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Alice')
      expect(nameInput).toBeInTheDocument()
    })
  })

  it('enables adding a new cashier with name and PIN', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const nameInput = screen.getAllByPlaceholderText(/name|cashier name/i)[0]
    const pinInput = screen.getByPlaceholderText(/pin|4 digits/i)
    const addButton = screen.getByRole('button', { name: /add|create/i })

    await user.type(nameInput, 'Charlie')
    await user.type(pinInput, '1234')
    await user.click(addButton)

    await waitFor(() => {
      expect(window.api!.createCashier).toHaveBeenCalledWith({
        name: 'Charlie',
        pin: '1234',
        role: 'cashier'
      })
    })
  })

  it('validates that PIN must be exactly 4 digits before adding', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const nameInput = screen.getAllByPlaceholderText(/name|cashier name/i)[0]
    const pinInput = screen.getByPlaceholderText(/pin|4 digits/i)
    const addButton = screen.getByRole('button', { name: /add|create/i })

    await user.type(nameInput, 'Dave')
    await user.type(pinInput, '123')
    await user.click(addButton)

    await waitFor(() => {
      expect(window.api!.createCashier).not.toHaveBeenCalled()
    })
  })

  it('displays success message after creating a cashier', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    vi.mocked(window.api!.getCashiers).mockResolvedValueOnce([
      ...mockCashiers,
      { id: 3, name: 'Eve', role: 'cashier', is_active: 1, created_at: '2026-01-03' }
    ])

    const nameInput = screen.getAllByPlaceholderText(/name|cashier name/i)[0]
    const pinInput = screen.getByPlaceholderText(/pin|4 digits/i)
    const addButton = screen.getByRole('button', { name: /add|create/i })

    await user.type(nameInput, 'Eve')
    await user.type(pinInput, '5678')
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByText(/cashier created/i)).toBeInTheDocument()
    })
  })

  it('allows editing a cashier name and PIN', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const aliceRow = screen.getByText('Alice').closest('tr')
    fireEvent.click(aliceRow!)

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Alice')
      expect(nameInput).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Alice') as HTMLInputElement
    const pinInput = screen.getByPlaceholderText('New PIN') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save/i })

    // Clear and update name
    await user.clear(nameInput)
    await user.type(nameInput, 'Alicia')

    // Enter new PIN
    await user.type(pinInput, '9999')

    // Click save
    await user.click(saveButton)

    await waitFor(() => {
      expect(window.api!.updateCashier).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Alicia',
          pin: '9999'
        })
      )
    })
  })

  it('displays success message after updating a cashier', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const aliceRow = screen.getByText('Alice').closest('tr')
    fireEvent.click(aliceRow!)

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Alice')
      expect(nameInput).toBeInTheDocument()
    })

    vi.mocked(window.api!.getCashiers).mockResolvedValueOnce([
      { id: 1, name: 'Alicia', role: 'admin', is_active: 1, created_at: '2026-01-01' },
      { id: 2, name: 'Bob', role: 'cashier', is_active: 1, created_at: '2026-01-02' }
    ])

    const nameInput = screen.getByDisplayValue('Alice') as HTMLInputElement
    const saveButton = screen.getByRole('button', { name: /save|update/i })

    await user.clear(nameInput)
    await user.type(nameInput, 'Alicia')
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText(/cashier updated/i)).toBeInTheDocument()
    })
  })

  it('opens delete confirmation dialog', async () => {
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Click the Delete button in Alice's row
    const aliceRow = screen.getByText('Alice').closest('tr')!
    const deleteButton = aliceRow.querySelector('button')!
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText(/delete cashier/i)).toBeInTheDocument()
    })
  })

  it('confirms deletion and calls deleteCashier', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Click the Delete button in Alice's row
    const aliceRow = screen.getByText('Alice').closest('tr')!
    const rowDeleteBtn = aliceRow.querySelector('button')!
    fireEvent.click(rowDeleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/delete cashier/i)).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(window.api!.deleteCashier).toHaveBeenCalledWith(1)
    })
  })

  it('displays success message after deleting a cashier', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    vi.mocked(window.api!.getCashiers).mockResolvedValueOnce([
      { id: 2, name: 'Bob', role: 'cashier', is_active: 1, created_at: '2026-01-02' }
    ])

    // Click the Delete button in Alice's row
    const aliceRow = screen.getByText('Alice').closest('tr')!
    const rowDeleteBtn = aliceRow.querySelector('button')!
    fireEvent.click(rowDeleteBtn)

    await waitFor(() => {
      expect(screen.getByText(/delete cashier/i)).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.getByText(/cashier deleted/i)).toBeInTheDocument()
    })
  })

  it('clears the edit form after successful add', async () => {
    const user = userEvent.setup()
    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    vi.mocked(window.api!.getCashiers).mockResolvedValueOnce([
      ...mockCashiers,
      { id: 3, name: 'Frank', role: 'cashier', is_active: 1, created_at: '2026-01-04' }
    ])

    const nameInput = screen.getAllByPlaceholderText(/name|cashier name/i)[0]
    const pinInput = screen.getByPlaceholderText(/pin|4 digits/i)
    const addButton = screen.getByRole('button', { name: /add|create/i })

    await user.type(nameInput, 'Frank')
    await user.type(pinInput, '4321')
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByText(/cashier created/i)).toBeInTheDocument()
    })

    // Form should be cleared
    expect((nameInput as HTMLInputElement).value).toBe('')
    expect((pinInput as HTMLInputElement).value).toBe('')
  })

  it('handles API error when loading cashiers', async () => {
    vi.mocked(window.api!.getCashiers).mockRejectedValueOnce(new Error('Failed to load cashiers'))

    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText(/unable to load cashiers/i)).toBeInTheDocument()
    })
  })

  it('handles API error when creating a cashier', async () => {
    const user = userEvent.setup()
    vi.mocked(window.api!.createCashier).mockRejectedValueOnce(new Error('Name already exists'))

    render(<CashierPanel />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    const nameInput = screen.getAllByPlaceholderText(/name|cashier name/i)[0]
    const pinInput = screen.getByPlaceholderText(/pin|4 digits/i)
    const addButton = screen.getByRole('button', { name: /add|create/i })

    await user.type(nameInput, 'Alice')
    await user.type(pinInput, '1111')
    await user.click(addButton)

    await waitFor(() => {
      expect(screen.getByText(/name already exists/i)).toBeInTheDocument()
    })
  })
})
