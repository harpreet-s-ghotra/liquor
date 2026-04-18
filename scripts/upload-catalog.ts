/**
 * Upload NYSLA catalog data to Supabase.
 *
 * Reads all CSVs from data/lr/ and data/wr/, deduplicates by product_id,
 * then upserts distributors and inserts products in 20 parallel batches.
 *
 * Usage:
 *   npx tsx scripts/upload-catalog.ts
 *
 * Requires in .env:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import * as dotenv from 'dotenv'
import { parse } from 'csv-parse/sync'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const DATA_DIR = resolve(process.cwd(), 'data')
const BATCH_SIZE = 500
const PARALLEL_BATCHES = 20

// ── CSV parser ──

function parseCSV(filePath: string): Record<string, string>[] {
  const text = readFileSync(filePath, 'utf-8')
  try {
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    }) as Record<string, string>[]
  } catch {
    console.warn(`  Warning: could not parse ${filePath}, skipping`)
    return []
  }
}

function parseNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function parseInt2(val: string): number | null {
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

// ── Load + deduplicate all CSVs ──

function loadAllFiles(): Record<string, string>[] {
  const allRows: Record<string, string>[] = []
  for (const folder of ['lr', 'wr']) {
    const dir = join(DATA_DIR, folder)
    let files: string[]
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.csv'))
    } catch {
      console.warn(`  Skipping ${dir} — directory not found`)
      continue
    }
    for (const file of files) {
      const parsed = parseCSV(join(dir, file))
      allRows.push(...parsed)
    }
    console.log(`  Loaded ${files.length} files from data/${folder}/`)
  }

  // Deduplicate by product_id — keeps first occurrence
  const seen = new Set<string>()
  const rows = allRows.filter((row) => {
    const id = row['product_id']?.trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  console.log(
    `  Raw rows: ${allRows.length} → after dedup: ${rows.length} (removed ${allRows.length - rows.length} duplicates)`
  )
  return rows
}

// ── Upload distributors ──

async function uploadDistributors(rows: Record<string, string>[]): Promise<void> {
  const seen = new Map<number, object>()

  for (const row of rows) {
    const id = parseInt2(row['distributor_id'])
    if (id === null || seen.has(id)) continue
    seen.set(id, {
      distributor_id: id,
      distributor_name: row['distributor_name'] || null,
      distributor_permit_id: row['distributor_permit_id'] || null,
      county: row['distributor_county'] || null,
      post_type: row['post_type'] || null
    })
  }

  const distributors = Array.from(seen.values())
  console.log(`\nUpserting ${distributors.length} distributors...`)

  for (let i = 0; i < distributors.length; i += BATCH_SIZE) {
    const batch = distributors.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('catalog_distributors')
      .upsert(batch, { onConflict: 'distributor_id' })
    if (error) throw new Error(`Distributor upsert failed: ${error.message}`)
    process.stdout.write(
      `  ${Math.min(i + BATCH_SIZE, distributors.length)}/${distributors.length}\r`
    )
  }
  console.log(`  Done — ${distributors.length} distributors uploaded.`)
}

// ── Retry helper ──

async function withRetry<T>(fn: () => Promise<T>, retries = 4, delayMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      const wait = delayMs * attempt
      process.stdout.write(`  [retry ${attempt}/${retries - 1} in ${wait}ms] `)
      await new Promise((res) => setTimeout(res, wait))
    }
  }
  throw new Error('unreachable')
}

// ── Upload products (20 parallel batches) ──

async function uploadProducts(rows: Record<string, string>[]): Promise<void> {
  // Truncate first so re-running the script never creates duplicates.
  // catalog_products is reference data — no foreign keys point to it.
  console.log('\nTruncating existing catalog_products...')
  const { error: truncateError } = await supabase.rpc('truncate_catalog_products')
  if (truncateError) {
    // Fallback: delete all rows (slower but works without the RPC)
    const { error: deleteError } = await supabase.from('catalog_products').delete().neq('id', 0)
    if (deleteError) throw new Error(`Failed to clear catalog_products: ${deleteError.message}`)
  }
  console.log('  Done.')

  const batches: object[][] = []

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(
      rows.slice(i, i + BATCH_SIZE).map((row) => ({
        nys_item: row['product_id'] || null,
        distributor_id: parseInt2(row['distributor_id']),
        ttb_id: row['ttb_id'] || null,
        brand_name: row['brand_name'] || null,
        prod_name: row['prod_name'] || '(unnamed)',
        beverage_type: row['beverage_type'] || null,
        bev_type_code: row['bev_type_code'] || null,
        item_type: row['beverage_type'] || null,
        item_size: row['item_size'] || null,
        unit_of_measure: row['unit_of_measure'] || null,
        bottles_per_case: parseInt2(row['bottles_per_case']),
        proof: parseNum(row['proof']),
        alcohol_pct: parseNum(row['alcohol_pct']),
        vintage: row['vintage'] || null,
        bot_price: parseNum(row['bot_price']),
        case_price: parseNum(row['case_price']),
        post_type: row['post_type'] || null
      }))
    )
  }

  console.log(
    `\nInserting ${rows.length} products in ${batches.length} batches (${PARALLEL_BATCHES} parallel)...`
  )

  let completed = 0

  // Process in windows of PARALLEL_BATCHES
  for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
    const window = batches.slice(i, i + PARALLEL_BATCHES)

    await withRetry(async () => {
      const results = await Promise.allSettled(
        window.map((batch) => supabase.from('catalog_products').insert(batch))
      )

      for (const result of results) {
        if (result.status === 'rejected') {
          throw new Error(`Product insert failed: ${result.reason}`)
        }
        if (result.value.error) {
          throw new Error(`Product insert failed: ${result.value.error.message}`)
        }
      }
    })

    completed += window.length
    process.stdout.write(`  ${Math.min(completed * BATCH_SIZE, rows.length)}/${rows.length}\r`)
  }

  console.log(`  Done — ${rows.length} products uploaded.    `)
}

// ── Main ──

async function main(): Promise<void> {
  console.log('Loading CSV files...')
  const rows = loadAllFiles()
  console.log(`Total rows after dedup: ${rows.length}`)

  await uploadDistributors(rows)
  await uploadProducts(rows)

  console.log('\nCatalog upload complete.')
}

main().catch((err) => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
