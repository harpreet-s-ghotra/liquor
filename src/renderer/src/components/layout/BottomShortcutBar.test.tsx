import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomShortcutBar } from './BottomShortcutBar'

describe('BottomShortcutBar', () => {
  const baseProps = {
    onInventoryClick: vi.fn(),
    onClockOutClick: vi.fn(),
    onSalesHistoryClick: vi.fn(),
    onReportsClick: vi.fn(),
    onManagerClick: vi.fn(),
    onSignOutClick: vi.fn()
  }

  it('shows the account sign-out button only for admins', () => {
    const { rerender } = render(<BottomShortcutBar {...baseProps} isAdmin={false} />)

    expect(screen.queryByTestId('sign-out-account-button')).not.toBeInTheDocument()

    rerender(<BottomShortcutBar {...baseProps} isAdmin={true} />)
    expect(screen.getByTestId('sign-out-account-button')).toBeInTheDocument()
  })

  it('fires the explicit account sign-out action', () => {
    render(<BottomShortcutBar {...baseProps} isAdmin={true} />)

    fireEvent.click(screen.getByTestId('sign-out-account-button'))
    expect(baseProps.onSignOutClick).toHaveBeenCalled()
  })
})
