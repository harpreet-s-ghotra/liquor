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

  it('marks active tab with aria-selected and distinct styling', () => {
    render(<TabBar tabs={tabs} activeTab="departments" onTabChange={vi.fn()} />)

    const active = screen.getByRole('tab', { name: 'Departments' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active.className).toContain('tab-bar__tab--active')

    const inactive = screen.getByRole('tab', { name: 'Items' })
    expect(inactive).toHaveAttribute('aria-selected', 'false')
    expect(inactive.className).not.toContain('tab-bar__tab--active')
  })

  it('calls onTabChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<TabBar tabs={tabs} activeTab="items" onTabChange={onChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Tax Codes' }))
    expect(onChange).toHaveBeenCalledWith('tax-codes')
  })
})
