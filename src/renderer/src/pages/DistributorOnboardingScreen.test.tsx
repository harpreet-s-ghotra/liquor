import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DistributorOnboardingScreen } from './DistributorOnboardingScreen'
import { useAuthStore, type AppState } from '../store/useAuthStore'
import type { CatalogDistributor } from '../../../shared/types'

// ── Mock window.api ──

const mockGetCatalogDistributors = vi.fn()
const mockImportCatalogItems = vi.fn()
const mockCompleteOnboarding = vi.fn()

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = {
    getCatalogDistributors: mockGetCatalogDistributors,
    importCatalogItems: mockImportCatalogItems
  }

  useAuthStore.setState({
    appState: 'distributor-onboarding' as AppState,
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null
  })

  mockGetCatalogDistributors.mockReset()
  mockImportCatalogItems.mockReset()
  mockCompleteOnboarding.mockReset()

  useAuthStore.setState({ completeOnboarding: mockCompleteOnboarding } as unknown as Partial<
    ReturnType<typeof useAuthStore.getState>
  >)
})

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).api
  vi.restoreAllMocks()
})

const mockDistributors: CatalogDistributor[] = [
  {
    distributor_id: 1,
    distributor_name: 'Premium Spirits Inc',
    distributor_permit_id: 'PERMIT-001',
    county: 'New York County',
    post_type: 'Wholesaler'
  },
  {
    distributor_id: 2,
    distributor_name: 'Classic Wine Distributors',
    distributor_permit_id: 'PERMIT-002',
    county: 'Kings County',
    post_type: 'Supplier'
  },
  {
    distributor_id: 3,
    distributor_name: 'Local Craft Beverages',
    distributor_permit_id: 'PERMIT-003',
    county: 'New York County',
    post_type: 'Producer'
  }
]

describe('DistributorOnboardingScreen', () => {
  it('shows loading state initially', () => {
    mockGetCatalogDistributors.mockImplementation(() => new Promise(() => {}))
    render(<DistributorOnboardingScreen />)

    expect(screen.getByText('Loading distributors...')).toBeInTheDocument()
  })

  it('displays distributor list after loading', async () => {
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
      expect(screen.getByText('Classic Wine Distributors')).toBeInTheDocument()
      expect(screen.getByText('Local Craft Beverages')).toBeInTheDocument()
    })
  })

  it('shows county and post_type in distributor rows', async () => {
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getAllByText('New York County')).toHaveLength(2)
      expect(screen.getByText('Kings County')).toBeInTheDocument()
      expect(screen.getByText('Wholesaler')).toBeInTheDocument()
      expect(screen.getByText('Supplier')).toBeInTheDocument()
      expect(screen.getByText('Producer')).toBeInTheDocument()
    })
  })

  it('shows empty state when no distributors returned', async () => {
    mockGetCatalogDistributors.mockResolvedValue([])
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('No distributors match your search.')).toBeInTheDocument()
    })
  })

  it('shows load error when getCatalogDistributors fails', async () => {
    mockGetCatalogDistributors.mockRejectedValue(new Error('Failed to fetch distributors'))
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch distributors')).toBeInTheDocument()
    })
  })

  it('handles non-Error rejection gracefully', async () => {
    mockGetCatalogDistributors.mockRejectedValue('Unknown error')
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load distributors')).toBeInTheDocument()
    })
  })

  it('disables Import button when no distributor is selected', async () => {
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const importButton = screen.getByRole('button', { name: /import/i })
    expect(importButton).toBeDisabled()
  })

  it('enables Import button when a distributor is selected', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // First distributor (skip "Select all")

    const importButton = screen.getByRole('button', { name: /import/i })
    expect(importButton).not.toBeDisabled()
  })

  it('shows selected count in Import button', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // First distributor

    expect(screen.getByRole('button', { name: /import \(1\)/i })).toBeInTheDocument()
  })

  it('toggles individual distributor selection', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    const firstDistributorCheckbox = checkboxes[1]

    expect(firstDistributorCheckbox).not.toBeChecked()
    await user.click(firstDistributorCheckbox)
    expect(firstDistributorCheckbox).toBeChecked()
    await user.click(firstDistributorCheckbox)
    expect(firstDistributorCheckbox).not.toBeChecked()
  })

  it('allows selecting multiple distributors', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // First distributor
    await user.click(checkboxes[2]) // Second distributor

    expect(screen.getByRole('button', { name: /import \(2\)/i })).toBeInTheDocument()
  })

  it('toggles Select all checkbox to check all visible distributors', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all visible/i })
    await user.click(selectAllCheckbox)

    expect(screen.getByRole('button', { name: /import \(3\)/i })).toBeInTheDocument()
  })

  it('unchecks Select all when deselecting a distributor', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all visible/i })
    await user.click(selectAllCheckbox)

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // Deselect first distributor

    expect(selectAllCheckbox).not.toBeChecked()
  })

  it('checks Select all when all are selected individually', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])
    await user.click(checkboxes[3])

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all visible/i })
    expect(selectAllCheckbox).toBeChecked()
  })

  it('filters distributors by search term', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search distributors...')
    await user.type(searchInput, 'Premium')

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
      expect(screen.queryByText('Classic Wine Distributors')).not.toBeInTheDocument()
    })
  })

  it('filters distributors by county', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search distributors...')
    await user.type(searchInput, 'Kings County')

    await waitFor(() => {
      expect(screen.queryByText('Premium Spirits Inc')).not.toBeInTheDocument()
      expect(screen.getByText('Classic Wine Distributors')).toBeInTheDocument()
    })
  })

  it('shows no results when search matches nothing', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search distributors...')
    await user.type(searchInput, 'NonExistent')

    await waitFor(() => {
      expect(screen.getByText('No distributors match your search.')).toBeInTheDocument()
    })
  })

  it('clears search results when clearing search input', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search distributors...')
    await user.type(searchInput, 'Premium')

    await waitFor(() => {
      expect(screen.queryByText('Classic Wine Distributors')).not.toBeInTheDocument()
    })

    await user.clear(searchInput)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
      expect(screen.getByText('Classic Wine Distributors')).toBeInTheDocument()
    })
  })

  it('calls importCatalogItems with selected IDs on import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockResolvedValue({
      imported: 150,
      distributors_created: 2
    })

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // First distributor (id: 1)
    await user.click(checkboxes[2]) // Second distributor (id: 2)

    const importButton = screen.getByRole('button', { name: /import \(2\)/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(mockImportCatalogItems).toHaveBeenCalledWith([1, 2])
    })
  })

  it('shows success progress message during import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockImplementation(() => new Promise(() => {}))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText(/importing items from 1 distributor/i)).toBeInTheDocument()
    })
  })

  it('shows loading state on Import button during import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockImplementation(() => new Promise(() => {}))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled()
    })
  })

  it('disables checkboxes during import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockImplementation(() => new Promise(() => {}))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeDisabled()
      })
    })
  })

  it('disables search input during import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockImplementation(() => new Promise(() => {}))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search distributors...')).toBeDisabled()
    })
  })

  it('shows success message after successful import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockResolvedValue({
      imported: 150,
      distributors_created: 2
    })

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText(/imported 150 items from 2 new distributor/i)).toBeInTheDocument()
    })
  })

  it('calls completeOnboarding after successful import with delay', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockResolvedValue({
      imported: 150,
      distributors_created: 2
    })

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(mockImportCatalogItems).toHaveBeenCalled()
    })

    // Wait for the success message to appear and completeOnboarding to be called
    await waitFor(
      () => {
        expect(mockCompleteOnboarding).toHaveBeenCalled()
      },
      { timeout: 3000 }
    )
  })

  it('shows error message when import fails', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockRejectedValue(new Error('Import failed due to network error'))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText('Import failed due to network error')).toBeInTheDocument()
    })
  })

  it('handles generic error when import fails with non-Error', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockRejectedValue('Unknown error')

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument()
    })
  })

  it('re-enables UI after import error', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockRejectedValue(new Error('Import failed'))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument()
    })

    // UI should be re-enabled
    expect(importButton).not.toBeDisabled()
    expect(screen.getByPlaceholderText('Search distributors...')).not.toBeDisabled()
    checkboxes.forEach((checkbox) => {
      expect(checkbox).not.toBeDisabled()
    })
  })

  it('calls completeOnboarding when Skip button is clicked', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const skipButton = screen.getByRole('button', { name: /skip/i })
    await user.click(skipButton)

    expect(mockCompleteOnboarding).toHaveBeenCalled()
  })

  it('disables Skip button during import', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)
    mockImportCatalogItems.mockImplementation(() => new Promise(() => {}))

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    const importButton = screen.getByRole('button', { name: /import/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /skip/i })).toBeDisabled()
    })
  })

  it('shows selected count badge', async () => {
    const user = userEvent.setup()
    mockGetCatalogDistributors.mockResolvedValue(mockDistributors)

    render(<DistributorOnboardingScreen />)

    await waitFor(() => {
      expect(screen.getByText('Premium Spirits Inc')).toBeInTheDocument()
    })

    expect(screen.getByText('0 selected')).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])

    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })
})
