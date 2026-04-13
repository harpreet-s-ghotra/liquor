import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesHistoryModal } from './SalesHistoryModal'

const saleTxn = {
  id: 1,
  transaction_number: 'TXN-1001',
  subtotal: 20,
  tax_amount: 2,
  total: 22,
  payment_method: 'credit',
  finix_authorization_id: 'AU-stx_1',
  card_last_four: '4242',
  card_type: 'visa',
  status: 'completed',
  original_transaction_id: null,
  created_at: '2026-03-27T10:00:00.000Z',
  item_count: 2,
  notes: 'customer requested gift receipt'
}

const refundTxn = {
  ...saleTxn,
  id: 2,
  transaction_number: 'TXN-1002',
  status: 'refund',
  payment_method: 'cash',
  card_last_four: null,
  card_type: null,
  item_count: 1,
  notes: null,
  total: 10,
  subtotal: 9,
  tax_amount: 1
}

const detail = {
  id: 1,
  transaction_number: 'TXN-1001',
  subtotal: 20,
  tax_amount: 2,
  total: 22,
  payment_method: 'credit',
  finix_authorization_id: 'AU-stx_1',
  card_last_four: '4242',
  card_type: 'visa',
  status: 'completed',
  original_transaction_id: null,
  created_at: '2026-03-27T10:00:00.000Z',
  items: [
    {
      id: 11,
      product_id: 77,
      product_name: 'Cabernet',
      quantity: 2,
      unit_price: 10,
      total_price: 20
    }
  ]
}

describe('SalesHistoryModal', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      listTransactions: vi.fn().mockResolvedValue({ transactions: [saleTxn], total_count: 1 }),
      getTransactionByNumber: vi.fn().mockResolvedValue(detail)
    }
  })

  it('loads and displays transaction rows when opened', async () => {
    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(window.api?.listTransactions).toHaveBeenCalledTimes(1)
      expect(screen.getByText('TXN-1001')).toBeInTheDocument()
    })

    expect(screen.getByText('1 transaction')).toBeInTheDocument()
    expect(screen.getByText('Sale')).toBeInTheDocument()
  })

  it('shows empty state when no transactions are returned', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.listTransactions = vi
      .fn()
      .mockResolvedValue({ transactions: [], total_count: 0 })

    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-empty')).toBeInTheDocument()
      expect(screen.getByText('No transactions found.')).toBeInTheDocument()
    })
  })

  it('applies filters and can clear them', async () => {
    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-date-filter')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('sales-history-date-filter'), { target: { value: 'week' } })
    fireEvent.change(screen.getByTestId('sales-history-status-filter'), {
      target: { value: 'refund' }
    })
    fireEvent.change(screen.getByTestId('sales-history-payment-filter'), {
      target: { value: 'cash' }
    })
    fireEvent.change(screen.getByTestId('sales-history-search'), {
      target: { value: 'TXN-1001' }
    })

    await waitFor(() => {
      expect(window.api?.listTransactions).toHaveBeenCalledTimes(5)
    })

    expect(screen.getByTestId('sales-history-clear-filters')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('sales-history-clear-filters'))

    await waitFor(() => {
      expect(window.api?.listTransactions).toHaveBeenCalledTimes(6)
    })

    expect(screen.getByTestId('sales-history-date-filter')).toHaveValue('today')
    expect(screen.getByTestId('sales-history-status-filter')).toHaveValue('')
    expect(screen.getByTestId('sales-history-payment-filter')).toHaveValue('')
    expect(screen.getByTestId('sales-history-search')).toHaveValue('')
  })

  it('expands a sale row, loads details, and shows recall action', async () => {
    const onClose = vi.fn()
    const onRecall = vi.fn()

    render(<SalesHistoryModal isOpen={true} onClose={onClose} onRecallTransaction={onRecall} />)

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-row-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-row-1'))

    await waitFor(() => {
      expect(window.api?.getTransactionByNumber).toHaveBeenCalledWith('TXN-1001')
      expect(screen.getByTestId('sales-history-detail-items')).toBeInTheDocument()
      expect(screen.getByText('Cabernet')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-recall-btn'))

    expect(onRecall).toHaveBeenCalledWith('TXN-1001')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('collapses expanded row when clicked again', async () => {
    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-row-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-row-1'))

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-detail-items')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-row-1'))

    await waitFor(() => {
      expect(screen.queryByTestId('sales-history-detail-items')).not.toBeInTheDocument()
    })
  })

  it('handles detail load failure by showing fallback loading detail text', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getTransactionByNumber = vi.fn().mockRejectedValue(new Error('network'))

    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-row-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-row-1'))

    await waitFor(() => {
      expect(screen.getByText('Loading details...')).toBeInTheDocument()
    })
  })

  it('renders refund rows and hides recall action for refunds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.listTransactions = vi
      .fn()
      .mockResolvedValue({ transactions: [refundTxn], total_count: 1 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getTransactionByNumber = vi
      .fn()
      .mockResolvedValue({ ...detail, ...refundTxn, items: detail.items, status: 'refund' })

    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Refund')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('sales-history-row-2'))

    await waitFor(() => {
      expect(screen.getByTestId('sales-history-detail-items')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('sales-history-recall-btn')).not.toBeInTheDocument()
  })

  it('updates page when next button is clicked', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.listTransactions = vi
      .fn()
      .mockResolvedValue({ transactions: [saleTxn], total_count: 60 })

    render(<SalesHistoryModal isOpen={true} onClose={vi.fn()} onRecallTransaction={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Showing 1-25 of 60')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(screen.getByText('Showing 26-50 of 60')).toBeInTheDocument()
    })
  })
})
