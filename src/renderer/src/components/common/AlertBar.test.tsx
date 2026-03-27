import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertBar } from './AlertBar'
import { useAlertStore } from '@renderer/store/useAlertStore'

vi.mock('@renderer/store/useAlertStore', () => ({
  useAlertStore: vi.fn()
}))

const mockUseAlertStore = vi.mocked(useAlertStore)

describe('AlertBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no alerts exist', () => {
    const dismissAlert = vi.fn()
    mockUseAlertStore.mockImplementation((selector) =>
      selector({
        alerts: [],
        dismissAlert
      } as never)
    )

    const { queryByTestId } = render(<AlertBar />)

    expect(queryByTestId('alert-bar')).toBeNull()
  })

  it('renders alerts and dismisses on click', () => {
    const dismissAlert = vi.fn()
    mockUseAlertStore.mockImplementation((selector) =>
      selector({
        alerts: [
          {
            id: 'a1',
            message: 'Printer offline',
            type: 'error',
            timestamp: Date.now()
          }
        ],
        dismissAlert
      } as never)
    )

    render(<AlertBar />)

    expect(screen.getByTestId('alert-bar')).toBeInTheDocument()
    expect(screen.getByTestId('alert-error')).toBeInTheDocument()
    expect(screen.getByText('Printer offline')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss alert' }))
    expect(dismissAlert).toHaveBeenCalledWith('a1')
  })
})
