import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  getDeviceConfig,
  getInventoryProductDetail,
  getInventoryProducts,
  getInventoryTaxCodes,
  getPendingItems,
  initializeDatabase,
  markDone,
  saveInventoryItem
} from '../src/main/database'
import {
  getMerchantCloudId,
  getSupabaseClient,
  initializeSupabaseService
} from '../src/main/services/supabase'
import { uploadProduct } from '../src/main/services/sync/product-sync'

async function main(): Promise<void> {
  const userDataPath = join(homedir(), 'Library/Application Support/liquor-pos')

  initializeDatabase(userDataPath)
  initializeSupabaseService(userDataPath)

  const merchantId = await getMerchantCloudId()
  if (!merchantId) {
    throw new Error('No merchant cloud id found. Sign into the app first.')
  }

  const device = getDeviceConfig()
  if (!device) {
    throw new Error('No local device config found. Register the device in the app first.')
  }

  const firstProduct = getInventoryProducts()[0]
  if (!firstProduct) {
    throw new Error('No local inventory products found to verify product sync.')
  }

  const detail = getInventoryProductDetail(firstProduct.item_number)
  if (!detail) {
    throw new Error('Failed to load local inventory product detail.')
  }

  const validTaxRates = new Set(getInventoryTaxCodes().map((taxCode) => Number(taxCode.rate)))
  const taxRates = detail.tax_rates.filter((taxRate) => validTaxRates.has(Number(taxRate)))

  const saved = saveInventoryItem({
    item_number: detail.item_number,
    sku: detail.sku,
    item_name: detail.item_name,
    distributor_number: detail.distributor_number,
    cost: detail.cost,
    retail_price: detail.retail_price,
    in_stock: detail.in_stock,
    tax_rates: taxRates,
    special_pricing: detail.special_pricing,
    additional_skus: detail.additional_skus,
    bottles_per_case: detail.bottles_per_case,
    case_discount_price: detail.case_discount_price,
    item_type: detail.item_type ?? '',
    size: detail.size ?? '',
    case_cost: detail.case_cost,
    nysla_discounts: detail.nysla_discounts,
    brand_name: detail.brand_name ?? '',
    proof: detail.proof,
    alcohol_pct: detail.alcohol_pct,
    vintage: detail.vintage ?? '',
    ttb_id: detail.ttb_id ?? '',
    display_name: detail.display_name ?? ''
  })

  const pending = getPendingItems(50)
  const productQueueItem = [...pending]
    .reverse()
    .find((item) => item.entity_type === 'product' && item.entity_id === String(saved.item_number))

  if (!productQueueItem) {
    throw new Error('No product sync queue item was generated for the smoke test.')
  }

  const supabase = getSupabaseClient()
  await uploadProduct(supabase, merchantId, device.device_id, JSON.parse(productQueueItem.payload))
  markDone([productQueueItem.id])

  const { data, error } = await supabase
    .from('merchant_products')
    .select('sku, merchant_id, updated_at')
    .eq('merchant_id', merchantId)
    .eq('sku', saved.sku)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Remote merchant_products row not found after upload.')
  }

  console.log(
    JSON.stringify(
      {
        merchant_id: merchantId,
        device_id: device.device_id,
        item_number: saved.item_number,
        sku: saved.sku,
        remote_updated_at: data.updated_at
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
