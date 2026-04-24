import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SyncProgressModal } from './SyncProgressModal'

vi.mock('../../hooks/useInitialSyncStatus', () => ({
  useInitialSyncStatus: vi.fn()
}))

import { useInitialSyncStatus } from '../../hooks/useInitialSyncStatus'

describe('SyncProgressModal', () => {
  it('renders active entity progress counts and percent', () => {
    vi.mocked(useInitialSyncStatus).mockReturnValue({
      state: 'running',
      currentEntity: 'products',
      progress: { products: { processed: 120, total: 500 } },
      completed: ['settings', 'tax_codes'],
      errors: []
    })

    render(<SyncProgressModal onComplete={vi.fn()} onContinueOffline={vi.fn()} />)

    expect(screen.getByText('120 / 500 · 24%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '120')
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '500')
  })
})
