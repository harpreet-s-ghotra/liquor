import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrinterSettingsModal } from './PrinterSettingsModal'
import type { ReceiptConfig } from '../../../../shared/types'

const baseConfig: ReceiptConfig = {
  fontSize: 10,
  paddingY: 4,
  paddingX: 4,
  storeName: 'Liquor POS',
  footerMessage: 'Thanks for shopping',
  alwaysPrint: false
}

describe('PrinterSettingsModal', () => {
  beforeEach(() => {
    vi.useRealTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getReceiptConfig: vi.fn().mockResolvedValue(baseConfig),
      getReceiptPrinterConfig: vi.fn().mockResolvedValue({ printerName: 'Star-TSP654' }),
      listReceiptPrinters: vi.fn().mockResolvedValue(['Star-TSP654', 'Office-Printer']),
      getPrinterStatus: vi.fn().mockResolvedValue({ connected: true, printerName: 'Star-TSP654' }),
      saveReceiptConfig: vi.fn().mockResolvedValue(undefined),
      saveReceiptPrinterConfig: vi.fn().mockResolvedValue(undefined),
      printReceipt: vi.fn().mockResolvedValue(undefined)
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
  })

  it('loads receipt config and printer status on open', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(window.api?.getReceiptConfig).toHaveBeenCalledTimes(1)
      expect(window.api?.getReceiptPrinterConfig).toHaveBeenCalledTimes(1)
      expect(window.api?.listReceiptPrinters).toHaveBeenCalledTimes(1)
      expect(window.api?.getPrinterStatus).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByDisplayValue('Liquor POS')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Thanks for shopping')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Receipt Printer' })).toHaveValue('Star-TSP654')
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getAllByText('Star-TSP654')).toHaveLength(2)
  })

  it('renders disconnected status and disables print when printer is unavailable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getPrinterStatus = vi
      .fn()
      .mockResolvedValue({ connected: false, printerName: null })

    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Not Connected')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Print Sample' })).toBeDisabled()
  })

  it('polls printer status while open', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(window.api?.getPrinterStatus).toHaveBeenCalledTimes(1)
    })

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 4000)
    setIntervalSpy.mockRestore()
  })

  it('updates local config fields before saving', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Liquor POS')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Leave blank to use merchant name'), {
      target: { value: 'My Store' }
    })
    fireEvent.change(screen.getByPlaceholderText('Optional message printed below barcode'), {
      target: { value: 'Bottom note' }
    })

    expect(screen.getByDisplayValue('My Store')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bottom note')).toBeInTheDocument()
  })

  it('saves settings and shows success modal', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Liquor POS')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Leave blank to use merchant name'), {
      target: { value: 'Saved Store' }
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Receipt Printer' }), {
      target: { value: 'Office-Printer' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => {
      expect(window.api?.saveReceiptConfig).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'Saved Store' })
      )
      expect(window.api?.saveReceiptPrinterConfig).toHaveBeenCalledWith({
        printerName: 'Office-Printer'
      })
      expect(screen.getByText('Printer Settings Saved')).toBeInTheDocument()
    })
  })

  it('shows error modal when saving fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.saveReceiptConfig = vi.fn().mockRejectedValue(new Error('save failed'))

    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Liquor POS')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => {
      expect(screen.getByText('Save Failed')).toBeInTheDocument()
      expect(
        screen.getByText('Failed to save printer settings. Please try again.')
      ).toBeInTheDocument()
    })
  })

  it('resets editable fields to defaults', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Liquor POS')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Leave blank to use merchant name'), {
      target: { value: 'Temporary Name' }
    })
    fireEvent.change(screen.getByPlaceholderText('Optional message printed below barcode'), {
      target: { value: 'Temporary Footer' }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }))

    expect(screen.getByPlaceholderText('Leave blank to use merchant name')).toHaveValue('')
    expect(screen.getByPlaceholderText('Optional message printed below barcode')).toHaveValue('')
    expect(screen.getByText('10 pt')).toBeInTheDocument()
  })

  it('prints basic sample with configured footer message', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Thanks for shopping')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Print Sample' }))

    await waitFor(() => {
      expect(window.api?.printReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_number: 'TXN-SAMPLE-0001',
          footer_message: 'Thanks for shopping'
        })
      )
    })
  })

  it('prints with-message sample fallback footer when footer field is blank', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Thanks for shopping')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Optional message printed below barcode'), {
      target: { value: '   ' }
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Sample Receipt Type' }), {
      target: { value: 'with-message' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Print Sample' }))

    await waitFor(() => {
      expect(window.api?.printReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_number: 'TXN-SAMPLE-0004',
          footer_message: 'Thank you for shopping with us!\nHave a great day.'
        })
      )
    })
  })

  it('prints with-promo sample payload branch', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Thanks for shopping')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Sample Receipt Type' }), {
      target: { value: 'with-promo' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Print Sample' }))

    await waitFor(() => {
      expect(window.api?.printReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_number: 'TXN-SAMPLE-0002',
          payment_method: 'credit',
          card_type: 'visa'
        })
      )
    })
  })

  it('prints many-items sample payload branch', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Thanks for shopping')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Sample Receipt Type' }), {
      target: { value: 'many-items' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Print Sample' }))

    await waitFor(() => {
      expect(window.api?.printReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_number: 'TXN-SAMPLE-0003',
          payment_method: 'debit',
          card_type: 'mastercard'
        })
      )
    })
  })

  it('calls onClose from header close button', async () => {
    const onClose = vi.fn()
    render(<PrinterSettingsModal isOpen={true} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Close/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^Close/ }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the receipt-mode radio defaulting to "never" when alwaysPrint is false', async () => {
    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('receipt-mode-never')).toBeInTheDocument()
    })

    expect(screen.getByTestId('receipt-mode-never')).toBeChecked()
    expect(screen.getByTestId('receipt-mode-always')).not.toBeChecked()
  })

  it('renders the receipt-mode radio selected on "always" when config has alwaysPrint true', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getReceiptConfig = vi
      .fn()
      .mockResolvedValue({ ...baseConfig, alwaysPrint: true })

    render(<PrinterSettingsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('receipt-mode-always')).toBeChecked()
    })
    expect(screen.getByTestId('receipt-mode-never')).not.toBeChecked()
  })
})
