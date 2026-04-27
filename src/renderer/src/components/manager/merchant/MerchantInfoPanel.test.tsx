import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { MerchantInfoPanel } from './MerchantInfoPanel'
import { useAuthStore } from '@renderer/store/useAuthStore'
import type { MerchantStatus } from '../../../../../shared/types'

const mockStatus: MerchantStatus = {
  merchant_name: 'High Spirits Liquor',
  merchant_id: 'MU12345678',
  processing_enabled: true
}

const mockMerchantConfig = {
  id: 1,
  finix_api_username: 'UStest',
  finix_api_password: 'test-password',
  merchant_id: 'MU12345678',
  merchant_name: 'High Spirits Liquor',
  activated_at: '2025-06-15',
  updated_at: '2026-01-01'
}

describe('MerchantInfoPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getFinixMerchantStatus: vi.fn().mockResolvedValue(mockStatus),
      getCardSurcharge: vi.fn().mockResolvedValue({ enabled: false, percent: 0 }),
      setCardSurcharge: vi.fn(async (input: { enabled: boolean; percent: number }) => input)
    }

    useAuthStore.setState({
      merchantConfig: mockMerchantConfig
    })
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
    useAuthStore.setState({ merchantConfig: null })
  })

  it('shows loading state initially', () => {
    render(<MerchantInfoPanel />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('loads and displays merchant info cards on mount', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })

    expect(window.api!.getFinixMerchantStatus).toHaveBeenCalled()
  })

  it('displays merchant name card', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Store Name')).toBeInTheDocument()
    })

    expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
  })

  it('displays merchant ID card with monospace font', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Finix Merchant ID')).toBeInTheDocument()
    })

    const merchantIdValue = screen.getByText('MU12345678')
    expect(merchantIdValue).toHaveClass(/mono/)
  })

  it('displays processing status as Enabled when processing_enabled is true', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Processing Status')).toBeInTheDocument()
    })

    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('displays processing status as Disabled when processing_enabled is false', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce({
      ...mockStatus,
      processing_enabled: false
    })

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Processing Status')).toBeInTheDocument()
    })

    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('displays merchant status badge styling', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Processing Status')).toBeInTheDocument()
    })

    const enabledBadge = screen.getByText('Enabled')
    expect(enabledBadge).toHaveClass(/enabled/)
  })

  it('refresh button reloads merchant status', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce(mockStatus)

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })

    expect(window.api!.getFinixMerchantStatus).toHaveBeenCalledTimes(1)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(window.api!.getFinixMerchantStatus).toHaveBeenCalledTimes(2)
    })
  })

  it('shows loading state on initial mount', async () => {
    render(<MerchantInfoPanel />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })
  })

  it('displays data immediately when previously loaded and refreshing', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce(mockStatus)

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })

    // Mock takes time for next call
    vi.mocked(window.api!.getFinixMerchantStatus).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockStatus), 100)
        })
    )

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)

    // Data should still be displayed (not replaced with loading since status exists)
    expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
  })

  it('uses merchant name from status when available', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce({
      ...mockStatus,
      merchant_name: 'Premium Spirits Store',
      merchant_id: 'MU12345678',
      processing_enabled: true
    })

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Store')).toBeInTheDocument()
    })
  })

  it('displays merchant ID from status with fallback to config', async () => {
    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('MU12345678')).toBeInTheDocument()
    })
  })

  it('displays fallback value -- when status is not available and config is missing', async () => {
    useAuthStore.setState({ merchantConfig: null })
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce({
      merchant_name: '',
      merchant_id: '',
      processing_enabled: false
    })

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText('Finix Merchant ID')).toBeInTheDocument()
    })

    const elements = screen.queryAllByText('--')
    expect(elements.length).toBeGreaterThan(0)
  })

  it('handles API error when fetching merchant status', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockRejectedValueOnce(
      new Error('Failed to fetch merchant status')
    )

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch merchant status/i)).toBeInTheDocument()
    })
  })

  it('displays error state with red background card', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockRejectedValueOnce(
      new Error('Connection error')
    )

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      const errorMessage = screen.getByText(/connection error/i)
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveClass(/error/)
    })
  })

  it('dismisses error and allows retry', async () => {
    vi.mocked(window.api!.getFinixMerchantStatus).mockRejectedValueOnce(new Error('Network error'))

    render(<MerchantInfoPanel />)

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    // Reset mock to succeed on next call
    vi.mocked(window.api!.getFinixMerchantStatus).mockResolvedValueOnce(mockStatus)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(screen.getByText('High Spirits Liquor')).toBeInTheDocument()
    })

    expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
  })

  describe('Card Surcharge', () => {
    it('renders the card surcharge section with the saved values', async () => {
      vi.mocked(window.api!.getCardSurcharge).mockResolvedValueOnce({
        enabled: true,
        percent: 3.5
      })

      render(<MerchantInfoPanel />)

      await waitFor(() => {
        expect(screen.getByTestId('card-surcharge-section')).toBeInTheDocument()
      })

      const percentInput = screen.getByLabelText('Card surcharge percent') as HTMLInputElement
      await waitFor(() => {
        expect(percentInput.value).toBe('3.5')
      })
      expect(screen.getByLabelText('Apply surcharge on credit and debit')).toBeChecked()
    })

    it('saves a new surcharge percent and shows success', async () => {
      render(<MerchantInfoPanel />)

      await waitFor(() => {
        expect(screen.getByTestId('card-surcharge-section')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText('Apply surcharge on credit and debit'))
      const percentInput = screen.getByLabelText('Card surcharge percent')
      fireEvent.change(percentInput, { target: { value: '2.5' } })

      const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
      fireEvent.click(saveButtons[saveButtons.length - 1])

      await waitFor(() => {
        expect(window.api!.setCardSurcharge).toHaveBeenCalledWith({
          enabled: true,
          percent: 2.5
        })
      })
      await waitFor(() => {
        expect(screen.getByText('Card surcharge saved')).toBeInTheDocument()
      })
    })

    it('blocks saves above 10%', async () => {
      render(<MerchantInfoPanel />)

      await waitFor(() => {
        expect(screen.getByTestId('card-surcharge-section')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText('Apply surcharge on credit and debit'))
      fireEvent.change(screen.getByLabelText('Card surcharge percent'), {
        target: { value: '12' }
      })

      const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
      fireEvent.click(saveButtons[saveButtons.length - 1])

      expect(await screen.findByText(/10% or less/i)).toBeInTheDocument()
      expect(window.api!.setCardSurcharge).not.toHaveBeenCalled()
    })
  })
})
