import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  const tabs = [
    { id: 'items', label: 'Items' },
    { id: 'departments', label: 'Departments' },
    { id: 'tax-codes', label: 'Tax Codes' }
  ]

  it('renders all tabs', () => {
    render(<TabBar tabs={tabs} activeTab="items" onTabChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Items' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Departments' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tax Codes' })).toBeInTheDocument()
  })

  it('marks active tab with active class and aria-selected', () => {
    render(<TabBar tabs={tabs} activeTab="departments" onTabChange={vi.fn()} />)

    const active = screen.getByRole('tab', { name: 'Departments' })
    expect(active.className).toContain('active')
    expect(active).toHaveAttribute('aria-selected', 'true')

    const inactive = screen.getByRole('tab', { name: 'Items' })
    expect(inactive.className).not.toContain('active')
    expect(inactive).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onTabChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} activeTab="items" onTabChange={onChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Tax Codes' }))
    expect(onChange).toHaveBeenCalledWith('tax-codes')
  })
})
