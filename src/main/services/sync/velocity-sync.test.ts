import { describe, expect, it, vi } from 'vitest'
import { fetchVelocityBySku } from './velocity-sync'

describe('fetchVelocityBySku', () => {
  it('returns a SKU keyed velocity map from the RPC response', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { product_sku: 'SKU-1', velocity_per_day: 1.5 },
        { product_sku: 'SKU-2', velocity_per_day: '0.25' }
      ],
      error: null
    })

    const result = await fetchVelocityBySku({ rpc } as never, 'merchant-1', 30)

    expect(rpc).toHaveBeenCalledWith('merchant_product_velocity', {
      p_merchant_id: 'merchant-1',
      p_days: 30
    })
    expect(result).toEqual(
      new Map([
        ['SKU-1', 1.5],
        ['SKU-2', 0.25]
      ])
    )
  })

  it('returns null when the RPC fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } })

    await expect(fetchVelocityBySku({ rpc } as never, 'merchant-1', 30)).resolves.toBeNull()
  })
})
