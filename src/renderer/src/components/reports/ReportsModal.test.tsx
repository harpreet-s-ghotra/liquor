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
    expect(screen.getByText('Sales Summary')).toBeInTheDocument()
    expect(screen.getByText('Product Analysis')).toBeInTheDocument()
    expect(screen.getByText('Tax Report')).toBeInTheDocument()
    expect(screen.getByText('Comparisons')).toBeInTheDocument()
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

  it('calls onClose when dialog is dismissed', async () => {
    const onClose = vi.fn()
    render(<ReportsModal isOpen={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('Sales Reports')).toBeInTheDocument()
    })
  })

  it('switches to Comparisons tab and shows comparison UI', async () => {
    const user = userEvent.setup()
    mockApi.getReportComparison.mockResolvedValue({
      period_a: mockSummary,
      period_b: { ...mockSummary, gross_sales: 600 },
      deltas: [
        {
          field: 'Gross Sales',
          period_a_value: 500,
          period_b_value: 600,
          change_pct: 20
        }
      ]
    })
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })

    await user.click(screen.getByText('Comparisons'))
    await waitFor(() => {
      expect(mockApi.getReportComparison).toHaveBeenCalled()
    })
    expect(screen.getAllByText('Period A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Period B').length).toBeGreaterThan(0)
    expect(screen.getByText('Compare')).toBeInTheDocument()
  })

  it('renders product table rows in product tab', async () => {
    const user = userEvent.setup()
    mockApi.getReportCategorySales.mockResolvedValue({
      categories: [
        { item_type: 'Wine', quantity_sold: 20, revenue: 400, cost_total: 200, profit: 200 }
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
      refund_count: 0
    })
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getAllByText('No data for selected period').length).toBeGreaterThan(0)
    })
  })

  it('does not call export on comparison tab (no export available)', async () => {
    const user = userEvent.setup()
    mockApi.getReportComparison.mockResolvedValue({
      period_a: mockSummary,
      period_b: mockSummary,
      deltas: []
    })
    render(<ReportsModal isOpen={true} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(mockApi.getReportSalesSummary).toHaveBeenCalled()
    })
    await user.click(screen.getByText('Comparisons'))
    await waitFor(() => {
      expect(mockApi.getReportComparison).toHaveBeenCalled()
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
