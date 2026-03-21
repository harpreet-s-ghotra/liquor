import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaxCodePanel } from './TaxCodePanel'

type TC = { id: number; code: string; rate: number }

describe('TaxCodePanel', () => {
  let store: TC[]

  beforeEach(() => {
    store = [
      { id: 1, code: 'GST', rate: 0.05 },
      { id: 2, code: 'HST', rate: 0.13 }
    ]

    const api = {
      getTaxCodes: vi.fn(async () => [...store]),
      createTaxCode: vi.fn(async (input: { code: string; rate: number }) => {
        const tc = { id: store.length + 1, code: input.code, rate: input.rate }
        store.push(tc)
        return tc
      }),
      updateTaxCode: vi.fn(async (input: { id: number; code: string; rate: number }) => {
        const idx = store.findIndex((t) => t.id === input.id)
        if (idx >= 0) store[idx] = { ...store[idx], ...input }
        return store[idx]
      }),
      deleteTaxCode: vi.fn(async (id: number) => {
        store = store.filter((t) => t.id !== id)
        return undefined
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = { ...(window as any).api, ...api }
  })

  /** Helper: click a table row to select a tax code */
  const selectRow = async (code: string): Promise<void> => {
    const cell = await screen.findByText(code)
    fireEvent.click(cell.closest('tr')!)
  }

  it('loads and displays tax codes', async () => {
    render(<TaxCodePanel />)

    expect(await screen.findByText('GST')).toBeInTheDocument()
    expect(screen.getByText('HST')).toBeInTheDocument()
  })

  it('displays rate as percentage', async () => {
    render(<TaxCodePanel />)

    expect(await screen.findByText('5%')).toBeInTheDocument()
    expect(screen.getByText('13%')).toBeInTheDocument()
  })

  it('shows empty state when no tax codes', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.getTaxCodes = vi.fn(async () => [])

    render(<TaxCodePanel />)

    expect(
      await screen.findByText('No tax codes yet. Add one above to get started.')
    ).toBeInTheDocument()
  })

  it('shows placeholder text when nothing selected', async () => {
    render(<TaxCodePanel />)

    expect(
      await screen.findByText('Select a tax code above to view and edit its details.')
    ).toBeInTheDocument()
  })

  it('validates empty code', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
  })

  it('validates rate out of range', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    fireEvent.change(screen.getByLabelText('Tax Rate'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.createTaxCode).toHaveBeenCalledWith({ code: 'PST', rate: 0.07 })
    })
    expect(await screen.findByText('Tax code created')).toBeInTheDocument()
  })

  it('selects a tax code and shows edit panel', async () => {
    render(<TaxCodePanel />)

    await selectRow('GST')

    expect(screen.getByLabelText('Edit Tax Code Name')).toHaveValue('GST')
    expect(screen.getByLabelText('Edit Tax Rate')).toHaveValue('5')
    expect(screen.getByText('Editing: GST')).toBeInTheDocument()
  })

  it('edits and saves a tax code via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await selectRow('GST')

    const codeInput = screen.getByLabelText('Edit Tax Code Name')
    fireEvent.change(codeInput, { target: { value: 'GST-NEW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateTaxCode).toHaveBeenCalledWith({ id: 1, code: 'GST-NEW', rate: 0.05 })
    })
    expect(await screen.findByText('Tax code updated')).toBeInTheDocument()
  })

  it('deletes a tax code via bottom panel', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await selectRow('GST')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Duplicate code')).toBeInTheDocument()
  })

  it('shows error when update fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.updateTaxCode = vi.fn(async () => {
      throw new Error('Update failed')
    })

    render(<TaxCodePanel />)

    await selectRow('GST')
    fireEvent.change(screen.getByLabelText('Edit Tax Code Name'), {
      target: { value: 'GST-changed' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Update failed')).toBeInTheDocument()
  })

  it('shows error when delete fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api.deleteTaxCode = vi.fn(async () => {
      throw new Error('In use by products')
    })

    render(<TaxCodePanel />)

    await selectRow('GST')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('In use by products')).toBeInTheDocument()
  })

  it('validates empty edit code', async () => {
    render(<TaxCodePanel />)

    await selectRow('GST')

    fireEvent.change(screen.getByLabelText('Edit Tax Code Name'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
  })

  it('validates invalid edit rate', async () => {
    render(<TaxCodePanel />)

    await selectRow('GST')

    fireEvent.change(screen.getByLabelText('Edit Tax Rate'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Rate must be 0\u2013100')).toBeInTheDocument()
  })

  it('saves edit via Enter key on code field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await selectRow('GST')

    const codeInput = screen.getByLabelText('Edit Tax Code Name')
    fireEvent.keyDown(codeInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateTaxCode).toHaveBeenCalled()
    })
  })

  it('saves edit via Enter key on rate field', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api

    render(<TaxCodePanel />)

    await selectRow('GST')

    const rateInput = screen.getByLabelText('Edit Tax Rate')
    fireEvent.keyDown(rateInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.updateTaxCode).toHaveBeenCalled()
    })
  })

  it('validates empty rate field', async () => {
    render(<TaxCodePanel />)

    await waitFor(() => {
      expect(screen.getByLabelText('Tax Code Name')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Tax Code Name'), { target: { value: 'PST' } })
    // Leave rate empty
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

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

  it('filters tax codes via bottom search bar', async () => {
    render(<TaxCodePanel />)

    await screen.findByText('GST')

    const searchInput = screen.getByLabelText('Search Tax Codes')
    fireEvent.change(searchInput, { target: { value: 'hst' } })

    expect(screen.queryByText('GST')).not.toBeInTheDocument()
    expect(screen.getByText('HST')).toBeInTheDocument()
  })

  it('shows no-match message when search yields no results', async () => {
    render(<TaxCodePanel />)

    await screen.findByText('GST')

    const searchInput = screen.getByLabelText('Search Tax Codes')
    fireEvent.change(searchInput, { target: { value: 'XYZ' } })

    expect(screen.getByText('No tax codes match your search.')).toBeInTheDocument()
  })

  it('refreshes edit form from backend data after save', async () => {
    render(<TaxCodePanel />)

    await selectRow('GST')

    fireEvent.change(screen.getByLabelText('Edit Tax Code Name'), {
      target: { value: 'GST-UPDATED' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Edit Tax Code Name')).toHaveValue('GST-UPDATED')
    })
    // Table should also reflect the change
    expect(screen.getByText('GST-UPDATED')).toBeInTheDocument()
  })
})
