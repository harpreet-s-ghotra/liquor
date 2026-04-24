import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchDropdown } from './SearchDropdown'

type TestItem = { id: number; label: string }

const items: TestItem[] = [
  { id: 1, label: 'First' },
  { id: 2, label: 'Second' }
]

function Harness(): React.JSX.Element {
  const [value, setValue] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [selectedCount, setSelectedCount] = useState(0)

  return (
    <>
      <SearchDropdown
        ariaLabel="Search"
        value={value}
        onValueChange={setValue}
        results={items}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSelect={() => setSelectedCount((current) => current + 1)}
        getOptionKey={(item) => item.id}
        renderOption={(item) => <span>{item.label}</span>}
      />
      <div data-testid="selected-count">{selectedCount}</div>
    </>
  )
}

describe('SearchDropdown', () => {
  it('renders combobox and options with active descendant state', () => {
    render(<Harness />)

    const input = screen.getByRole('combobox', { name: 'Search' })
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const firstOption = screen.getByRole('option', { name: 'First' })
    expect(firstOption).toHaveAttribute('aria-selected', 'true')
    expect(firstOption).toHaveClass('search-dropdown__option--highlighted')
    expect(input).toHaveAttribute('aria-activedescendant', firstOption.getAttribute('id'))
  })

  it('updates highlight on hover and selects with enter', () => {
    render(<Harness />)

    const input = screen.getByRole('combobox', { name: 'Search' })
    const secondOption = screen.getByRole('option', { name: 'Second' })

    fireEvent.mouseEnter(secondOption)
    expect(secondOption).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
  })

  it('supports top-anchored listboxes for footer-style layouts', () => {
    render(
      <SearchDropdown
        ariaLabel="Search"
        value=""
        onValueChange={vi.fn()}
        results={items}
        isOpen={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        getOptionKey={(item) => item.id}
        renderOption={(item) => <span>{item.label}</span>}
        listboxPlacement="top"
      />
    )

    expect(screen.getByRole('listbox')).toHaveClass('search-dropdown__listbox--top')
    expect(screen.getByRole('listbox')).not.toHaveClass('search-dropdown__listbox--bottom')
  })
})
