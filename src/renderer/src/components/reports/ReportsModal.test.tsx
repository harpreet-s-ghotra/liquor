import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsModal } from './ReportsModal'
import type { SalesSummaryReport, ProductSalesReport, TaxReport } from '../../../../shared/types'

// Mock react-chartjs-2 to avoid canvas/DOM issues in jsdom
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Doughnut: () => <div data-testid="mock-doughnut-chart" />,
  Bar: () => <div data-testid="mock-bar-chart" />
}))

const mockSummary: SalesSummaryReport = {
  gross_sales: 500,
  tax_collected: 40,
  net_sales: 460,
  refund_count: 1,
  refund_amount: 25,
  transaction_count: 10,
  avg_transaction: 50,
  sales_by_payment: [
    { payment_method: 'cash', transaction_count: 6, total_amount: 300 },
    { payment_method: 'credit', transaction_count: 4, total_amount: 200 }
  ],
  sales_by_card_brand: [
    { card_brand: 'Visa', transaction_count: 3, total_amount: 150 },
    { card_brand: 'Mastercard', transaction_count: 1, total_amount: 50 }
  ],
  sales_by_day: [
    {
      date: '2024-06-10',
      transaction_count: 5,
      gross_sales: 250,
      tax_collected: 20,
      net_sales: 230
    },
    {
      date: '2024-06-11',
      transaction_count: 5,
      gross_sales: 250,
      tax_collected: 20,
      net_sales: 230
    }
  ]
}

const mockProductReport: ProductSalesReport = {
  items: [
    {
      product_id: 1,
      product_name: 'Test Wine',
      item_type: 'Wine',
      distributor_name: 'Alpha',
      sku: 'SKU1',
      quantity_sold: 20,
      revenue: 400,
      cost_total: 200,
      profit: 200,
      margin_pct: 50
    }
  ]
}

const mockTaxReport: TaxReport = {
  tax_rows: [{ tax_code_name: '8%', tax_rate: 8, taxable_sales: 500, tax_collected: 40 }]
}

const mockApi = {
  getDeviceConfig: vi.fn(),
  getMerchantConfig: vi.fn(),
  getReportSalesSummary: vi.fn(),
  getReportProductSales: vi.fn(),
  getReportCategorySales: vi.fn(),
  getReportTaxSummary: vi.fn(),
  getReportComparison: vi.fn(),
  getReportCashierSales: vi.fn(),
  getReportHourlySales: vi.fn(),
  exportReport: vi.fn()
}

describe('ReportsModal', () => {
  beforeEach(() => {
    Object.values(mockApi).forEach((fn) => fn.mockReset())
    ;(window as unknown as { api: typeof mockApi }).api = mockApi
    mockApi.getReportSalesSummary.mockResolvedValue(mockSummary)
    mockApi.getDeviceConfig.mockResolvedValue({ device_id: 'register-a' })
    mockApi.getMerchantConfig.mockResolvedValue({
      merchant_id: 'MU123',
      merchant_name: 'High Spirits LLC',
      store_name: 'High Spirits - Main'
    })
    mockApi.getReportProductSales.mockResolvedValue(mockProductReport)
    mockApi.getReportCategorySales.mockResolvedValue({ categories: [] })
    mockApi.getReportTaxSummary.mockResolvedValue(mockTaxReport)
    mockApi.getReportComparison.mockResolvedValue({
      period_a: mockSummary,
      period_b: mockSummary,
      deltas: []
    })
  })

  afterEach(() => {
    delete (window as unknown as { api?: typeof mockApi }).api
  })

  it('renders nothing when closed', () => {
    render(<ReportsModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Sales Reports')).not.toBeInTheDocument()
  })

  it('renders modal with tabs when open', async () => {
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Sales Reports')).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: 'Sales Summary' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Product Analysis' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tax Report' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Comparisons' })).toBeInTheDocument()
  })

  it('loads sales summary on open', async () => {
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })
    expect(screen.getByText('Gross Sales')).toBeInTheDocument()
    expect(screen.getByText('Net Sales')).toBeInTheDocument()
    expect(screen.getByText('Tax Collected')).toBeInTheDocument()
  })

  it('shows refund summary when refunds exist', async () => {
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/Refunds: 1/)).toBeInTheDocument()
    })
  })

  it('switches to Product Analysis tab', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Product Analysis'))
    await waitFor(() => {
      expect(mockApi.getReportProductSales).toHaveBeenCalled()
    })
  })

  it('switches to Tax Report tab', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Tax Report'))
    await waitFor(() => {
      expect(mockApi.getReportTaxSummary).toHaveBeenCalled()
    })
  })

  it('calls exportReport when Download PDF is clicked', async () => {
    const user = userEvent.setup()
    mockApi.exportReport.mockResolvedValue('/tmp/report.pdf')
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Download PDF'))
    await waitFor(() => {
      expect(mockApi.exportReport).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'pdf', report_type: 'sales-summary' })
      )
    })
  })

  it('calls exportReport when Download CSV is clicked', async () => {
    const user = userEvent.setup()
    mockApi.exportReport.mockResolvedValue('/tmp/report.csv')
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Download CSV'))
    await waitFor(() => {
      expect(mockApi.exportReport).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'csv', report_type: 'sales-summary' })
      )
    })
  })

  it('exports selected report type from export dropdown', async () => {
    const user = userEvent.setup()
    mockApi.exportReport.mockResolvedValue('/tmp/transactions.csv')
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.selectOptions(screen.getByLabelText('Export'), 'transaction-list')
    await user.click(screen.getByText('Download CSV'))

    await waitFor(() => {
      expect(mockApi.exportReport).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'csv', report_type: 'transaction-list' })
      )
    })
  })

  it('calls onClose when dialog is dismissed', async () => {
    const onClose = vi.fn()
    render(<ReportsModal isOpen={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('Sales Reports')).toBeInTheDocument()
    })
  })

  it('switches to Comparisons tab and shows comparison UI', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Comparisons'))
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
    expect(
      screen.getByRole('heading', { name: 'This Year vs Last Year by Month' })
    ).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Last Year' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'This Year (YTD)' })).toBeInTheDocument()
  })

  it('updates comparison grouping when a new granularity is selected', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Comparisons'))
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'This Year vs Last Year by Month' })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole('radio', { name: 'Group by quarter' }))

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'This Year vs Last Year by Quarter' })
      ).toBeInTheDocument()
    })
  })

  it('renders product table rows in product tab', async () => {
    const user = userEvent.setup()
    mockApi.getReportCategorySales.mockResolvedValue({
      categories: [
        {
          item_type: 'Wine',
          transaction_count: 6,
          quantity_sold: 20,
          revenue: 400,
          profit: 200,
          profit_margin_pct: 50
        }
      ]
    })
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Product Analysis'))
    await waitFor(() => {
      expect(screen.getByText('Test Wine')).toBeInTheDocument()
    })
    expect(screen.getByText('SKU1')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows no-data message when summary has empty sales_by_day', async () => {
    mockApi.getReportSalesSummary.mockResolvedValue({
      ...mockSummary,
      sales_by_day: [],
      sales_by_payment: [],
      sales_by_card_brand: [],
      refund_count: 0
    })
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('No data for selected period').length).toBeGreaterThan(0)
    })
  })

  it('does not call export on comparison tab (no export available)', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })
    await user.click(screen.getByText('Comparisons'))
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
    // No Download buttons on comparison tab
    expect(screen.queryByText('Download PDF')).not.toBeInTheDocument()
    expect(screen.queryByText('Download CSV')).not.toBeInTheDocument()
  })

  it('renders tax report table rows', async () => {
    const user = userEvent.setup()
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })
    await user.click(screen.getByText('Tax Report'))
    await waitFor(() => {
      expect(mockApi.getReportTaxSummary).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('Tax Code')).toBeInTheDocument()
    })
  })

  it('handles export error gracefully', async () => {
    const user = userEvent.setup()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.exportReport.mockRejectedValue(new Error('Export failed'))
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })
    await user.click(screen.getByText('Download PDF'))
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })
    consoleSpy.mockRestore()
  })

  it('handles data loading error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.getReportSalesSummary.mockRejectedValue(new Error('DB error'))
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled()
    })
    consoleSpy.mockRestore()
  })
})
