import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManagerModal } from './ManagerModal'

describe('ManagerModal', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getCashiers: vi
        .fn()
        .mockResolvedValue([
          { id: 1, name: 'Alice', role: 'admin', is_active: 1, created_at: '2026-01-01' }
        ]),
      createCashier: vi.fn().mockResolvedValue({}),
      updateCashier: vi.fn().mockResolvedValue({}),
      deleteCashier: vi.fn().mockResolvedValue({}),
      listRegisters: vi.fn().mockResolvedValue([
        {
          id: 'reg-1',
          device_name: 'Register 1',
          device_fingerprint: 'fp-1',
          is_current: true,
          last_seen_at: '2026-01-15T10:30:00Z',
          created_at: '2026-01-01T00:00:00Z'
        }
      ]),
      renameRegister: vi.fn().mockResolvedValue({}),
      deleteRegister: vi.fn().mockResolvedValue({}),
      getFinixMerchantStatus: vi.fn().mockResolvedValue({
        merchant_name: 'High Spirits Liquor',
        merchant_id: 'MU12345678',
        processing_enabled: true
      }),
      getLocalHistoryStats: vi.fn().mockResolvedValue({
        count: 24,
        earliest: '2026-01-01T00:00:00Z',
        latest: '2026-01-15T00:00:00Z'
      }),
      getBackfillStatus: vi.fn().mockResolvedValue({
        state: 'done',
        days: 365,
        applied: 24,
        skipped: 0,
        errors: 0,
        startedAt: '2026-01-15T00:00:00Z',
        finishedAt: '2026-01-15T00:01:00Z',
        lastError: null
      }),
      triggerBackfill: vi.fn().mockResolvedValue({ started: true, days: 365 }),
      onBackfillStatusChanged: vi.fn().mockReturnValue(vi.fn())
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('does not render anything when isOpen is false', () => {
    const { container } = render(<ManagerModal isOpen={false} onClose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders modal dialog with the remaining manager tabs', async () => {
    render(<ManagerModal isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cashiers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Registers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Merchant Info' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Data History' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Reorder Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Purchase Orders' })).not.toBeInTheDocument()
  })

  it('switches across the remaining manager tabs', async () => {
    const user = userEvent.setup()
    render(<ManagerModal isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Registers' }))
    await waitFor(() => {
      expect(screen.getByText('Register 1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Merchant Info' }))
    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Data History' }))
    await waitFor(() => {
      expect(screen.getByText('24')).toBeInTheDocument()
    })
  })

  it('updates the header breadcrumb when tabs change', async () => {
    const user = userEvent.setup()
    render(<ManagerModal isOpen onClose={vi.fn()} />)

    expect(
      screen.getByText('Cashiers', { selector: '.app-modal-header__title' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Data History' }))

    await waitFor(() => {
      expect(
        screen.getByText('Data History', { selector: '.app-modal-header__title' })
      ).toBeInTheDocument()
    })
  })

  it('falls back to cashiers when a stale manager tab was persisted', async () => {
    window.localStorage.setItem('manager-modal-last-tab', 'reorder')
    render(<ManagerModal isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: 'Cashiers' })).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ManagerModal isOpen onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /^Close/ }))
    expect(onClose).toHaveBeenCalled()
  })
})
