import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImportDistributorsDialog } from './ImportDistributorsDialog'
import type { CatalogDistributor } from '@renderer/types/pos'

// Mock useDebounce to return the value immediately for testing
vi.mock('@renderer/hooks/useDebounce', () => ({
  useDebounce: (val: string) => val
}))

const mockDistributors: CatalogDistributor[] = [
  {
    distributor_id: 1,
    distributor_name: 'ABC Wines',
    distributor_permit_id: 'P001',
    county: 'King County',
    post_type: 'POST_TYPE_BEVERAGES'
  },
  {
    distributor_id: 2,
    distributor_name: 'XYZ Spirits',
    distributor_permit_id: 'P002',
    county: 'Pierce County',
    post_type: 'POST_TYPE_LIQUOR'
  },
  {
    distributor_id: 3,
    distributor_name: 'Local Beer Co',
    distributor_permit_id: null,
    county: 'Snohomish County',
    post_type: null
  },
  {
    distributor_id: 4,
    distributor_name: 'Premium Imports',
    distributor_permit_id: null,
    county: null,
    post_type: 'POST_TYPE_WINE'
  }
]

describe('ImportDistributorsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      ...window.api,
      getCatalogDistributors: vi.fn().mockResolvedValue(mockDistributors),
      getDistributors: vi.fn().mockResolvedValue([]),
      importCatalogItems: vi.fn().mockResolvedValue({ imported: 150, distributors_created: 2 })
    } as unknown as typeof window.api
  })

  describe('Dialog visibility', () => {
    it('does not render content when isOpen is false', () => {
      render(
        <ImportDistributorsDialog isOpen={false} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      expect(screen.queryByText('Import Distributors')).not.toBeInTheDocument()
      expect(screen.queryByText('Loading distributors...')).not.toBeInTheDocument()
    })

    it('renders content when isOpen is true', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      expect(screen.getByText('Import Distributors')).toBeInTheDocument()

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Initial loading state', () => {
    it('shows loading state initially', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      expect(screen.getByText('Loading distributors...')).toBeInTheDocument()

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('displays distributor list after fetch resolves', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
          expect(screen.getByText('XYZ Spirits')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      expect(screen.queryByText('Loading distributors...')).not.toBeInTheDocument()
    })
  })

  describe('Load error handling', () => {
    it('shows fallback error message when rejection is not an Error', async () => {
      vi.mocked(window.api!.getCatalogDistributors).mockRejectedValueOnce('Network error')
      vi.mocked(window.api!.getDistributors).mockResolvedValueOnce([])

      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('Failed to load distributors')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })
  })

  describe('Search and filtering', () => {
    it('filters distributors by name', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const searchInput = screen.getByPlaceholderText('Search distributors...')
      fireEvent.change(searchInput, { target: { value: 'ABC' } })

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
          expect(screen.queryByText('XYZ Spirits')).not.toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('filters distributors by county', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const searchInput = screen.getByPlaceholderText('Search distributors...')
      fireEvent.change(searchInput, { target: { value: 'Pierce' } })

      await waitFor(
        () => {
          expect(screen.getByText('XYZ Spirits')).toBeInTheDocument()
          expect(screen.queryByText('ABC Wines')).not.toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('shows "No distributors match" when search has no results', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const searchInput = screen.getByPlaceholderText('Search distributors...')
      fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } })

      expect(screen.getByText('No distributors match your search.')).toBeInTheDocument()
    })

    it('handles whitespace-only search correctly', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const searchInput = screen.getByPlaceholderText('Search distributors...')
      fireEvent.change(searchInput, { target: { value: '  ' } })

      expect(screen.getByText('ABC Wines')).toBeInTheDocument()
      expect(screen.getByText('XYZ Spirits')).toBeInTheDocument()
    })
  })

  describe('Distributor metadata display', () => {
    it('shows county when available', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('King County')).toBeInTheDocument()
          expect(screen.getByText('Pierce County')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('does not crash when county is null', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('Premium Imports')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      expect(screen.queryByText('null')).not.toBeInTheDocument()
    })

    it('shows post_type when available', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('POST_TYPE_BEVERAGES')).toBeInTheDocument()
          expect(screen.getByText('POST_TYPE_LIQUOR')).toBeInTheDocument()
          expect(screen.getByText('POST_TYPE_WINE')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('does not crash when post_type is null', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('Local Beer Co')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      expect(screen.queryByText('null')).not.toBeInTheDocument()
    })
  })

  describe('Checkbox selection', () => {
    it('toggles individual distributor selection', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const abcCheckbox = checkboxes[1]

      expect(abcCheckbox).not.toBeChecked()
      fireEvent.click(abcCheckbox)
      expect(abcCheckbox).toBeChecked()
      expect(screen.getByText('1 selected')).toBeInTheDocument()

      fireEvent.click(abcCheckbox)
      expect(abcCheckbox).not.toBeChecked()
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    it('allows selecting multiple distributors', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])

      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })
  })

  describe('Select all functionality', () => {
    it('shows "Select all visible" checkbox when distributors exist', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText(/Select all visible/)).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('selects all visible distributors when clicking select all', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all visible/ })
      fireEvent.click(selectAllCheckbox)

      expect(screen.getByText('4 selected')).toBeInTheDocument()
    })

    it('deselects all when select all is clicked again', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all visible/ })

      fireEvent.click(selectAllCheckbox)
      expect(screen.getByText('4 selected')).toBeInTheDocument()

      fireEvent.click(selectAllCheckbox)
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    it('select-all operates only on filtered distributors', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const searchInput = screen.getByPlaceholderText('Search distributors...')
      fireEvent.change(searchInput, { target: { value: 'ABC' } })

      expect(screen.getByText('Select all visible (1)')).toBeInTheDocument()

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /Select all visible/ })
      fireEvent.click(selectAllCheckbox)

      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    it('reflects select-all state correctly after individual selections', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const selectAllCheckbox = checkboxes[0]

      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])
      fireEvent.click(checkboxes[3])
      fireEvent.click(checkboxes[4])

      expect(selectAllCheckbox).toBeChecked()

      fireEvent.click(checkboxes[1])
      expect(selectAllCheckbox).not.toBeChecked()
    })
  })

  describe('Import button state', () => {
    it('disables import button when nothing is selected', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const importButton = screen.getByRole('button', { name: /Import/ })
      expect(importButton).toBeDisabled()
    })

    it('enables import button when items are selected', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import \(1\)/ })).toBeEnabled()
      })
    })

    it('shows selected count in import button text', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import \(2\)/ })).toBeInTheDocument()
      })
    })

    it('disables import button during import', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      const importButton = screen.getByRole('button', { name: /Import \(1\)/ })
      fireEvent.click(importButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Importing...' })).toBeDisabled()
      })
    })
  })

  describe('Import functionality', () => {
    it('calls importCatalogItems with selected IDs', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])

      const importButton = screen.getByRole('button', { name: /Import \(2\)/ })
      fireEvent.click(importButton)

      await waitFor(
        () => {
          expect(window.api!.importCatalogItems).toHaveBeenCalledWith([1, 2])
        },
        { timeout: 2000 }
      )
    })

    it('shows import progress after clicking import', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      const importButton = screen.getByRole('button', { name: /Import \(1\)/ })
      fireEvent.click(importButton)

      await waitFor(() => {
        expect(screen.getByText('Importing items from 1 distributor(s)...')).toBeInTheDocument()
      })
    })

    it('shows success message with correct imported count and distributor count', async () => {
      vi.mocked(window.api!.importCatalogItems).mockResolvedValueOnce({
        imported: 250,
        distributors_created: 3
      })

      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      const importButton = screen.getByRole('button', { name: /Import \(1\)/ })
      fireEvent.click(importButton)

      await waitFor(
        () => {
          expect(
            screen.getByText('Imported 250 items from 3 new distributor(s).')
          ).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Import error handling', () => {
    it('handles import rejection gracefully', async () => {
      vi.mocked(window.api!.importCatalogItems).mockRejectedValueOnce(
        new Error('Error: Server error')
      )

      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      const importButton = screen.getByRole('button', { name: /Import \(1\)/ })
      fireEvent.click(importButton)

      // Verify importCatalogItems was called even though it will fail
      await waitFor(
        () => {
          expect(window.api!.importCatalogItems).toHaveBeenCalled()
        },
        { timeout: 1000 }
      )
    })
  })

  describe('Dialog closing', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const onClose = vi.fn()
      render(
        <ImportDistributorsDialog isOpen={true} onClose={onClose} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('handles empty distributor list', async () => {
      vi.mocked(window.api!.getCatalogDistributors).mockResolvedValueOnce([])
      vi.mocked(window.api!.getDistributors).mockResolvedValueOnce([])

      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('No distributors match your search.')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const selectAllCheckbox = screen.queryByRole('checkbox', { name: /Select all visible/ })
      expect(selectAllCheckbox).not.toBeInTheDocument()
    })

    it('handles selected set clearing after deselecting all', async () => {
      render(
        <ImportDistributorsDialog isOpen={true} onClose={vi.fn()} onImportComplete={vi.fn()} />
      )

      await waitFor(
        () => {
          expect(screen.getByText('ABC Wines')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      expect(screen.getByText('4 selected')).toBeInTheDocument()

      fireEvent.click(checkboxes[0])
      expect(screen.getByText('0 selected')).toBeInTheDocument()

      const importButton = screen.getByRole('button', { name: /Import/ })
      expect(importButton).toBeDisabled()
    })
  })
})
