import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClockOutReportView } from './ClockOutReport'
import type { ClockOutReport } from '@renderer/types/pos'

/**
 * Helper function to create a mock ClockOutReport with sensible defaults.
 * Allows overriding any top-level field to test specific scenarios.
 */
function createMockReport(overrides?: Partial<ClockOutReport>): ClockOutReport {
  return {
    session: {
      id: 1,
      opened_by_cashier_id: 1,
      opened_by_cashier_name: 'Alice',
      closed_by_cashier_id: 2,
      closed_by_cashier_name: 'Bob',
      started_at: '2026-03-28T09:00:00Z',
      ended_at: '2026-03-28T17:00:00Z',
      status: 'closed'
    },
    sales_by_item_type: [
      { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 },
      { item_type_name: 'Wine', transaction_count: 8, total_amount: 180.25 }
    ],
    sales_by_payment_method: [
      { payment_method: 'cash', transaction_count: 10, total_amount: 200 },
      { payment_method: 'credit', transaction_count: 5, total_amount: 150.25 },
      { payment_method: 'debit', transaction_count: 3, total_amount: 80.5 }
    ],
    total_sales_count: 18,
    gross_sales: 430.75,
    total_tax_collected: 34.46,
    net_sales: 396.29,
    total_refund_count: 2,
    total_refund_amount: 45.0,
    average_transaction_value: 23.93,
    expected_cash_at_close: 200.0,
    cash_total: 200.0,
    credit_total: 150.25,
    debit_total: 80.5,
    ...overrides
  }
}

describe('ClockOutReportView', () => {
  describe('Rendering', () => {
    it('renders the report container with correct test ID', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)
      expect(screen.getByTestId('clock-out-report')).toBeInTheDocument()
    })
  })

  describe('Session Info Section', () => {
    it('renders session info with started and ended times', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Started:/)).toBeInTheDocument()
      expect(screen.getByText(/Ended:/)).toBeInTheDocument()
    })

    it('formats the started_at timestamp correctly', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      // The Started text should contain a formatted date string (locale-dependent)
      expect(screen.getByText(/Started:.*2026/)).toBeInTheDocument()
    })

    it('formats the ended_at timestamp correctly', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      // The Ended text should contain a formatted date string (locale-dependent)
      expect(screen.getByText(/Ended:.*2026/)).toBeInTheDocument()
    })

    it('shows "Active" when session has no ended_at', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          ended_at: null,
          status: 'active'
        }
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Ended: Active/)).toBeInTheDocument()
    })

    it('displays opened_by_cashier_name', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          opened_by_cashier_name: 'John Smith'
        }
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Opened by: John Smith/)).toBeInTheDocument()
    })

    it('displays closed_by_cashier_name when present', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          closed_by_cashier_name: 'Jane Doe'
        }
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Closed by: Jane Doe/)).toBeInTheDocument()
    })

    it('does not render closed_by_cashier when null', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          closed_by_cashier_name: null
        }
      })
      render(<ClockOutReportView report={report} />)

      // The screen should not have "Closed by:" text at all
      expect(screen.queryByText(/Closed by:/)).not.toBeInTheDocument()
    })
  })

  describe('Sales by Item Type Section', () => {
    it('renders item type sales table when sales_by_item_type is not empty', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('dept-sales-table')).toBeInTheDocument()
      expect(screen.getByText('Sales by Item Type')).toBeInTheDocument()
    })

    it('renders all item type rows with correct data', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 },
          { item_type_name: 'Wine', transaction_count: 8, total_amount: 180.25 },
          { item_type_name: 'Beer', transaction_count: 5, total_amount: 99.75 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Spirits')).toBeInTheDocument()
      expect(screen.getByText('Wine')).toBeInTheDocument()
      expect(screen.getByText('Beer')).toBeInTheDocument()
    })

    it('formats item type total_amount as currency', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('$250.50')).toBeInTheDocument()
    })

    it('displays transaction count for each item type', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 15, total_amount: 250.5 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('15')).toBeInTheDocument()
    })

    it('does not render item type table when sales_by_item_type is empty', () => {
      const report = createMockReport({
        sales_by_item_type: []
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.queryByTestId('dept-sales-table')).not.toBeInTheDocument()
      expect(screen.queryByText('Sales by Item Type')).not.toBeInTheDocument()
    })

    it('renders table headers correctly', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      const table = screen.getByTestId('dept-sales-table')
      expect(table.querySelector('th')).toBeInTheDocument()
      // Check for header text
      const headers = table.querySelectorAll('th')
      expect(headers.length).toBe(3) // Department, Transactions, Total
      expect(headers[0].textContent).toBe('Item Type')
      expect(headers[1].textContent).toBe('Transactions')
      expect(headers[2].textContent).toBe('Total')
    })
  })

  describe('Payment Breakdown Section', () => {
    it('renders payment breakdown table', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('payment-breakdown-table')).toBeInTheDocument()
      expect(screen.getByText('Payment Breakdown')).toBeInTheDocument()
    })

    it('renders cash payment row with formatted currency', () => {
      const report = createMockReport({
        cash_total: 200.0
      })
      render(<ClockOutReportView report={report} />)

      const table = screen.getByTestId('payment-breakdown-table')
      expect(table).toHaveTextContent('Cash')
      expect(table).toHaveTextContent('$200.00')
    })

    it('renders credit payment row with formatted currency', () => {
      const report = createMockReport({
        credit_total: 150.25
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Credit')).toBeInTheDocument()
      expect(screen.getByText('$150.25')).toBeInTheDocument()
    })

    it('renders debit payment row with formatted currency', () => {
      const report = createMockReport({
        debit_total: 80.5
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Debit')).toBeInTheDocument()
      expect(screen.getByText('$80.50')).toBeInTheDocument()
    })

    it('renders all three payment methods together', () => {
      const report = createMockReport({
        cash_total: 200.0,
        credit_total: 150.25,
        debit_total: 80.5
      })
      render(<ClockOutReportView report={report} />)

      const table = screen.getByTestId('payment-breakdown-table')
      const rows = table.querySelectorAll('tbody tr')
      expect(rows.length).toBe(3) // Cash, Credit, Debit

      // Verify the table contains all payment methods
      expect(screen.getByText('Cash')).toBeInTheDocument()
      expect(screen.getByText('Credit')).toBeInTheDocument()
      expect(screen.getByText('Debit')).toBeInTheDocument()
    })

    it('renders table headers for payment breakdown', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      const table = screen.getByTestId('payment-breakdown-table')
      const headers = table.querySelectorAll('th')
      expect(headers[0].textContent).toBe('Method')
      expect(headers[1].textContent).toBe('Total')
    })

    it('handles zero payment amounts', () => {
      const report = createMockReport({
        cash_total: 0,
        credit_total: 0,
        debit_total: 0
      })
      render(<ClockOutReportView report={report} />)

      const currencyValues = screen.getAllByText('$0.00')
      expect(currencyValues.length).toBeGreaterThan(0)
    })
  })

  describe('Summary Section', () => {
    it('renders summary section', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('summary-section')).toBeInTheDocument()
      expect(screen.getByText('Summary')).toBeInTheDocument()
    })

    it('displays total sales count', () => {
      const report = createMockReport({
        total_sales_count: 42
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Total Sales')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('displays gross sales with currency formatting', () => {
      const report = createMockReport({
        gross_sales: 1234.56
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Gross Sales')).toBeInTheDocument()
      expect(screen.getByText('$1,234.56')).toBeInTheDocument()
    })

    it('displays tax collected with currency formatting', () => {
      const report = createMockReport({
        total_tax_collected: 98.76
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Tax Collected')).toBeInTheDocument()
      expect(screen.getByText('$98.76')).toBeInTheDocument()
    })

    it('displays net sales with currency formatting', () => {
      const report = createMockReport({
        net_sales: 1135.8
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Net Sales')).toBeInTheDocument()
      expect(screen.getByText('$1,135.80')).toBeInTheDocument()
    })

    it('displays average transaction value with currency formatting', () => {
      const report = createMockReport({
        average_transaction_value: 47.25
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Average Transaction')).toBeInTheDocument()
      expect(screen.getByText('$47.25')).toBeInTheDocument()
    })

    it('renders all summary rows together', () => {
      const report = createMockReport({
        total_sales_count: 18,
        gross_sales: 430.75,
        total_tax_collected: 34.46,
        net_sales: 396.29,
        average_transaction_value: 23.93
      })
      render(<ClockOutReportView report={report} />)

      const summarySection = screen.getByTestId('summary-section')
      const summaryRows = summarySection.querySelectorAll('.clock-out-report__summary-row')
      expect(summaryRows.length).toBe(5)
    })
  })

  describe('Refunds Section', () => {
    it('renders refund section when total_refund_count > 0', () => {
      const report = createMockReport({
        total_refund_count: 3,
        total_refund_amount: 75.5
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('refund-section')).toBeInTheDocument()
      expect(screen.getByText('Refunds')).toBeInTheDocument()
    })

    it('displays refund count correctly', () => {
      const report = createMockReport({
        total_refund_count: 5
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Refund Count')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('displays refund total with currency formatting', () => {
      const report = createMockReport({
        total_refund_count: 2,
        total_refund_amount: 125.99
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Refund Total')).toBeInTheDocument()
      expect(screen.getByText('$125.99')).toBeInTheDocument()
    })

    it('does not render refund section when total_refund_count is 0', () => {
      const report = createMockReport({
        total_refund_count: 0,
        total_refund_amount: 0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.queryByTestId('refund-section')).not.toBeInTheDocument()
      expect(screen.queryByText('Refunds')).not.toBeInTheDocument()
    })

    it('does not render refund section when total_refund_count is null/undefined', () => {
      const report = createMockReport({
        total_refund_count: 0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.queryByTestId('refund-section')).not.toBeInTheDocument()
    })

    it('renders refund section with two rows: count and total', () => {
      const report = createMockReport({
        total_refund_count: 3,
        total_refund_amount: 50.0
      })
      render(<ClockOutReportView report={report} />)

      const refundSection = screen.getByTestId('refund-section')
      const refundRows = refundSection.querySelectorAll('.clock-out-report__summary-row')
      expect(refundRows.length).toBe(2)
    })
  })

  describe('Cash Reconciliation Section', () => {
    it('renders cash reconciliation section', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('cash-reconciliation')).toBeInTheDocument()
      expect(screen.getByText('Cash Reconciliation')).toBeInTheDocument()
    })

    it('displays cash sales', () => {
      const report = createMockReport({
        cash_total: 500.0
      })
      render(<ClockOutReportView report={report} />)

      const recon = screen.getByTestId('cash-reconciliation')
      expect(recon).toHaveTextContent('Cash Sales')
      expect(recon).toHaveTextContent('$500.00')
    })

    it('displays expected cash with bold styling', () => {
      const report = createMockReport({
        expected_cash_at_close: 450.0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Expected Cash')).toBeInTheDocument()
      expect(screen.getByText('$450.00')).toBeInTheDocument()
    })

    it('shows cash refunds row when cash_total !== expected_cash_at_close', () => {
      const report = createMockReport({
        cash_total: 500.0,
        expected_cash_at_close: 450.0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Cash Refunds')).toBeInTheDocument()
      // Cash refunds should be displayed as negative (expected - actual)
      expect(screen.getByText('-$50.00')).toBeInTheDocument()
    })

    it('does not show cash refunds row when cash_total === expected_cash_at_close', () => {
      const report = createMockReport({
        cash_total: 500.0,
        expected_cash_at_close: 500.0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.queryByText('Cash Refunds')).not.toBeInTheDocument()
    })

    it('correctly calculates cash refunds difference', () => {
      const report = createMockReport({
        cash_total: 1000.0,
        expected_cash_at_close: 750.0
      })
      render(<ClockOutReportView report={report} />)

      // Should show negative value: -(1000 - 750) = -250
      expect(screen.getByText('-$250.00')).toBeInTheDocument()
    })

    it('renders all three rows when there are cash refunds', () => {
      const report = createMockReport({
        cash_total: 500.0,
        expected_cash_at_close: 450.0
      })
      render(<ClockOutReportView report={report} />)

      const reconciliationSection = screen.getByTestId('cash-reconciliation')
      const rows = reconciliationSection.querySelectorAll('.clock-out-report__summary-row')
      expect(rows.length).toBe(3) // Cash Sales, Cash Refunds, Expected Cash
    })

    it('renders two rows when there are no cash refunds', () => {
      const report = createMockReport({
        cash_total: 500.0,
        expected_cash_at_close: 500.0
      })
      render(<ClockOutReportView report={report} />)

      const reconciliationSection = screen.getByTestId('cash-reconciliation')
      const rows = reconciliationSection.querySelectorAll('.clock-out-report__summary-row')
      expect(rows.length).toBe(2) // Cash Sales, Expected Cash
    })

    it('applies highlight styling to cash reconciliation section', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      const reconciliationDiv = screen.getByTestId('cash-reconciliation').parentElement
      expect(reconciliationDiv).toHaveClass('clock-out-report__section--highlight')
    })
  })

  describe('Edge Cases and Data Variations', () => {
    it('handles all zero values', () => {
      const report = createMockReport({
        total_sales_count: 0,
        gross_sales: 0,
        total_tax_collected: 0,
        net_sales: 0,
        average_transaction_value: 0,
        cash_total: 0,
        credit_total: 0,
        debit_total: 0,
        total_refund_count: 0,
        total_refund_amount: 0,
        expected_cash_at_close: 0,
        sales_by_item_type: []
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByTestId('clock-out-report')).toBeInTheDocument()
    })

    it('handles large currency amounts', () => {
      const report = createMockReport({
        gross_sales: 99999.99,
        cash_total: 50000.0,
        credit_total: 25000.0,
        debit_total: 24999.99
      })
      render(<ClockOutReportView report={report} />)

      const summary = screen.getByTestId('summary-section')
      expect(summary).toHaveTextContent('$99,999.99')
      const payTable = screen.getByTestId('payment-breakdown-table')
      expect(payTable).toHaveTextContent('$50,000.00')
    })

    it('handles currency with cents only (e.g., $0.50)', () => {
      const report = createMockReport({
        cash_total: 0.5,
        expected_cash_at_close: 0.5
      })
      render(<ClockOutReportView report={report} />)

      const payTable = screen.getByTestId('payment-breakdown-table')
      expect(payTable).toHaveTextContent('$0.50')
    })

    it('handles many item types in the sales breakdown', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Spirits', transaction_count: 10, total_amount: 250.5 },
          { item_type_name: 'Wine', transaction_count: 8, total_amount: 180.25 },
          { item_type_name: 'Beer', transaction_count: 5, total_amount: 99.75 },
          { item_type_name: 'Accessories', transaction_count: 3, total_amount: 45.0 },
          { item_type_name: 'Mixers', transaction_count: 2, total_amount: 20.0 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Spirits')).toBeInTheDocument()
      expect(screen.getByText('Wine')).toBeInTheDocument()
      expect(screen.getByText('Beer')).toBeInTheDocument()
      expect(screen.getByText('Accessories')).toBeInTheDocument()
      expect(screen.getByText('Mixers')).toBeInTheDocument()
    })

    it('handles item type names with special characters', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'Wine & Spirits', transaction_count: 5, total_amount: 100.0 },
          { item_type_name: 'Non-Alcoholic', transaction_count: 3, total_amount: 50.0 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('Wine & Spirits')).toBeInTheDocument()
      expect(screen.getByText('Non-Alcoholic')).toBeInTheDocument()
    })

    it('renders correctly with different date formats (DST transitions)', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          started_at: '2026-01-15T08:00:00Z', // Winter
          ended_at: '2026-07-15T20:00:00Z' // Summer
        }
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument()
      expect(screen.getByText(/Jul 15, 2026/)).toBeInTheDocument()
    })

    it('handles high refund count with matching high refund amount', () => {
      const report = createMockReport({
        total_refund_count: 100,
        total_refund_amount: 5000.0
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    })
  })

  describe('Complete Report Scenarios', () => {
    it('renders a complete typical end-of-day report', () => {
      const report = createMockReport()
      render(<ClockOutReportView report={report} />)

      // Verify all major sections are present
      expect(screen.getByTestId('clock-out-report')).toBeInTheDocument()
      expect(screen.getByText(/Started:/)).toBeInTheDocument()
      expect(screen.getByText(/Ended:/)).toBeInTheDocument()
      expect(screen.getByTestId('dept-sales-table')).toBeInTheDocument()
      expect(screen.getByTestId('payment-breakdown-table')).toBeInTheDocument()
      expect(screen.getByTestId('summary-section')).toBeInTheDocument()
      expect(screen.getByTestId('refund-section')).toBeInTheDocument()
      expect(screen.getByTestId('cash-reconciliation')).toBeInTheDocument()
    })

    it('renders report with no item types and no refunds', () => {
      const report = createMockReport({
        sales_by_item_type: [],
        total_refund_count: 0,
        total_refund_amount: 0
      })
      render(<ClockOutReportView report={report} />)

      // Item type and refund sections should not exist
      expect(screen.queryByTestId('dept-sales-table')).not.toBeInTheDocument()
      expect(screen.queryByTestId('refund-section')).not.toBeInTheDocument()

      // But other sections must exist
      expect(screen.getByTestId('payment-breakdown-table')).toBeInTheDocument()
      expect(screen.getByTestId('summary-section')).toBeInTheDocument()
      expect(screen.getByTestId('cash-reconciliation')).toBeInTheDocument()
    })

    it('renders report for an active (unclosed) session', () => {
      const report = createMockReport({
        session: {
          ...createMockReport().session,
          ended_at: null,
          closed_by_cashier_id: null,
          closed_by_cashier_name: null,
          status: 'active'
        }
      })
      render(<ClockOutReportView report={report} />)

      expect(screen.getByText(/Ended: Active/)).toBeInTheDocument()
      expect(screen.queryByText(/Closed by:/)).not.toBeInTheDocument()
    })

    it('displays multiple item types with varied transaction counts', () => {
      const report = createMockReport({
        sales_by_item_type: [
          { item_type_name: 'High Volume Type', transaction_count: 250, total_amount: 5000.0 },
          { item_type_name: 'Low Volume Type', transaction_count: 3, total_amount: 75.0 }
        ]
      })
      render(<ClockOutReportView report={report} />)

      const table = screen.getByTestId('dept-sales-table')
      expect(table).toHaveTextContent('250')
      expect(table).toHaveTextContent('High Volume Type')
      expect(table).toHaveTextContent('Low Volume Type')
    })
  })
})
