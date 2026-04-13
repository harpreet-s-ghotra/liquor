import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportSummaryCard } from './ReportSummaryCard'

describe('ReportSummaryCard', () => {
  it('renders currency value by default', () => {
    render(<ReportSummaryCard label="Gross Sales" value={500} />)
    expect(screen.getByText('Gross Sales')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
  })

  it('renders non-currency value', () => {
    render(<ReportSummaryCard label="Transactions" value={42} isCurrency={false} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows positive delta', () => {
    render(<ReportSummaryCard label="Sales" value={100} delta={15.5} />)
    expect(screen.getByText('+15.5%')).toBeInTheDocument()
  })

  it('shows negative delta', () => {
    render(<ReportSummaryCard label="Sales" value={100} delta={-8.3} />)
    expect(screen.getByText('-8.3%')).toBeInTheDocument()
  })

  it('shows zero delta', () => {
    render(<ReportSummaryCard label="Sales" value={100} delta={0} />)
    expect(screen.getByText('0.0%')).toBeInTheDocument()
  })

  it('does not show delta when null', () => {
    render(<ReportSummaryCard label="Sales" value={100} delta={null} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })

  it('does not show delta when undefined', () => {
    render(<ReportSummaryCard label="Sales" value={100} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })
})
