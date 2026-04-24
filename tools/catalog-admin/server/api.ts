import { createClient, type User } from '@supabase/supabase-js'
import type { Connect, Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import type { CatalogProductFull, CuratedField, Merchant, MerchantProductRow } from '../src/types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/lib/supabase-config'

type MerchantDistributorRow = {
  distributor_number: number
  license_id: string | null
}

type CatalogDistributorRow = {
  distributor_id: number
  distributor_permit_id: string | null
}

type BulkPromoteRow = {
  catalog_product_id: number
  merchant_value: string
  merchant_product_id: string
}

const MP_PAGE = 1000
const CATALOG_CHUNK = 500
const CATALOG_PAGE = 1000

export function normalizeApiPathname(pathname: string): string {
  if (pathname === '/api') return '/'
  if (pathname.startsWith('/api/')) return pathname.slice('/api'.length)
  return pathname
}

function getServiceRoleKey(): string {
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return key
}

function getServiceClient(): ReturnType<typeof createClient> {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

function getAnonClient(): ReturnType<typeof createClient> {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? (JSON.parse(raw) as T) : ({} as T)
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

async function requireSuperUser(req: IncomingMessage): Promise<User> {
  const token = getBearerToken(req)
  if (!token) throw new Error('Missing authorization token')

  const anon = getAnonClient()
  const {
    data: { user },
    error
  } = await anon.auth.getUser(token)

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  if (user.app_metadata?.is_super_user !== true) {
    throw new Error('Forbidden')
  }

  return user
}

async function fetchCanonicalDistributorMap(merchantId: string): Promise<Map<number, number>> {
  const supabase = getServiceClient()
  const { data: merchantDistributors, error: merchantError } = await supabase
    .from('merchant_distributors')
    .select('distributor_number, license_id')
    .eq('merchant_id', merchantId)

  if (merchantError) throw new Error(merchantError.message)

  const distributorRows = (merchantDistributors ?? []) as MerchantDistributorRow[]
  const permitIds = [
    ...new Set(distributorRows.map((row) => row.license_id).filter(Boolean) as string[])
  ]

  if (permitIds.length === 0) return new Map<number, number>()

  const { data: catalogDistributors, error: catalogError } = await supabase
    .from('catalog_distributors')
    .select('distributor_id, distributor_permit_id')
    .in('distributor_permit_id', permitIds)

  if (catalogError) throw new Error(catalogError.message)

  const permitToDistributorId = new Map<string, number>()
  for (const row of (catalogDistributors ?? []) as CatalogDistributorRow[]) {
    if (row.distributor_permit_id) {
      permitToDistributorId.set(row.distributor_permit_id, row.distributor_id)
    }
  }

  const map = new Map<number, number>()
  for (const row of distributorRows) {
    if (row.license_id == null) continue
    const distributorId = permitToDistributorId.get(row.license_id)
    if (distributorId != null) {
      map.set(row.distributor_number, distributorId)
    }
  }

  return map
}

async function fetchMerchants(): Promise<Merchant[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('merchants')
    .select('id, merchant_name')
    .order('merchant_name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Merchant[]
}

async function fetchMerchantProducts(merchantId: string): Promise<MerchantProductRow[]> {
  const supabase = getServiceClient()
  const results: MerchantProductRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('merchant_products')
      .select('id, merchant_id, sku, name, barcode, size, cost, ttb_id, distributor_number')
      .eq('merchant_id', merchantId)
      .range(from, from + MP_PAGE - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    results.push(...(data as MerchantProductRow[]))
    if (data.length < MP_PAGE) break
    from += MP_PAGE
  }

  const canonicalDistributorMap = await fetchCanonicalDistributorMap(merchantId)

  return results.map((row) => ({
    ...row,
    canonical_distributor_id:
      row.distributor_number != null
        ? (canonicalDistributorMap.get(row.distributor_number) ?? null)
        : null
  }))
}

async function fetchCatalogProductsByTtbIds(ttbIds: string[]): Promise<CatalogProductFull[]> {
  if (ttbIds.length === 0) return []
  const supabase = getServiceClient()
  const results: CatalogProductFull[] = []

  for (let i = 0; i < ttbIds.length; i += CATALOG_CHUNK) {
    const chunk = ttbIds.slice(i, i + CATALOG_CHUNK)
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('catalog_products')
        .select(
          'id, ttb_id, distributor_id, nys_item, prod_name, brand_name, item_size, bot_price, ' +
            'curated_sku, curated_barcode, curated_size, curated_cost, ' +
            'curated_updated_at, curated_updated_by, curation_source_merchant_id'
        )
        .in('ttb_id', chunk)
        .order('id')
        .range(from, from + CATALOG_PAGE - 1)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      results.push(...((data ?? []) as unknown as CatalogProductFull[]))
      if (data.length < CATALOG_PAGE) break
      from += CATALOG_PAGE
    }
  }

  return results
}

async function bumpRevision(): Promise<void> {
  await getServiceClient().rpc('bump_catalog_revision')
}

async function promoteField(input: {
  catalogProductId: number
  field: CuratedField
  oldValue: string | null
  newValue: string
  sourceMerchantId: string
  operatorEmail: string
}): Promise<void> {
  const supabase = getServiceClient()
  const curatedCol = `curated_${input.field}`

  const { error: updateErr } = await supabase
    .from('catalog_products')
    .update({
      [curatedCol]: input.newValue,
      curated_updated_at: new Date().toISOString(),
      curated_updated_by: input.operatorEmail,
      curation_source_merchant_id: input.sourceMerchantId
    })
    .eq('id', input.catalogProductId)

  if (updateErr) throw new Error(updateErr.message)

  const { error: logErr } = await supabase.from('catalog_curation_log').insert({
    catalog_product_id: input.catalogProductId,
    field: input.field,
    old_value: input.oldValue,
    new_value: input.newValue,
    source_merchant_id: input.sourceMerchantId,
    updated_by: input.operatorEmail
  })

  if (logErr) throw new Error(logErr.message)

  await bumpRevision()
}

async function clearCuratedField(input: {
  catalogProductId: number
  field: CuratedField
  currentCuratedValue: string
  operatorEmail: string
}): Promise<void> {
  const supabase = getServiceClient()
  const curatedCol = `curated_${input.field}`

  const { error: updateErr } = await supabase
    .from('catalog_products')
    .update({
      [curatedCol]: null,
      curated_updated_at: new Date().toISOString(),
      curated_updated_by: input.operatorEmail
    })
    .eq('id', input.catalogProductId)

  if (updateErr) throw new Error(updateErr.message)

  const { error: logErr } = await supabase.from('catalog_curation_log').insert({
    catalog_product_id: input.catalogProductId,
    field: input.field,
    old_value: input.currentCuratedValue,
    new_value: null,
    source_merchant_id: null,
    updated_by: input.operatorEmail
  })

  if (logErr) throw new Error(logErr.message)

  await bumpRevision()
}

async function bulkPromoteEmptyCatalogFields(input: {
  rows: BulkPromoteRow[]
  field: CuratedField
  sourceMerchantId: string
  operatorEmail: string
}): Promise<{ promoted: number; errors: string[] }> {
  let promoted = 0
  const errors: string[] = []

  for (const row of input.rows) {
    try {
      await promoteField({
        catalogProductId: row.catalog_product_id,
        field: input.field,
        oldValue: null,
        newValue: row.merchant_value,
        sourceMerchantId: input.sourceMerchantId,
        operatorEmail: input.operatorEmail
      })
      promoted++
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return { promoted, errors }
}

async function routeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const user = await requireSuperUser(req)
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const pathname = normalizeApiPathname(url.pathname)

  if (req.method === 'GET' && pathname === '/merchants') {
    writeJson(res, 200, await fetchMerchants())
    return
  }

  if (req.method === 'GET' && pathname === '/merchant-products') {
    const merchantId = url.searchParams.get('merchantId')
    if (!merchantId) {
      writeJson(res, 400, { error: 'merchantId is required' })
      return
    }
    writeJson(res, 200, await fetchMerchantProducts(merchantId))
    return
  }

  if (req.method === 'POST' && pathname === '/catalog-products/by-ttb') {
    const body = await readJsonBody<{ ttbIds?: string[] }>(req)
    writeJson(res, 200, await fetchCatalogProductsByTtbIds(body.ttbIds ?? []))
    return
  }

  if (req.method === 'POST' && pathname === '/curation/promote') {
    const body = await readJsonBody<{
      catalogProductId: number
      field: CuratedField
      oldValue: string | null
      newValue: string
      sourceMerchantId: string
    }>(req)
    await promoteField({ ...body, operatorEmail: user.email ?? 'unknown' })
    writeJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && pathname === '/curation/clear') {
    const body = await readJsonBody<{
      catalogProductId: number
      field: CuratedField
      currentCuratedValue: string
    }>(req)
    await clearCuratedField({ ...body, operatorEmail: user.email ?? 'unknown' })
    writeJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && pathname === '/curation/bulk-promote') {
    const body = await readJsonBody<{
      rows: BulkPromoteRow[]
      field: CuratedField
      sourceMerchantId: string
    }>(req)
    writeJson(
      res,
      200,
      await bulkPromoteEmptyCatalogFields({
        ...body,
        operatorEmail: user.email ?? 'unknown'
      })
    )
    return
  }

  writeJson(res, 404, { error: 'Not found' })
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await routeRequest(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    const status =
      message === 'Missing authorization token' || message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : 500
    writeJson(res, status, { error: message })
  }
}

function register(app: Connect.Server): void {
  app.use((req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    if (!pathname.startsWith('/api')) {
      next()
      return
    }

    void handleApi(req, res).catch(next)
  })
}

export function catalogAdminApiPlugin(): Plugin {
  return {
    name: 'catalog-admin-local-api',
    configureServer(server: { middlewares: Connect.Server }) {
      register(server.middlewares)
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      register(server.middlewares)
    }
  }
}
