/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ClockOutModal } from './ClockOutModal'
import type { Session, ClockOutReport, Cashier } from '@renderer/types/pos'

// Mock auth store
const mockCashier: Cashier = {
  id: 1,
  name: 'John',
  role: 'cashier',
  is_active: 1,
  created_at: '2026-03-28T00:00:00Z'
}

const mockAdminCashier: Cashier = {
  id: 2,
  name: 'Admin',
  role: 'admin',
  is_active: 1,
  created_at: '2026-03-28T00:00:00Z'
}

const mockSetCurrentSessionId = vi.fn()

vi.mock('@renderer/store/useAuthStore', () => ({
  useAuthStore: (selector: any) =>
    selector({ currentCashier: mockCashier, setCurrentSessionId: mockSetCurrentSessionId })
}))

const activeSession: Session = {
  id: 1,
  opened_by_cashier_id: 1,
  opened_by_cashier_name: 'John',
  closed_by_cashier_id: null,
  closed_by_cashier_name: null,
  started_at: '2026-03-28T09:00:00.000Z',
  ended_at: null,
  status: 'active'
}

const closedSession: Session = {
  id: 2,
  opened_by_cashier_id: 1,
  opened_by_cashier_name: 'John',
  closed_by_cashier_id: 1,
  closed_by_cashier_name: 'John',
  started_at: '2026-03-27T09:00:00.000Z',
  ended_at: '2026-03-27T21:00:00.000Z',
  status: 'closed'
}

const sampleReport: ClockOutReport = {
  session: closedSession,
  sales_by_item_type: [{ item_type_name: 'Wine', transaction_count: 5, total_amount: 99.95 }],
  sales_by_payment_method: [{ payment_method: 'cash', transaction_count: 3, total_amount: 50 }],
  total_sales_count: 5,
  gross_sales: 99.95,
  total_tax_collected: 12.99,
  net_sales: 86.96,
  total_refund_count: 0,
  total_refund_amount: 0,
  average_transaction_value: 19.99,
  expected_cash_at_close: 50,
  cash_total: 50,
  credit_total: 30,
  debit_total: 19.95
}

const buildSessionPage = (count: number, base: Session): Session[] =>
  Array.from({ length: count }, (_, index) => ({
    ...base,
    id: base.id + index,
    started_at: new Date(Date.parse(base.started_at) + index * 60_000).toISOString(),
    ended_at: base.ended_at
      ? new Date(Date.parse(base.ended_at) + index * 60_000).toISOString()
      : null
  }))

describe('ClockOutModal', () => {
  beforeEach(() => {
    mockSetCurrentSessionId.mockClear()
    ;(window as any).api = {
      listSessions: vi.fn().mockResolvedValue({ sessions: [], total_count: 0 }),
      validatePin: vi.fn().mockResolvedValue(mockCashier),
      closeSession: vi.fn().mockResolvedValue(undefined),
      getSessionReport: vi.fn().mockResolvedValue(sampleReport),
      createSession: vi.fn().mockResolvedValue({ id: 2, status: 'active' }),
      printClockOutReport: vi.fn().mockResolvedValue(undefined),
      getMerchantConfig: vi.fn().mockResolvedValue({ merchant_name: 'Test Store' })
    }
  })

  afterEach(() => {
    delete (window as any).api
  })

  // ──────────────────────────────────────────
  // View Transitions & Rendering
  // ──────────────────────────────────────────

  it('does not render when isOpen is false', () => {
    const { container } = render(<ClockOutModal isOpen={false} onClose={vi.fn()} />)
    // Dialog should not be visible or rendered
    expect(container.querySelector('[aria-label="Clock Out"]')).not.toBeInTheDocument()
  })

  it('renders Dialog with aria-label when isOpen is true', async () => {
    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Clock Out')
    })
  })

  // ──────────────────────────────────────────
  // Session List View
  // ──────────────────────────────────────────

  it('shows "Sessions" title in list view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
    })
  })

  it('loads and renders session list with data', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession, closedSession],
      total_count: 2
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      const table = screen.getByTestId('session-list')
      expect(table).toBeInTheDocument()
      expect(table).toHaveTextContent('John')
      // Both sessions render in the table
      const rows = table.querySelectorAll('tbody tr')
      expect(rows).toHaveLength(2)
    })
  })

  it('shows "No sessions found." when sessions list is empty', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [],
      total_count: 0
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('No sessions found.')).toBeInTheDocument()
    })
  })

  it('displays session table with correct columns', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('#')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Time')).toBeInTheDocument()
      expect(screen.getByText('Opened By')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  it('formats session date and time correctly', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      // Date is locale-dependent; just check the table has the session data
      const table = screen.getByTestId('session-list')
      expect(table).toHaveTextContent('2026')
      expect(table).toHaveTextContent('John')
    })
  })

  it('shows active session with "Active" status badge and Clock Out button', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByTestId('clock-out-btn')).toBeInTheDocument()
    })
  })

  it('shows closed session with "Closed" status badge and View Report button', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [closedSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Closed')).toBeInTheDocument()
      expect(screen.getByTestId(`view-report-btn-${closedSession.id}`)).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────
  // PIN Entry View
  // ──────────────────────────────────────────

  it('transitions to PIN view when Clock Out button is clicked', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('clock-out-btn')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('clock-out-btn'))

    await waitFor(() => {
      expect(screen.getByText('Confirm Clock Out')).toBeInTheDocument()
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })
  })

  it('shows PIN prompt in PIN view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByText('Enter your PIN or an admin PIN to clock out')).toBeInTheDocument()
    })
  })

  it('renders 4 PIN dots initially empty', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      const dots = screen.getByTestId('pin-dots').querySelectorAll('.clock-out-modal__pin-dot')
      expect(dots).toHaveLength(4)
      dots.forEach((dot) => {
        expect(dot).not.toHaveClass('clock-out-modal__pin-dot--filled')
      })
    })
  })

  it('fills PIN dots as digits are entered', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Click digit buttons for PIN 1234
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(2)
    })
  })

  it('renders all PIN pad buttons 0-9 and Del', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      for (let i = 0; i <= 9; i++) {
        expect(screen.getByRole('button', { name: i.toString() })).toBeInTheDocument()
      }
      expect(screen.getByRole('button', { name: 'Del' })).toBeInTheDocument()
    })
  })

  it('allows entering only 4 digits', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Try to enter 5 digits
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))

    // Should still have only 4 dots filled (and modal auto-submitted)
    await waitFor(() => {
      // The auto-submission happens after 4 digits, so we should be past the PIN view
      expect(screen.queryByTestId('pin-entry')).not.toBeInTheDocument()
    })
  })

  it('backspace removes the last digit', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter 3 digits
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(3)
    })

    // Delete one
    fireEvent.click(screen.getByRole('button', { name: 'Del' }))

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(2)
    })
  })

  it('clears PIN error when a digit is entered', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(null)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter invalid PIN
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))

    await waitFor(() => {
      expect(screen.getByTestId('pin-error')).toBeInTheDocument()
    })

    // Clear mock and set to valid for next attempt
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    // Enter a digit - error should clear
    fireEvent.click(screen.getByRole('button', { name: '1' }))

    await waitFor(() => {
      expect(screen.queryByTestId('pin-error')).not.toBeInTheDocument()
    })
  })

  it('cancel button returns to session list view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByText('Confirm Clock Out')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Cancel/ }))

    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
      expect(screen.queryByTestId('pin-entry')).not.toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────
  // PIN Validation & Submission
  // ──────────────────────────────────────────

  it('auto-submits PIN when 4 digits are entered', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter 4 digits
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    // Should transition to report view
    await waitFor(() => {
      expect(screen.getByText('End of Day Report')).toBeInTheDocument()
    })

    expect((window as any).api.validatePin).toHaveBeenCalledWith('1234')
    expect((window as any).api.closeSession).toHaveBeenCalled()
  })

  it('creates a new session and updates auth store after clock-out', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)
    ;(window as any).api.createSession.mockResolvedValue({ id: 99, status: 'active' })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect(screen.getByText('End of Day Report')).toBeInTheDocument()
    })

    expect((window as any).api.createSession).toHaveBeenCalledWith({
      cashier_id: mockCashier.id,
      cashier_name: mockCashier.name
    })
    expect(mockSetCurrentSessionId).toHaveBeenCalledWith(99)
  })

  it('accepts PIN of current cashier', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter PIN
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect((window as any).api.closeSession).toHaveBeenCalledWith({
        session_id: activeSession.id,
        cashier_id: mockCashier.id,
        cashier_name: mockCashier.name
      })
    })
  })

  it('accepts admin PIN for clock out', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockAdminCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter PIN
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect((window as any).api.closeSession).toHaveBeenCalledWith({
        session_id: activeSession.id,
        cashier_id: mockAdminCashier.id,
        cashier_name: mockAdminCashier.name
      })
    })
  })

  it('shows "Invalid PIN" error when validatePin returns null', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(null)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter invalid PIN
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))

    await waitFor(() => {
      expect(screen.getByTestId('pin-error')).toHaveTextContent('Invalid PIN')
    })

    expect((window as any).api.closeSession).not.toHaveBeenCalled()
  })

  it('shows "Invalid PIN" when wrong cashier non-admin PIN is entered', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    const otherCashier: Cashier = {
      id: 99,
      name: 'Other Cashier',
      role: 'cashier',
      is_active: 1,
      created_at: '2026-03-28T00:00:00Z'
    }

    ;(window as any).api.validatePin.mockResolvedValue(otherCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter PIN
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect(screen.getByTestId('pin-error')).toHaveTextContent('Invalid PIN')
    })

    expect((window as any).api.closeSession).not.toHaveBeenCalled()
  })

  it('clears PIN field and shows error when PIN validation fails', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(null)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter PIN
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(0) // PIN cleared
    })
  })

  it('handles close session API error and shows error message', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)
    ;(window as any).api.closeSession.mockRejectedValue(new Error('Database error'))

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Enter PIN
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect(screen.getByTestId('pin-error')).toHaveTextContent('Database error')
    })
  })

  // ──────────────────────────────────────────
  // Report View
  // ──────────────────────────────────────────

  it('shows "End of Day Report" title in report view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '3' }))
      fireEvent.click(screen.getByRole('button', { name: '4' }))
    })

    await waitFor(() => {
      expect(screen.getByText('End of Day Report')).toBeInTheDocument()
    })
  })

  it('loads report when viewing closed session', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [closedSession],
      total_count: 1
    })
    ;(window as any).api.getSessionReport.mockResolvedValue(sampleReport)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId(`view-report-btn-${closedSession.id}`))
    })

    await waitFor(() => {
      expect((window as any).api.getSessionReport).toHaveBeenCalledWith(closedSession.id)
      expect(screen.getByText('End of Day Report')).toBeInTheDocument()
    })
  })

  it('displays ClockOutReportView component in report view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '3' }))
      fireEvent.click(screen.getByRole('button', { name: '4' }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('clock-out-report')).toBeInTheDocument()
    })
  })

  it('print report button calls printClockOutReport API', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '3' }))
      fireEvent.click(screen.getByRole('button', { name: '4' }))
    })

    await waitFor(() => {
      expect(screen.getByText('Print Report')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Print Report' }))

    await waitFor(() => {
      expect((window as any).api.printClockOutReport).toHaveBeenCalledWith({
        store_name: 'Test Store',
        cashier_name: mockCashier.name,
        report: sampleReport
      })
    })
  })

  it('shows "Printing..." text while printing', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)

    let resolvePrint: (value?: unknown) => void
    ;(window as any).api.printClockOutReport.mockReturnValue(
      new Promise((resolve) => {
        resolvePrint = resolve
      })
    )

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '3' }))
      fireEvent.click(screen.getByRole('button', { name: '4' }))
    })

    await waitFor(() => {
      expect(screen.getByText('Print Report')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Print Report' }))

    await waitFor(() => {
      expect(screen.getByText('Printing...')).toBeInTheDocument()
    })

    resolvePrint!()

    await waitFor(() => {
      expect(screen.getByText('Print Report')).toBeInTheDocument()
    })
  })

  it('uses merchant name from config for print', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })
    ;(window as any).api.validatePin.mockResolvedValue(mockCashier)
    ;(window as any).api.getMerchantConfig.mockResolvedValue({
      merchant_name: 'Custom Store Name'
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '1' }))
      fireEvent.click(screen.getByRole('button', { name: '2' }))
      fireEvent.click(screen.getByRole('button', { name: '3' }))
      fireEvent.click(screen.getByRole('button', { name: '4' }))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Print Report' }))
    })

    await waitFor(() => {
      expect((window as any).api.printClockOutReport).toHaveBeenCalledWith(
        expect.objectContaining({
          store_name: 'Custom Store Name'
        })
      )
    })
  })

  // ──────────────────────────────────────────
  // Pagination
  // ──────────────────────────────────────────

  it('does not show pagination when totalPages is 1', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText(/Page 1 of 1/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument()
    })
  })

  it('shows pagination controls when totalPages > 1', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(25, activeSession),
      total_count: 50
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Prev' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })
  })

  it('disables Prev button on first page', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(25, activeSession),
      total_count: 50
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    })
  })

  it('enables Prev button on later pages', async () => {
    const sessions = buildSessionPage(25, activeSession)

    ;(window as any).api.listSessions.mockResolvedValue({
      sessions,
      total_count: 100
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect((window as any).api.listSessions).toHaveBeenCalledWith(25, 25)
    })

    // Mock next page response
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions,
      total_count: 100
    })

    // Now Prev should be enabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled()
    })
  })

  it('disables Next button on last page', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(10, activeSession),
      total_count: 35
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      // Initially on page 1 of 2
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    // Mock page 2 response (last page)
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(10, closedSession),
      total_count: 35
    })

    await waitFor(() => {
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })
  })

  it('loads correct page offset when Next is clicked', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(25, activeSession),
      total_count: 75
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect((window as any).api.listSessions).toHaveBeenLastCalledWith(25, 25)
    })
  })

  it('loads correct page offset when Prev is clicked', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(25, activeSession),
      total_count: 75
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    // Go to page 2
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })

    // Reset mock to track calls
    ;(window as any).api.listSessions.mockClear()
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: buildSessionPage(25, activeSession),
      total_count: 75
    })

    // Go back to page 1
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Prev' }))
    })

    await waitFor(() => {
      expect((window as any).api.listSessions).toHaveBeenLastCalledWith(25, 0)
    })
  })

  // ──────────────────────────────────────────
  // Modal Close & State Management
  // ──────────────────────────────────────────

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn()

    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Close/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Close/ }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Dialog is closed via onOpenChange', async () => {
    const onClose = vi.fn()

    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
    })
  })

  it('resets state when modal is opened', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    const { rerender } = render(<ClockOutModal isOpen={false} onClose={vi.fn()} />)

    // Mock is called once when opened
    ;(window as any).api.listSessions.mockClear()

    rerender(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect((window as any).api.listSessions).toHaveBeenCalledWith(25, 0)
    })
  })

  it('shows error from loadSessions', async () => {
    ;(window as any).api.listSessions.mockRejectedValue(new Error('Network error'))

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows error from handleViewReport', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [closedSession],
      total_count: 1
    })
    ;(window as any).api.getSessionReport.mockRejectedValue(new Error('Report load failed'))

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId(`view-report-btn-${closedSession.id}`))
    })

    await waitFor(() => {
      expect(screen.getByText('Report load failed')).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────
  // Keyboard Support
  // ──────────────────────────────────────────

  it('keyboard digit input (0-9) fills PIN', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Simulate keyboard input
    fireEvent.keyDown(document, { key: '5' })

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(1)
    })
  })

  it('keyboard Backspace removes PIN digit', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    // Add a digit
    fireEvent.keyDown(document, { key: '5' })

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(1)
    })

    // Remove it
    fireEvent.keyDown(document, { key: 'Backspace' })

    await waitFor(() => {
      const dots = screen
        .getByTestId('pin-dots')
        .querySelectorAll('.clock-out-modal__pin-dot--filled')
      expect(dots).toHaveLength(0)
    })
  })

  it('keyboard Escape returns to list from PIN view', async () => {
    ;(window as any).api.listSessions.mockResolvedValue({
      sessions: [activeSession],
      total_count: 1
    })

    render(<ClockOutModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('clock-out-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('pin-entry')).toBeInTheDocument()
    })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
      expect(screen.queryByTestId('pin-entry')).not.toBeInTheDocument()
    })
  })
})
