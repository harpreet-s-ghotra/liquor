import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HeaderBar } from './HeaderBar'
import { useThemeStore } from '@renderer/store/useThemeStore'

describe('HeaderBar', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'dark' })
  })

  it('renders status text, help, settings, and cashier badge', () => {
    render(<HeaderBar cashierName="Alice" />)
    expect(screen.getByText('Register Active')).toBeInTheDocument()
    expect(screen.getByLabelText('Help')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows cashier name without admin badge for cashier role', () => {
    render(<HeaderBar cashierName="Alice" cashierRole="cashier" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
  })

  it('shows "Cashier" when no cashierName is provided', () => {
    render(<HeaderBar />)
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('shows ADMIN badge when cashierRole is admin', () => {
    render(<HeaderBar cashierName="Bob" cashierRole="admin" />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByTestId('admin-badge')).toBeInTheDocument()
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('hides ADMIN badge when cashierRole is cashier', () => {
    render(<HeaderBar cashierName="Alice" cashierRole="cashier" />)
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
  })

  it('opens settings dropdown on click', () => {
    render(<HeaderBar />)
    expect(screen.queryByTestId('settings-dropdown')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByTestId('settings-dropdown')).toBeInTheDocument()
  })

  it('closes settings dropdown on second click', () => {
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByTestId('settings-dropdown')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.queryByTestId('settings-dropdown')).not.toBeInTheDocument()
  })

  it('shows "Light Mode" label in dark theme', () => {
    useThemeStore.setState({ theme: 'dark' })
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByText('Light Mode')).toBeInTheDocument()
  })

  it('shows "Dark Mode" label in light theme', () => {
    useThemeStore.setState({ theme: 'light' })
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByText('Dark Mode')).toBeInTheDocument()
  })

  it('toggles theme and closes menu on theme button click', () => {
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByTestId('theme-toggle'))

    expect(useThemeStore.getState().theme).toBe('light')
    expect(screen.queryByTestId('settings-dropdown')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', () => {
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByTestId('settings-dropdown')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('settings-dropdown')).not.toBeInTheDocument()
  })

  it('renders active account pill and fires sign-out from the account menu', () => {
    const onSignOutAccount = vi.fn()

    render(
      <HeaderBar
        merchantName="Downtown Liquor"
        registerName="Register 2"
        canSignOutAccount={true}
        onSignOutAccount={onSignOutAccount}
      />
    )

    expect(screen.getByTestId('account-pill')).toHaveTextContent('Downtown Liquor · Register 2')

    fireEvent.click(screen.getByTestId('account-pill'))
    fireEvent.click(screen.getByText('Sign Out of Account'))

    expect(onSignOutAccount).toHaveBeenCalled()
  })

  it('account menu does not render a Switch Account entry', () => {
    // Switch Account was a duplicate of Sign Out — removed for clarity
    render(
      <HeaderBar
        merchantName="Downtown Liquor"
        canSignOutAccount={true}
        onSignOutAccount={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('account-pill'))
    expect(screen.queryByText('Switch Account')).not.toBeInTheDocument()
  })

  it('shows Check for Updates by default', () => {
    render(<HeaderBar />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(screen.getByTestId('check-for-updates-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('restart-to-install-btn')).not.toBeInTheDocument()
  })

  it('swaps Check for Updates with Restart to Install when an update is downloaded', () => {
    const onInstallUpdate = vi.fn()
    render(<HeaderBar updateReadyVersion="0.1.0" onInstallUpdate={onInstallUpdate} />)

    fireEvent.click(screen.getByTestId('settings-button'))
    const restartBtn = screen.getByTestId('restart-to-install-btn')
    expect(restartBtn).toHaveTextContent('Restart to install 0.1.0')
    expect(screen.queryByTestId('check-for-updates-btn')).not.toBeInTheDocument()

    fireEvent.click(restartBtn)
    expect(onInstallUpdate).toHaveBeenCalled()
  })
})
