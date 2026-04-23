import { vi } from 'vitest'

vi.mock('@renderer/lib/logger', () => ({
  scoped: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataHistoryPanel } from './DataHistoryPanel'
import type {
  LocalTransactionHistoryStats,
  TransactionBackfillStatus
} from '../../../../../shared/types'

const mockStats: LocalTransactionHistoryStats = {
  count: 12,
  earliest: '2026-01-01T00:00:00.000Z',
  latest: '2026-02-01T00:00:00.000Z'
}

const mockBackfill: TransactionBackfillStatus = {
  state: 'idle',
  days: 365,
  applied: 0,
  skipped: 0,
  errors: 0,
  lastError: null,
  startedAt: null,
  finishedAt: null
}

describe('DataHistoryPanel', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).api = {
      getLocalHistoryStats: vi.fn().mockResolvedValue(mockStats),
      getBackfillStatus: vi.fn().mockResolvedValue(mockBackfill),
      triggerBackfill: vi.fn().mockResolvedValue({ started: true, days: 365 }),
      onBackfillStatusChanged: vi.fn().mockReturnValue(vi.fn())
    }
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).api
    vi.clearAllMocks()
  })

  it('cleans up the backfill status listener on unmount', async () => {
    const dispose = vi.fn()
    window.api!.onBackfillStatusChanged = vi.fn().mockReturnValue(dispose)

    const { unmount } = render(<DataHistoryPanel />)

    await waitFor(() => {
      expect(window.api!.onBackfillStatusChanged).toHaveBeenCalled()
    })

    unmount()

    expect(dispose).toHaveBeenCalled()
  })
})
