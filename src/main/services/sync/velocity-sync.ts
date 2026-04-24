import type { SupabaseClient } from '@supabase/supabase-js'

type VelocityRow = {
  product_sku: string
  velocity_per_day: number | string | null
}

export async function fetchVelocityBySku(
  supabase: SupabaseClient,
  merchantId: string,
  days: number
): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.rpc('merchant_product_velocity', {
    p_merchant_id: merchantId,
    p_days: days
  })

  if (error) {
    return null
  }

  return new Map(
    ((data ?? []) as VelocityRow[]).map((row) => [
      String(row.product_sku),
      Number(row.velocity_per_day ?? 0)
    ])
  )
}
