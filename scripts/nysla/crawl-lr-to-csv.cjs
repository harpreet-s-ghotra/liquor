const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')

const BASE_URL = 'https://www.nyslapricepostings.com'
const DEFAULT_DELAY_MS = 100
const DEFAULT_MONTH = 'next_month'
const DEFAULT_POST_TYPE = 'LR'
const DEFAULT_DATA_DIR = 'data'
const DEFAULT_CONCURRENCY = 10

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
}

function csvCell(value) {
  const text = String(value ?? '')
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function writeCsv(filePath, rows) {
  if (rows.length === 0) {
    fs.writeFileSync(filePath, '', 'utf8')
    return
  }
  const columnSet = new Set()
  for (const row of rows) {
    for (const key of Object.keys(row)) columnSet.add(key)
  }
  const columns = Array.from(columnSet)
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((col) => csvCell(row[col])).join(','))
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

async function waitForHumanChallenge(page) {
  while (true) {
    const challenged =
      (await page.locator('text=Additional security check is required').count()) > 0 ||
      (await page.locator('text=Request unsuccessful. Incapsula incident ID').count()) > 0

    if (!challenged) return

    console.log('Security check detected — please solve it in the browser window...')
    await sleep(3000)
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
    } catch {
      // keep looping
    }
  }
}

// Fire multiple URLs concurrently inside the browser's JS context (same session/cookies)
async function fetchMany(page, urls) {
  return page.evaluate(async (fetchUrls) => {
    const results = await Promise.allSettled(
      fetchUrls.map(async (url) => {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 45000)
        try {
          const res = await fetch(url, { signal: controller.signal })
          clearTimeout(tid)
          const text = await res.text()
          if (text.trimStart().startsWith('<')) throw new Error(`blocked`)
          return JSON.parse(text)
        } catch (err) {
          clearTimeout(tid)
          throw err
        }
      })
    )
    return results.map((r) =>
      r.status === 'fulfilled' ? { ok: true, data: r.value } : { ok: false, error: r.reason?.message }
    )
  }, urls)
}

async function apiFetch(page, url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const [result] = await fetchMany(page, [url])
    if (result.ok) return result.data

    if (attempt < retries) {
      console.log(`  blocked on attempt ${attempt}, re-establishing session...`)
      await page.goto(`${BASE_URL}/public/price-lookup`, {
        waitUntil: 'domcontentloaded',
        timeout: 120000
      })
      await waitForHumanChallenge(page)
      await sleep(2000)
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`)
}

function productUrl(licenseId, pageNum, postType, month) {
  return `${BASE_URL}/rest/product/lookup?page=${pageNum}&post_type=${postType}&license_id=${licenseId}&month=${month}`
}

function flattenProduct(product, distributor) {
  return {
    distributor_id: distributor.id,
    distributor_permit_id: distributor.permit_id,
    distributor_name: distributor.premise_name,
    distributor_county: distributor.county,
    nys_item: product.nys_item ?? '',
    prod_item: product.prod_item ?? '',
    brand_name: product.brand_name ?? '',
    prod_name: product.prod_name ?? '',
    beverage_type: product.beverage_type?.description ?? '',
    bev_type_code: product.bev_type ?? '',
    item_size: product.item_size ?? '',
    unit_of_measure: product.um ?? '',
    proof: product.proof ?? '',
    alcohol_pct: product.alcohol ?? '',
    vintage: product.vintage ?? '',
    subpack: product.subpack ?? '',
    bottles_per_case: product.botpercase ?? '',
    bot_price_nyc: product.bot_nyc ?? '',
    case_price_nyc: product.case_nyc ?? '',
    bot_price: product.bot_price ?? '',
    case_price: product.case_price ?? '',
    fob: product.fob ?? '',
    full_case_only: product.fullcase ?? '',
    reg_combo: product.reg_combo ?? '',
    brand_reg: product.brand_reg ?? '',
    label_type: product.label_type ?? '',
    nys_product: product.nys_prod ?? '',
    availability: product.availability ?? '',
    limited_availability: product.lim_avail ?? '',
    alloc_desc: product.alloc_desc ?? '',
    alloc_method: product.alloc_met ?? '',
    combo_discount: product.combo_disa ?? '',
    combo_assemble: product.combo_asse ?? '',
    prim_info: product.prim_info ?? '',
    ttb_id: product.ttb_id ?? '',
    post_type: product.post_type ?? '',
    post_year: product.post_year ?? '',
    post_month: product.post_month ?? '',
    nys_whole_serial: product.nys_whole ?? '',
    product_id: product.id ?? ''
  }
}

async function processDistributor(page, distributor, postType, month, dataDir) {
  const safeName = sanitizeFilename(distributor.premise_name)
  const outFile = path.join(dataDir, `${distributor.id}_${safeName}.csv`)

  if (fs.existsSync(outFile)) {
    return { status: 'skipped', name: distributor.premise_name }
  }

  // Fetch page 1 to get total page count
  const pageOneUrl = productUrl(distributor.id, 1, postType, month)
  const [pageOneResult] = await fetchMany(page, [pageOneUrl])
  if (!pageOneResult.ok) {
    return { status: 'error', name: distributor.premise_name, error: pageOneResult.error }
  }

  const pageOne = pageOneResult.data
  const totalPages = pageOne.pageInfo?.pagesCount ?? 1
  const totalItems = pageOne.pageInfo?.totalItemsCount ?? 0

  // Fetch remaining pages all at once in parallel
  const rows = (pageOne.data ?? []).map((p) => flattenProduct(p, distributor))

  if (totalPages > 1) {
    const remainingUrls = []
    for (let p = 2; p <= totalPages; p++) {
      remainingUrls.push(productUrl(distributor.id, p, postType, month))
    }
    const pageResults = await fetchMany(page, remainingUrls)
    for (const result of pageResults) {
      if (result.ok) {
        for (const product of result.data.data ?? []) {
          rows.push(flattenProduct(product, distributor))
        }
      }
    }
  }

  writeCsv(outFile, rows)
  return { status: 'done', name: distributor.premise_name, rows: rows.length, totalItems, totalPages }
}

function parseArgs(argv) {
  const args = {
    dataDir: DEFAULT_DATA_DIR,
    delayMs: DEFAULT_DELAY_MS,
    month: DEFAULT_MONTH,
    postType: DEFAULT_POST_TYPE,
    maxDistributors: Infinity,
    concurrency: DEFAULT_CONCURRENCY
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--data-dir' && argv[i + 1]) {
      args.dataDir = argv[i + 1]
      i += 1
    } else if (token === '--delay-ms' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      if (Number.isFinite(parsed) && parsed >= 0) args.delayMs = parsed
      i += 1
    } else if (token === '--month' && argv[i + 1]) {
      args.month = String(argv[i + 1])
      i += 1
    } else if (token === '--post-type' && argv[i + 1]) {
      args.postType = String(argv[i + 1]).toUpperCase()
      i += 1
    } else if (token === '--max-distributors' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      if (Number.isFinite(parsed) && parsed > 0) args.maxDistributors = parsed
      i += 1
    } else if (token === '--concurrency' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10)
      if (Number.isFinite(parsed) && parsed > 0) args.concurrency = parsed
      i += 1
    }
  }

  return args
}

async function run() {
  const args = parseArgs(process.argv.slice(2))
  const { postType, month } = args

  const dataDir = path.resolve(process.cwd(), args.dataDir, postType.toLowerCase())
  fs.mkdirSync(dataDir, { recursive: true })

  const userDataDir = path.resolve(process.cwd(), '.nysla-playwright-profile')
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1400, height: 900 }
  })

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()

  const seedUrl = `${BASE_URL}/public/price-lookup?post_type=${postType}&license_id=873503&page=1`
  console.log(`Post type: ${postType}  Month: ${month}  Concurrency: ${args.concurrency}`)
  console.log(`Output dir: ${dataDir}`)
  console.log(`Opening: ${seedUrl}`)
  await page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await waitForHumanChallenge(page)
  await sleep(1000)

  console.log(`Fetching distributor list...`)
  const allDistributors = await apiFetch(
    page,
    `${BASE_URL}/rest/organization/get-published-distributors/${postType}?month=${month}`
  )
  console.log(`Distributors found: ${allDistributors.length}`)

  if (allDistributors.length === 0) throw new Error('No distributors returned from API.')

  const distributors = allDistributors.slice(0, args.maxDistributors)
  let done = 0
  let skipped = 0
  let errors = 0

  // Process in batches of --concurrency
  for (let i = 0; i < distributors.length; i += args.concurrency) {
    const batch = distributors.slice(i, i + args.concurrency)

    const results = await Promise.allSettled(
      batch.map((d) => processDistributor(page, d, postType, month, dataDir))
    )

    for (const settled of results) {
      if (settled.status === 'rejected') {
        errors += 1
        console.error(`  error: ${settled.reason?.message}`)
        continue
      }
      const r = settled.value
      if (r.status === 'skipped') {
        skipped += 1
        console.log(`[skip] ${r.name}`)
      } else if (r.status === 'error') {
        errors += 1
        console.warn(`[fail] ${r.name} — ${r.error}`)
      } else {
        done += 1
        const total = done + skipped + errors
        console.log(
          `[${total}/${distributors.length}] ${r.name} — ${r.rows} rows (${r.totalPages} pages)`
        )
      }
    }

    await sleep(args.delayMs)
  }

  console.log(
    `\nDone. ${done} downloaded, ${skipped} skipped (already existed), ${errors} errors.`
  )
  console.log(`Files in: ${dataDir}`)

  await context.close()
}

run().catch((error) => {
  console.error('Crawler failed:', error)
  process.exit(1)
})
