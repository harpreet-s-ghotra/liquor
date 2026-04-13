import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportDateRangePicker } from './ReportDateRangePicker'
import type { ReportDateRange } from '../../../../shared/types'

describe('ReportDateRangePicker', () => {
  const defaultRange: ReportDateRange = {
    from: '2024-06-01T00:00:00.000Z',
    to: '2024-06-30T23:59:59.000Z',
    preset: 'this-month'
  }

  it('renders all preset buttons', () => {
    render(<ReportDateRangePicker value={defaultRange} onChange={vi.fn()} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('This Week')).toBeInTheDocument()
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('calls onChange with computed range when preset clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ReportDateRangePicker value={defaultRange} onChange={onChange} />)
    await user.click(screen.getByText('Today'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: 'today' }))
  })

  it('calls onChange with custom preset when Custom clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ReportDateRangePicker value={defaultRange} onChange={onChange} />)
    await user.click(screen.getByText('Custom'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom' }))
  })

  it('shows date inputs when preset is custom', () => {
    const customRange: ReportDateRange = {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-30T23:59:59.000Z',
      preset: 'custom'
    }
    render(<ReportDateRangePicker value={customRange} onChange={vi.fn()} />)
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
  })

  it('does not show date inputs for non-custom preset', () => {
    render(<ReportDateRangePicker value={defaultRange} onChange={vi.fn()} />)
    expect(screen.queryByText('From')).not.toBeInTheDocument()
  })

  it('calls onChange when From date changes', () => {
    const onChange = vi.fn()
    const customRange: ReportDateRange = {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-30T23:59:59.000Z',
      preset: 'custom'
    }
    render(<ReportDateRangePicker value={customRange} onChange={onChange} />)
    const fromInput = screen.getByDisplayValue('2024-06-01')
    fireEvent.change(fromInput, { target: { value: '2024-06-05' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom' }))
  })

  it('calls onChange when To date changes', () => {
    const onChange = vi.fn()
    const customRange: ReportDateRange = {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-30T23:59:59.000Z',
      preset: 'custom'
    }
    render(<ReportDateRangePicker value={customRange} onChange={onChange} />)
    const toInput = screen.getByDisplayValue('2024-06-30')
    fireEvent.change(toInput, { target: { value: '2024-06-25' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: 'custom' }))
  })

  it('defaults to custom when preset is undefined', () => {
    const noPresetRange = {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-30T23:59:59.000Z'
    } as ReportDateRange
    render(<ReportDateRangePicker value={noPresetRange} onChange={vi.fn()} />)
    expect(screen.getByText('From')).toBeInTheDocument()
  })
})
