import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudInventoryDeltaPayload, InventoryDeltaSyncPayload } from './types'

export async function uploadInventoryDelta(
  supabase: SupabaseClient,
  merchantId: string,
  deviceId: string,
  payload: InventoryDeltaSyncPayload
): Promise<void> {
  const cloudDelta: CloudInventoryDeltaPayload = {
    merchant_id: merchantId,
    product_sku: payload.delta.product_sku,
    delta: payload.delta.delta,
    reason: payload.delta.reason,
    reference_id: payload.delta.reference_id,
    device_id: deviceId,
    created_at: payload.delta.created_at
  }

  const { error } = await supabase.from('inventory_deltas').insert(cloudDelta)

  if (error) {
    throw new Error(`Inventory delta upload failed: ${error.message}`)
  }
}
