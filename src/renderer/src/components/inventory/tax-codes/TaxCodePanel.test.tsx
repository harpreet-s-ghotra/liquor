import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaxCodePanel } from './TaxCodePanel'

describe('TaxCodePanel', () => {
  beforeEach(() => {
    const api = {
      getTaxCodes: vi.fn(async () => [
        { id: 1, code: 'GST', rate: 0.05 },
        { id: 2, code: 'HST', rate: 0.13 }
      ]),
      createTaxCode: vi.fn(async (input: { code: string; rate: number }) => ({
        id: 3,
        code: input.code,
        rate: input.rate
      })),
      updateTaxCode: vi.fn(async (input: { id: number; code: string; rate: number }) => ({
        id: input.id,
        code: input.code,
        rate: input.rate
      })),
      deleteTaxCode: vi.fn(async () => undefined)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  it('loads and displays tax codes', async () => {
    render(<TaxCodePanel />)

    expect(await screen.findByText('GST')).toBeInTheDocument()
    expect(screen.getByText('HST')).toBeInTheDocument()
  })

  it('displays rate as percentage', async () => {
    render(<TaxCodePanel />)

    expect(await screen.findByText('5.00%')).toBeInTheDocument()
    expect(screen.getByText('13.00%')).toBeInTheDocument()
  })

  it('shows empty state when no tax codes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getTaxCodes = vi.fn(async () => [])

    render(<TaxCodePanel />)

    expect(
      await screen.findByText('No tax codes yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('validates empty code', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Tax Code' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
  })

  it('validates rate out of range', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax Code' }))

    expect(await screen.findByText('Rate must be 0\u2013100')).toBeInTheDocument()
  })

  it('creates a tax code converting percentage to decimal', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax Code' }))

    await waitFor(() => {
      expect(api.createTaxCode).toHaveBeenCalledWith({ code: 'PST', rate: 0.07 })
    })
    expect(await screen.findByText('Tax code created')).toBeInTheDocument()
  })

  it('starts editing and saves a tax code', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const codeInput = screen.getByLabelText('Edit Tax Code Name')
    fireEvent.change(codeInput, { target: { value: 'GST-NEW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateTaxCode).toHaveBeenCalledWith({ id: 1, code: 'GST-NEW', rate: 0.05 })
    })
    expect(await screen.findByText('Tax code updated')).toBeInTheDocument()
  })

  it('deletes a tax code', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(api.deleteTaxCode).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText('Tax code deleted')).toBeInTheDocument()
  })

  it('shows error when create fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.createTaxCode = vi.fn(async () => {
      throw new Error('Duplicate code')
    })

    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'DUP' } })
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax Code' }))

    expect(await screen.findByText('Duplicate code')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateTaxCode = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteTaxCode = vi.fn(async () => {
      throw new Error('In use by products')
    })

    render(<TaxCodePanel />)

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[0])

    expect(await screen.findByText('In use by products')).toBeInTheDocument()
  })

  it('validates empty edit code', async () => {
    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByLabelText('Edit Tax Code Name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
  })

  it('validates invalid edit rate', async () => {
    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    fireEvent.change(screen.getByLabelText('Edit Tax Rate'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Rate must be 0\u2013100')).toBeInTheDocument()
  })

  it('cancels editing', async () => {
    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    expect(screen.getByLabelText('Edit Tax Code Name')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Edit Tax Code Name')).not.toBeInTheDocument()
  })

  it('saves edit via Enter key on rate field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const rateInput = screen.getByLabelText('Edit Tax Rate')
    fireEvent.keyDown(rateInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateTaxCode).toHaveBeenCalled()
    })
  })

  it('cancels edit via Escape key on rate field', async () => {
    render(<TaxCodePanel />)

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])

    const rateInput = screen.getByLabelText('Edit Tax Rate')
    fireEvent.keyDown(rateInput, { key: 'Escape' })

    expect(screen.queryByLabelText('Edit Tax Rate')).not.toBeInTheDocument()
  })

  it('validates empty rate field', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    // Leave rate empty
    fireEvent.click(screen.getByRole('button', { name: 'Add Tax Code' }))

    expect(await screen.findByText('Rate is required')).toBeInTheDocument()
  })

  it('creates via Enter key on rate field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '8' } })
    fireEvent.keyDown(screen.getByLabelText('Tax Rate'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.createTaxCode).toHaveBeenCalledWith({ code: 'PST', rate: 0.08 })
    })
  })
})
