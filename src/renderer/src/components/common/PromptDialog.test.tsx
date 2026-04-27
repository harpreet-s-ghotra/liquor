import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromptDialog } from './PromptDialog'

describe('PromptDialog', () => {
  let onConfirm: (value: string) => void
  let onCancel: () => void

  beforeEach(() => {
    onConfirm = vi.fn() as unknown as (value: string) => void
    onCancel = vi.fn() as unknown as () => void
  })

  const baseProps = {
    title: 'Add note',
    message: 'Optional note for this hold.'
  }

  it('does not render the body when closed', () => {
    render(<PromptDialog {...baseProps} isOpen={false} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.queryByTestId('prompt-dialog-input')).not.toBeInTheDocument()
  })

  it('renders the input with initial value when opened', async () => {
    render(
      <PromptDialog
        {...baseProps}
        isOpen
        initialValue="Mike"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    const input = await screen.findByTestId('prompt-dialog-input')
    expect((input as HTMLInputElement).value).toBe('Mike')
  })

  it('autofocuses the input after open', async () => {
    render(<PromptDialog {...baseProps} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    const input = await screen.findByTestId('prompt-dialog-input')
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('forwards the typed value to onConfirm via the confirm button', () => {
    render(<PromptDialog {...baseProps} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.change(screen.getByTestId('prompt-dialog-input'), { target: { value: 'pickup' } })
    fireEvent.click(screen.getByTestId('prompt-dialog-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledWith('pickup')
  })

  it('forwards the typed value via Enter key as well', () => {
    render(<PromptDialog {...baseProps} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    const input = screen.getByTestId('prompt-dialog-input')
    fireEvent.change(input, { target: { value: 'pickup' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('pickup')
  })

  it('confirms with an empty string when no value is typed', () => {
    render(<PromptDialog {...baseProps} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('prompt-dialog-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledWith('')
  })

  it('caps the input length at the default 200 chars', () => {
    render(<PromptDialog {...baseProps} isOpen onConfirm={onConfirm} onCancel={onCancel} />)
    const input = screen.getByTestId('prompt-dialog-input') as HTMLInputElement
    expect(input.maxLength).toBe(200)
  })

  it('respects an explicit maxLength prop', () => {
    render(
      <PromptDialog
        {...baseProps}
        isOpen
        maxLength={50}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    const input = screen.getByTestId('prompt-dialog-input') as HTMLInputElement
    expect(input.maxLength).toBe(50)
  })

  it('resets the typed value between opens (no carry-over)', async () => {
    const { rerender } = render(
      <PromptDialog
        {...baseProps}
        isOpen
        initialValue=""
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    fireEvent.change(screen.getByTestId('prompt-dialog-input'), { target: { value: 'leftover' } })

    // Close
    rerender(
      <PromptDialog
        {...baseProps}
        isOpen={false}
        initialValue=""
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    // Reopen with the same initialValue
    rerender(
      <PromptDialog
        {...baseProps}
        isOpen
        initialValue=""
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const input = await screen.findByTestId('prompt-dialog-input')
    expect((input as HTMLInputElement).value).toBe('')
  })
})
