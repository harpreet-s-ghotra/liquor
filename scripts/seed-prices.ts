/**
 * Seed retail prices on the current merchant's products for testing.
 *
 * Writes directly to the **local SQLite database** and enqueues matching
 * entries in the local `sync_queue`. The running POS's sync-worker drains the
 * queue and mirrors the changes up to Supabase `merchant_products` — the same
 * path a normal inventory save takes, so no cloud code is needed here and
 * `catalog_products` is never touched.
 *
 * Pricing: retail_price = cost / (1 - margin).  By default every product gets
 * an independent random margin in [0, 40]%.  Use --fixed <percent> to apply
 * the same margin to every product.
 *
 * Usage:
 *   npx tsx scripts/seed-prices.ts                   # random 0-40%
 *   npx tsx scripts/seed-prices.ts --fixed 40        # every product at 40%
 *   npx tsx scripts/seed-prices.ts --max 25          # random 0-25%
 *   npx tsx scripts/seed-prices.ts --only-unpriced   # skip products that already have a non-zero price
 *   npx tsx scripts/seed-prices.ts --no-sync         # local only, do not enqueue sync uploads
 *   npx tsx scripts/seed-prices.ts --dry-run         # preview without writing
 *
 * Notes:
 *  - The app must be closed or the sync-worker must be running for the
 *    enqueued items to actually upload to Supabase.
 *  - Cloud inventory (`merchant_products`) will be updated via the normal
 *    sync-worker path; this script never writes directly to Supabase.
 */

import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// ── CLI args ──

function readArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null
}

const fixedArg = readArg('--fixed')
const maxArg = readArg('--max')
const onlyUnpriced = process.argv.includes('--only-unpriced')
const dryRun = process.argv.includes('--dry-run')
const skipSync = process.argv.includes('--no-sync')

const MAX_MARGIN_PERCENT = maxArg != null ? Number.parseFloat(maxArg) : 40
const FIXED_MARGIN_PERCENT = fixedArg != null ? Number.parseFloat(fixedArg) : null

if (Number.isNaN(MAX_MARGIN_PERCENT) || MAX_MARGIN_PERCENT < 0 || MAX_MARGIN_PERCENT >= 100) {
  console.error('--max must be a number in [0, 100)')
  process.exit(1)
}
if (FIXED_MARGIN_PERCENT != null) {
  if (
    Number.isNaN(FIXED_MARGIN_PERCENT) ||
    FIXED_MARGIN_PERCENT < 0 ||
    FIXED_MARGIN_PERCENT >= 100
  ) {
    console.error('--fixed must be a number in [0, 100)')
    process.exit(1)
  }
}

// ── Local DB path ──

// Electron uses package.json "name" for its userData folder, not the project dir.
const APP_NAME = 'high-spirits-pos'
const LOCAL_APP_DIR =
  process.platform === 'win32'
    ? join(process.env['APPDATA'] ?? homedir(), APP_NAME)
    : join(homedir(), 'Library', 'Application Support', APP_NAME)

const LOCAL_DB_PATH = join(LOCAL_APP_DIR, 'data', 'liquor-pos.db')

if (!existsSync(LOCAL_DB_PATH)) {
  console.error(`Local DB not found at ${LOCAL_DB_PATH}`)
  console.error('Open the POS app at least once (and sign in) so the DB is created.')
  process.exit(1)
}

// ── Pricing ──

function pickMarginPercent(): number {
  if (FIXED_MARGIN_PERCENT != null) return FIXED_MARGIN_PERCENT
  return Math.random() * MAX_MARGIN_PERCENT
}

/**
 * Given a cost and a profit-margin percent, return the retail price rounded to
 * the nearest cent. Profit margin is accounting-style:
 *   margin = (price - cost) / price
 *   →  price = cost / (1 - margin)
 */
function priceFromMargin(cost: number, marginPercent: number): number {
  const margin = marginPercent / 100
  if (margin >= 1) return cost
  const price = cost / (1 - margin)
  return Math.round(price * 100) / 100
}

// ── Row types ──

type LocalProductRow = {
  id: number
  sku: string
  name: string
  cost: number | null
  price: number | null
  retail_price: number | null
  cloud_id: string | null
}

type DeviceConfigRow = {
  device_id: string
}

// ── Main ──

function main(): void {
  const strategy =
    FIXED_MARGIN_PERCENT != null
      ? `fixed margin ${FIXED_MARGIN_PERCENT}%`
      : `random margin 0–${MAX_MARGIN_PERCENT}%`
  console.log(
    `Seeding prices in local SQLite — ${strategy}${onlyUnpriced ? ' (only-unpriced)' : ''}${dryRun ? ' [DRY RUN]' : ''}`
  )
  console.log(`  local DB: ${LOCAL_DB_PATH}`)
  console.log()

  const db = new Database(LOCAL_DB_PATH)
  db.pragma('foreign_keys = ON')

  // Device id for sync_queue rows (same device_id the app would stamp).
  const device = db.prepare('SELECT device_id FROM device_config LIMIT 1').get() as
    | DeviceConfigRow
    | undefined
  if (!skipSync && !device) {
    console.warn(
      'Warning: no device_config row found. Cannot enqueue sync items. Pass --no-sync to suppress this.'
    )
  }

  const products = db
    .prepare(
      `SELECT id, sku, name, cost, price, retail_price, cloud_id
         FROM products
         WHERE is_active = 1
         ORDER BY sku`
    )
    .all() as LocalProductRow[]

  if (products.length === 0) {
    console.log('No active products in local DB. Nothing to do.')
    db.close()
    return
  }

  type Update = { id: number; sku: string; name: string; cost: number; price: number }
  const updates: Update[] = []
  let skippedNoCost = 0
  let skippedAlreadyPriced = 0

  for (const p of products) {
    const existingPrice = p.retail_price ?? p.price ?? 0
    if (onlyUnpriced && existingPrice > 0) {
      skippedAlreadyPriced++
      continue
    }
    const cost = p.cost ?? 0
    if (cost <= 0) {
      skippedNoCost++
      continue
    }
    const marginPercent = pickMarginPercent()
    const price = priceFromMargin(cost, marginPercent)
    updates.push({ id: p.id, sku: p.sku, name: p.name, cost, price })
  }

  console.log(
    `Products: total=${products.length}, will update=${updates.length}, skipped no-cost=${skippedNoCost}, skipped already-priced=${skippedAlreadyPriced}`
  )

  if (updates.length === 0) {
    db.close()
    return
  }

  console.log('Sample updates:')
  for (const u of updates.slice(0, 5)) {
    console.log(
      `  ${u.sku.padEnd(14)}  cost=$${u.cost.toFixed(2).padStart(7)}  →  price=$${u.price.toFixed(2).padStart(7)}  (${u.name.slice(0, 50)})`
    )
  }
  console.log()

  if (dryRun) {
    console.log(`[DRY RUN] would update ${updates.length} products. No changes written.`)
    db.close()
    return
  }

  // ── Apply ──

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const updateStmt = db.prepare(
    `UPDATE products
        SET price = @price,
            retail_price = @price,
            updated_at = @now,
            last_modified_by_device = @deviceId,
            synced_at = NULL
      WHERE id = @id`
  )

  // Build a full product-sync payload matching src/main/services/sync/types.ts
  // ProductSyncPayload. We replicate the SELECT used in getProductSyncPayload
  // so the sync-worker's uploadProduct treats our enqueued rows identically to
  // rows enqueued by the inventory save path.
  const buildPayloadStmt = db.prepare(
    `SELECT
        id, cloud_id, sku, name, description, category,
        price, cost,
        COALESCE(retail_price, price) AS retail_price,
        COALESCE(in_stock, quantity, 0) AS in_stock,
        tax_1, tax_2, distributor_number,
        COALESCE(bottles_per_case, 12) AS bottles_per_case,
        case_discount_price, special_pricing_enabled, special_price,
        barcode, is_active, item_type, size, case_cost,
        brand_name, proof, alcohol_pct, vintage, ttb_id,
        updated_at
     FROM products WHERE id = ? LIMIT 1`
  )
  const altSkusStmt = db.prepare(
    `SELECT alt_sku FROM product_alt_skus WHERE product_id = ? ORDER BY alt_sku`
  )
  const specialPricingStmt = db.prepare(
    `SELECT quantity, price, duration_days FROM special_pricing WHERE product_id = ? ORDER BY quantity`
  )
  const enqueueStmt = db.prepare(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, device_id)
     VALUES ('product', ?, 'UPDATE', ?, ?)`
  )

  const deviceId = device?.device_id ?? ''

  const tx = db.transaction((rows: Update[]) => {
    for (const r of rows) {
      updateStmt.run({ id: r.id, price: r.price, now, deviceId })
      if (!skipSync && deviceId) {
        const product = buildPayloadStmt.get(r.id) as Record<string, unknown>
        const alt_skus = (altSkusStmt.all(r.id) as { alt_sku: string }[]).map((x) => x.alt_sku)
        const special_pricing = specialPricingStmt.all(r.id)
        enqueueStmt.run(
          String(r.id),
          JSON.stringify({ product, alt_skus, special_pricing }),
          deviceId
        )
      }
    }
  })
  tx(updates)

  console.log(`Updated ${updates.length} products locally.`)
  if (!skipSync && deviceId) {
    console.log(
      `Enqueued ${updates.length} sync_queue items. Next time the POS runs online, the sync-worker will push these to Supabase merchant_products.`
    )
  } else if (skipSync) {
    console.log('--no-sync passed — sync_queue not touched. Changes stay local.')
  }

  db.close()
}

try {
  main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
