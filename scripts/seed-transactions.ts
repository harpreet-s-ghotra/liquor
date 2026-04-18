/**
 * Seed fake completed transactions for sales-report testing.
 *
 * Generates realistic-looking sales history into the local SQLite database
 * (and, by default, enqueues sync_queue entries so the running POS mirrors
 * them up to `merchant_transactions` via the normal sync-worker path).
 *
 * Defaults: 120 days of history, 180–200 transactions per day, 1–8 line
 * items per transaction, 1–3 units per line, payment split ~30% cash /
 * 55% credit / 15% debit. No refunds — only completed sales.
 *
 * Usage:
 *   npm run seed:tx                                         # 120 days, default volume
 *   npm run seed:tx -- --days 30                            # only last 30 days
 *   npm run seed:tx -- --min 100 --max 120                  # lighter volume
 *   npm run seed:tx -- --no-sync                            # local only, no cloud mirror
 *   npm run seed:tx -- --dry-run                            # print the plan, no writes
 *   npm run seed:tx -- --clear-seeded                       # wipe prior seed-generated transactions first
 *   npm run seed:tx -- --top-up-stock 500                    # set every product's in_stock to max(current, 500) before seeding
 *   npm run seed:tx -- --no-stock-decrement                  # don't decrement stock as sales happen
 *
 * Notes:
 *  - Only products with retail_price > 0 are used. Run `npm run seed:prices` first if needed.
 *  - Each seeded sale decrements products.in_stock (floored at 0), so inventory
 *    reports reflect the seeded activity. Use --top-up-stock to avoid running dry.
 *  - We intentionally do NOT write inventory_deltas rows for seeds. The real
 *    cloud `trg_apply_inventory_delta` trigger would double-count stock if we
 *    synced these. Local stock is correct; cloud stock stays at whatever the
 *    app last uploaded via merchant_products.
 *  - session_id is always NULL for historical seeds (sessions are register-local
 *    and never backfilled, matching real restore-on-new-machine behaviour).
 *  - Every seeded transaction is marked with a recognisable transaction_number
 *    prefix (`SEED-`) and `notes = 'seed'` so --clear-seeded can find them.
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

function readIntArg(flag: string, fallback: number): number {
  const raw = readArg(flag)
  if (raw == null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    console.error(`${flag} must be a non-negative integer`)
    process.exit(1)
  }
  return parsed
}

const DAYS = readIntArg('--days', 120)
const TX_MIN = readIntArg('--min', 180)
const TX_MAX = readIntArg('--max', 200)
const dryRun = process.argv.includes('--dry-run')
const skipSync = process.argv.includes('--no-sync')
const clearSeeded = process.argv.includes('--clear-seeded')
const noStockDecrement = process.argv.includes('--no-stock-decrement')
const topUpStock = (() => {
  const raw = readArg('--top-up-stock')
  if (raw == null) return null
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 0) {
    console.error('--top-up-stock must be a non-negative integer')
    process.exit(1)
  }
  return n
})()

if (TX_MAX < TX_MIN) {
  console.error('--max must be >= --min')
  process.exit(1)
}

// ── Paths ──

const APP_NAME = 'high-spirits-pos'
const LOCAL_APP_DIR =
  process.platform === 'win32'
    ? join(process.env['APPDATA'] ?? homedir(), APP_NAME)
    : join(homedir(), 'Library', 'Application Support', APP_NAME)

const LOCAL_DB_PATH = join(LOCAL_APP_DIR, 'data', 'liquor-pos.db')

if (!existsSync(LOCAL_DB_PATH)) {
  console.error(`Local DB not found at ${LOCAL_DB_PATH}`)
  process.exit(1)
}

// ── Random helpers ──

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 1 unit most of the time, occasionally 2-3. */
function randQuantity(): number {
  const r = Math.random()
  if (r < 0.78) return 1
  if (r < 0.94) return 2
  return 3
}

/** Weighted line-item count: peak at 2-4, tail out to 8. */
function randItemCount(): number {
  const weights = [0, 2, 5, 4, 3, 2, 1, 1, 1] // index = count
  const total = weights.reduce((a, b) => a + b, 0)
  let pick = Math.random() * total
  for (let i = 1; i < weights.length; i++) {
    pick -= weights[i]
    if (pick <= 0) return i
  }
  return 2
}

/** Payment-method split: 30% cash, 55% credit, 15% debit. */
function randPaymentMethod(): 'cash' | 'credit' | 'debit' {
  const r = Math.random()
  if (r < 0.3) return 'cash'
  if (r < 0.85) return 'credit'
  return 'debit'
}

function randCardType(): string {
  return randChoice(['visa', 'mastercard', 'amex', 'discover'])
}

function randFinixId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 20; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}_${s}`
}

/** Random time of day skewed toward afternoons/evenings (when liquor stores get busy). */
function randBusinessTime(dateMidnight: Date): Date {
  // 10 AM to 10 PM window = 12 hours. Peak around 5–8 PM.
  const hourWeights: number[] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 4, 5, 6, 6, 5, 3, 2, 1, 0
  ]
  const total = hourWeights.reduce((a, b) => a + b, 0)
  let pick = Math.random() * total
  let hour = 18
  for (let i = 0; i < 24; i++) {
    pick -= hourWeights[i]
    if (pick <= 0) {
      hour = i
      break
    }
  }
  const minute = randInt(0, 59)
  const second = randInt(0, 59)
  const d = new Date(dateMidnight)
  d.setHours(hour, minute, second, 0)
  return d
}

function toSqliteDateTime(d: Date): string {
  // "YYYY-MM-DD HH:MM:SS" in local time (matches CURRENT_TIMESTAMP convention).
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ── Types ──

type ProductRow = {
  id: number
  sku: string
  name: string
  retail_price: number | null
  price: number | null
  cost: number | null
  tax_1: number | null
}

type DeviceConfigRow = { device_id: string }

// ── Main ──

function main(): void {
  console.log(
    `Seeding transactions — ${DAYS} days × ${TX_MIN}–${TX_MAX} per day${dryRun ? ' [DRY RUN]' : ''}`
  )
  console.log(`  local DB: ${LOCAL_DB_PATH}`)
  console.log()

  const db = new Database(LOCAL_DB_PATH)
  db.pragma('foreign_keys = ON')

  const device = db.prepare('SELECT device_id FROM device_config LIMIT 1').get() as
    | DeviceConfigRow
    | undefined
  if (!skipSync && !device) {
    console.warn('Warning: no device_config row. Cannot enqueue sync. Continuing without sync.')
  }
  const deviceId = device?.device_id ?? ''

  // Default tax rate — prefer the one flagged as default, else 0.
  const defaultTaxRow = db
    .prepare('SELECT rate FROM tax_codes WHERE is_default = 1 LIMIT 1')
    .get() as { rate: number } | undefined
  const defaultTaxRate = defaultTaxRow?.rate ?? 0

  // Load sellable products.
  const products = db
    .prepare(
      `SELECT id, sku, name,
              retail_price, price, cost, tax_1
         FROM products
        WHERE is_active = 1
          AND max(COALESCE(retail_price, 0), COALESCE(price, 0)) > 0`
    )
    .all() as ProductRow[]

  if (products.length === 0) {
    console.error('No priced, active products found. Run `npm run seed:prices` first.')
    db.close()
    process.exit(1)
  }
  console.log(`Available products: ${products.length}`)

  // Clear prior seeds if requested.
  if (clearSeeded && !dryRun) {
    const delItems = db
      .prepare(
        `DELETE FROM transaction_items
           WHERE transaction_id IN (
             SELECT id FROM transactions WHERE transaction_number LIKE 'SEED-%'
           )`
      )
      .run()
    const delTx = db
      .prepare(`DELETE FROM transactions WHERE transaction_number LIKE 'SEED-%'`)
      .run()
    const delQueue = db
      .prepare(
        `DELETE FROM sync_queue WHERE entity_type = 'transaction' AND entity_id LIKE 'SEED-%'`
      )
      .run()
    console.log(
      `Cleared prior seeds: ${delTx.changes} transactions, ${delItems.changes} line items, ${delQueue.changes} sync_queue rows`
    )
  }

  // ── Plan ──

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  type SeedTx = {
    txNumber: string
    createdAt: string
    subtotal: number
    tax: number
    total: number
    paymentMethod: 'cash' | 'credit' | 'debit'
    finixAuth: string | null
    finixTransfer: string | null
    cardLast4: string | null
    cardType: string | null
    items: Array<{
      productId: number
      sku: string
      name: string
      unitPrice: number
      quantity: number
      totalPrice: number
      costAtSale: number | null
    }>
  }

  const plan: SeedTx[] = []
  let txCounter = 0

  for (let d = DAYS; d >= 1; d--) {
    const dayDate = new Date(today)
    dayDate.setDate(dayDate.getDate() - d)
    const daySeq = Math.floor(dayDate.getTime() / 1000)
    const txCount = randInt(TX_MIN, TX_MAX)

    for (let i = 0; i < txCount; i++) {
      const when = randBusinessTime(dayDate)
      const itemCount = randItemCount()

      // Sample distinct products for this transaction.
      const picks: ProductRow[] = []
      const seen = new Set<number>()
      let guard = 0
      while (picks.length < itemCount && guard < itemCount * 5) {
        guard++
        const p = randChoice(products)
        if (seen.has(p.id)) continue
        seen.add(p.id)
        picks.push(p)
      }

      let subtotal = 0
      let tax = 0
      const items: SeedTx['items'] = []
      for (const p of picks) {
        const unitPrice = p.retail_price ?? p.price ?? 0
        if (unitPrice <= 0) continue
        const qty = randQuantity()
        const lineTotal = Math.round(unitPrice * qty * 100) / 100
        const lineTax = Math.round(lineTotal * (p.tax_1 ?? defaultTaxRate) * 100) / 100
        subtotal += lineTotal
        tax += lineTax
        items.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          unitPrice,
          quantity: qty,
          totalPrice: lineTotal,
          costAtSale: p.cost ?? null
        })
      }
      if (items.length === 0) continue

      subtotal = Math.round(subtotal * 100) / 100
      tax = Math.round(tax * 100) / 100
      const total = Math.round((subtotal + tax) * 100) / 100

      const paymentMethod = randPaymentMethod()
      const isCard = paymentMethod === 'credit' || paymentMethod === 'debit'

      txCounter++
      plan.push({
        txNumber: `SEED-${daySeq}-${String(i).padStart(4, '0')}`,
        createdAt: toSqliteDateTime(when),
        subtotal,
        tax,
        total,
        paymentMethod,
        finixAuth: isCard ? randFinixId('AU') : null,
        finixTransfer: isCard ? randFinixId('TR') : null,
        cardLast4: isCard ? String(randInt(1000, 9999)) : null,
        cardType: isCard ? randCardType() : null,
        items
      })
    }
  }

  console.log(
    `Planned: ${plan.length} transactions, ${plan.reduce((s, t) => s + t.items.length, 0)} line items`
  )
  // Quick distribution summary
  const paymentCounts: Record<string, number> = { cash: 0, credit: 0, debit: 0 }
  for (const t of plan) paymentCounts[t.paymentMethod]++
  console.log(
    `  payment split: cash=${paymentCounts.cash}, credit=${paymentCounts.credit}, debit=${paymentCounts.debit}`
  )
  const grossSales = plan.reduce((s, t) => s + t.total, 0)
  console.log(`  total gross sales: $${grossSales.toFixed(2)}`)

  // Summarise per-product sold quantities so the top-up step can guarantee
  // stock stays non-zero.
  const totalSoldBySku: Map<number, number> = new Map()
  for (const t of plan) {
    for (const item of t.items) {
      totalSoldBySku.set(item.productId, (totalSoldBySku.get(item.productId) ?? 0) + item.quantity)
    }
  }
  const maxSold = Math.max(0, ...Array.from(totalSoldBySku.values()))
  console.log(`  stock: max units sold for any one SKU = ${maxSold}`)

  if (dryRun) {
    console.log('\n[DRY RUN] no rows written.')
    db.close()
    return
  }
  if (plan.length === 0) {
    db.close()
    return
  }

  // ── Top up stock first ──

  if (topUpStock != null) {
    const topUp = db
      .prepare(
        `UPDATE products
            SET in_stock = max(COALESCE(in_stock, 0), ?),
                quantity = max(COALESCE(quantity, 0), ?),
                updated_at = CURRENT_TIMESTAMP
          WHERE is_active = 1`
      )
      .run(topUpStock, topUpStock)
    console.log(
      `Topped up stock on ${topUp.changes} products to at least ${topUpStock} units each.`
    )
  }

  // ── Apply ──

  const insertTx = db.prepare(
    `INSERT INTO transactions (
       transaction_number, subtotal, tax_amount, total,
       payment_method, finix_authorization_id, finix_transfer_id,
       card_last_four, card_type, status, notes, session_id, created_at
     ) VALUES (
       @txNumber, @subtotal, @tax, @total,
       @paymentMethod, @finixAuth, @finixTransfer,
       @cardLast4, @cardType, 'completed', 'seed', NULL, @createdAt
     )`
  )
  const insertItem = db.prepare(
    `INSERT INTO transaction_items (
       transaction_id, product_id, product_name, quantity, unit_price,
       cost_at_sale, cost_basis_source, total_price
     ) VALUES (?, ?, ?, ?, ?, ?, 'legacy_baseline', ?)`
  )
  const enqueueStmt = db.prepare(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, device_id)
     VALUES ('transaction', ?, 'INSERT', ?, ?)`
  )
  const decrementStock = db.prepare(
    `UPDATE products
        SET in_stock = max(0, COALESCE(in_stock, quantity, 0) - ?),
            quantity = max(0, COALESCE(quantity, in_stock, 0) - ?)
      WHERE id = ?`
  )

  const shouldEnqueue = !skipSync && !!deviceId

  const tx = db.transaction((rows: SeedTx[]) => {
    for (const r of rows) {
      const info = insertTx.run({
        txNumber: r.txNumber,
        subtotal: r.subtotal,
        tax: r.tax,
        total: r.total,
        paymentMethod: r.paymentMethod,
        finixAuth: r.finixAuth,
        finixTransfer: r.finixTransfer,
        cardLast4: r.cardLast4,
        cardType: r.cardType,
        createdAt: r.createdAt
      })
      const localTxId = Number(info.lastInsertRowid)

      for (const item of r.items) {
        insertItem.run(
          localTxId,
          item.productId,
          item.name,
          item.quantity,
          item.unitPrice,
          item.costAtSale,
          item.totalPrice
        )
        if (!noStockDecrement) {
          decrementStock.run(item.quantity, item.quantity, item.productId)
        }
      }

      if (shouldEnqueue) {
        const payload = {
          transaction: {
            id: localTxId,
            transaction_number: r.txNumber,
            subtotal: r.subtotal,
            tax_amount: r.tax,
            total: r.total,
            payment_method: r.paymentMethod,
            finix_authorization_id: r.finixAuth,
            finix_transfer_id: r.finixTransfer,
            card_last_four: r.cardLast4,
            card_type: r.cardType,
            status: 'completed',
            notes: 'seed',
            original_transaction_number: null,
            session_id: null,
            created_at: r.createdAt
          },
          items: r.items.map((item) => ({
            product_sku: item.sku,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            cost_at_sale: item.costAtSale,
            cost_basis_source: 'legacy_baseline',
            total_price: item.totalPrice
          }))
        }
        enqueueStmt.run(r.txNumber, JSON.stringify(payload), deviceId)
      }
    }
  })

  const start = Date.now()
  tx(plan)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\nInserted ${plan.length} transactions in ${elapsed}s.`)
  if (shouldEnqueue) {
    console.log(
      `Enqueued ${plan.length} sync_queue items. The POS sync-worker will drain ~20 every 5s; 4 months of data will take a while to mirror to Supabase.`
    )
  } else {
    console.log('--no-sync passed (or no device_config). Local changes only.')
  }

  db.close()
}

try {
  main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
