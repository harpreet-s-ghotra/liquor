import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDeviceConfig: vi.fn(),
  reconcileSettings: vi.fn(),
  reconcileTaxCodes: vi.fn(),
  reconcileDistributors: vi.fn(),
  reconcileItemTypes: vi.fn(),
  reconcileDepartments: vi.fn(),
  reconcileCashiers: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  prepare: vi.fn()
}))

vi.mock('../../database/connection', () => ({
  getDb: () => ({ prepare: mocks.prepare }),
  getActiveMerchantAccountId: () => 'merchant-1'
}))

vi.mock('../../database/device-config.repo', () => ({
  getDeviceConfig: mocks.getDeviceConfig
}))

vi.mock('./settings-sync', () => ({
  reconcileSettings: mocks.reconcileSettings
}))

vi.mock('./tax-code-sync', () => ({
  reconcileTaxCodes: mocks.reconcileTaxCodes
}))

vi.mock('./distributor-sync', () => ({
  reconcileDistributors: mocks.reconcileDistributors
}))

vi.mock('./item-type-sync', () => ({
  reconcileItemTypes: mocks.reconcileItemTypes
}))

vi.mock('./department-sync', () => ({
  reconcileDepartments: mocks.reconcileDepartments
}))

vi.mock('./cashier-sync', () => ({
  reconcileCashiers: mocks.reconcileCashiers
}))

import { getInitialSyncStatus, runInitialSync } from './initial-sync'

describe('runInitialSync', () => {
  beforeEach(() => {
    mocks.getDeviceConfig.mockReset()
    mocks.reconcileSettings.mockReset()
    mocks.reconcileTaxCodes.mockReset()
    mocks.reconcileDistributors.mockReset()
    mocks.reconcileItemTypes.mockReset()
    mocks.reconcileDepartments.mockReset()
    mocks.reconcileCashiers.mockReset()
    mocks.prepare.mockReset()
    mocks.get.mockReset()
    mocks.all.mockReset()
    mocks.run.mockReset()

    mocks.prepare.mockImplementation(() => ({ get: mocks.get, all: mocks.all, run: mocks.run }))
    mocks.getDeviceConfig.mockReturnValue({ device_id: 'device-1' })
    mocks.reconcileSettings.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.reconcileTaxCodes.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.reconcileDistributors.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.reconcileItemTypes.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.reconcileDepartments.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.reconcileCashiers.mockResolvedValue({ applied: 1, uploaded: 0, errors: [] })
    mocks.all.mockReturnValue([])
    mocks.get.mockReturnValue(undefined)
  })

  it('completes initial sync without a transactions phase', async () => {
    const countBuilder = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ count: 0, error: null })
    }
    const pageBuilder = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    }
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) =>
          options?.head ? countBuilder : pageBuilder
        )
      }))
    }

    await runInitialSync(supabase as never, 'merchant-1')

    expect(countBuilder.gt).toHaveBeenCalledWith('retail_price', 0)
    expect(getInitialSyncStatus().progress.products).toEqual({ processed: 0, total: 0 })
    expect(getInitialSyncStatus().completed).toEqual([
      'settings',
      'tax_codes',
      'distributors',
      'item_types',
      'departments',
      'cashiers',
      'products'
    ])
  })
})
