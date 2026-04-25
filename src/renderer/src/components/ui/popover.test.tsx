import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'

describe('Popover', () => {
  it('renders trigger and toggles content', () => {
    function PopoverExample(): React.JSX.Element {
      const [open, setOpen] = useState(false)
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button>Open Popover</button>
          </PopoverTrigger>
          <PopoverContent>Popover Content</PopoverContent>
        </Popover>
      )
    }
    render(<PopoverExample />)
    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Open Popover'))
    expect(screen.getByText('Popover Content')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Open Popover'))
    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
  })
})
