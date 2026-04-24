import type {
  CatalogProductFull,
  MerchantProductRow,
  DiffRow,
  CuratedField,
  DiffStatus
} from '../types'

const CURATED_FIELDS: CuratedField[] = ['sku', 'barcode', 'size', 'cost']

// ttb_id values that are known garbage/placeholder data — not real product identifiers
const JUNK_TTB_IDS = new Set(['p', '0', ''])

function normalizeTtbId(value: string | null | undefined): string | null {
  if (value == null) return null
  const normalized = value.trim().toLowerCase()
  if (JUNK_TTB_IDS.has(normalized)) return null
  return normalized
}

function normalizeStr(val: string | null | undefined): string | null {
  if (val == null) return null
  const s = val.trim()
  return s === '' ? null : s.toLowerCase()
}

// Strip trailing unit letters (ML, LT, L, OZ, etc.) and return the numeric portion.
// Allows comparing catalog '750' with merchant '750ML', '1.5' with '1.5LT', etc.
function normalizeSizeValue(val: string | null): number | null {
  if (val == null) return null
  const numeric = val
    .trim()
    .replace(/[a-zA-Z]+$/, '')
    .trim()
  const n = parseFloat(numeric)
  return isNaN(n) ? null : n
}

function sizesMatch(a: string | null, b: string | null): boolean {
  if (a == null && b == null) return true
  const an = normalizeSizeValue(a)
  const bn = normalizeSizeValue(b)
  if (an != null && bn != null) return Math.abs(an - bn) < 0.001
  return normalizeStr(a) === normalizeStr(b)
}

/**
 * Given all catalog entries sharing a ttb_id, pick the best match for a merchant product.
 *
 * Priority:
 *   1. Same distributor_id + same size  (exact match)
 *   2. Same size only
 *   3. Same distributor_id only
 *   4. First entry (last-resort fallback)
 *
 * Returns null only if the candidates array is empty.
 */
function bestCatalogMatch(
  candidates: CatalogProductFull[],
  mp: MerchantProductRow
): CatalogProductFull | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const effectiveSize = mp.size

  // Score each candidate: 2 points for size match, 1 point for distributor match
  let best = candidates[0]
  let bestScore = -1

  for (const cat of candidates) {
    let score = 0
    if (sizesMatch(cat.item_size, effectiveSize)) score += 2
    if (mp.canonical_distributor_id != null && cat.distributor_id === mp.canonical_distributor_id) {
      score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }

  // If the best match has a score of 0 (no size or distributor alignment at all),
  // and there are size-bearing candidates, return null to signal no reliable match.
  if (bestScore === 0 && candidates.some((c) => c.item_size != null)) {
    return null
  }

  return best
}

function getOriginalCatalogValue(cat: CatalogProductFull, field: CuratedField): string | null {
  switch (field) {
    case 'sku':
      return null // nys_item is a NYS state reference number, not a product SKU; catalog has no native SKU
    case 'barcode':
      return null // catalog has no native barcode column
    case 'size':
      return cat.item_size
    case 'cost':
      // bot_price is what merchant.cost is seeded from at catalog import (see src/main/index.ts),
      // so it is the correct native baseline for cost diffs.
      return cat.bot_price != null ? String(cat.bot_price) : null
  }
}

function getCuratedValue(cat: CatalogProductFull, field: CuratedField): string | null {
  switch (field) {
    case 'sku':
      return cat.curated_sku
    case 'barcode':
      return cat.curated_barcode
    case 'size':
      return cat.curated_size
    case 'cost':
      return cat.curated_cost != null ? String(cat.curated_cost) : null
  }
}

function getMerchantValue(mp: MerchantProductRow, field: CuratedField): string | null {
  switch (field) {
    case 'sku': {
      const v = mp.sku || null
      // CAT-XXXXXX values are placeholders generated during catalog import — not real merchant SKUs
      if (v && /^CAT-/i.test(v)) return null
      // SKU equal to the ttb_id means it was auto-populated from the distributor line number, not a real SKU
      if (v && v === mp.ttb_id) return null
      return v
    }
    case 'barcode':
      return mp.barcode
    case 'size':
      return mp.size
    case 'cost':
      return mp.cost != null ? String(mp.cost) : null
  }
}

function computeStatus(
  original: string | null,
  curated: string | null,
  merchant: string | null,
  field: CuratedField
): DiffStatus {
  const effective = curated ?? original

  if (merchant == null || normalizeStr(merchant) == null) return 'match'
  if (effective == null) return 'merchant_has_value_catalog_missing'

  if (field === 'cost') {
    const eNum = parseFloat(effective)
    const mNum = parseFloat(merchant)
    if (!isNaN(eNum) && !isNaN(mNum)) {
      return Math.abs(eNum - mNum) < 0.0001 ? 'match' : 'differs'
    }
  }

  if (field === 'size') {
    const eNum = normalizeSizeValue(effective)
    const mNum = normalizeSizeValue(merchant)
    if (eNum != null && mNum != null) {
      return Math.abs(eNum - mNum) < 0.001 ? 'match' : 'differs'
    }
  }

  return normalizeStr(effective) === normalizeStr(merchant) ? 'match' : 'differs'
}

/** Build a map from ttb_id → all matching catalog entries (one-to-many). */
export function buildCatalogMap(
  catalogProducts: CatalogProductFull[]
): Map<string, CatalogProductFull[]> {
  const map = new Map<string, CatalogProductFull[]>()
  for (const cp of catalogProducts) {
    const ttbId = normalizeTtbId(cp.ttb_id)
    if (!ttbId) continue
    const existing = map.get(ttbId)
    if (existing) {
      existing.push(cp)
    } else {
      map.set(ttbId, [cp])
    }
  }
  return map
}

export function computeDiffRows(
  merchantProducts: MerchantProductRow[],
  catalogByTtbId: Map<string, CatalogProductFull[]>
): DiffRow[] {
  const rows: DiffRow[] = []

  for (const mp of merchantProducts) {
    const ttbId = normalizeTtbId(mp.ttb_id)
    if (!ttbId) continue

    const candidates = catalogByTtbId.get(ttbId) ?? null

    if (!candidates) {
      rows.push({
        key: `${mp.id}:no_match`,
        merchant_product_id: mp.id,
        catalog_product_id: null,
        product_name: mp.name,
        field: 'sku',
        original_catalog_value: null,
        curated_value: null,
        effective_catalog_value: null,
        merchant_value: mp.ttb_id,
        status: 'no_catalog_match'
      })
      continue
    }

    const cat = bestCatalogMatch(candidates, mp)

    if (!cat) {
      // ttb_id exists in catalog but no entry shares this product's size or distributor
      rows.push({
        key: `${mp.id}:no_match`,
        merchant_product_id: mp.id,
        catalog_product_id: null,
        product_name: mp.name,
        field: 'sku',
        original_catalog_value: null,
        curated_value: null,
        effective_catalog_value: null,
        merchant_value: mp.ttb_id,
        status: 'no_catalog_match'
      })
      continue
    }

    for (const field of CURATED_FIELDS) {
      const original = getOriginalCatalogValue(cat, field)
      const curated = getCuratedValue(cat, field)
      const merchant = getMerchantValue(mp, field)
      const effective = curated ?? original
      let status = computeStatus(original, curated, merchant, field)

      // Catalog may hold multiple rows per ttb_id (NYSLA price history, size variants).
      // For cost and size, treat any candidate match as a match to avoid false 'differs'.
      if ((field === 'cost' || field === 'size') && status === 'differs' && merchant != null) {
        for (const alt of candidates) {
          if (alt === cat) continue
          const altOrig = getOriginalCatalogValue(alt, field)
          const altCur = getCuratedValue(alt, field)
          if (computeStatus(altOrig, altCur, merchant, field) === 'match') {
            status = 'match'
            break
          }
        }
      }

      // Exclude 'match' rows — only show actionable diffs
      if (status !== 'match') {
        rows.push({
          key: `${mp.id}:${field}`,
          merchant_product_id: mp.id,
          catalog_product_id: cat.id,
          product_name: mp.name,
          field,
          original_catalog_value: original,
          curated_value: curated,
          effective_catalog_value: effective,
          merchant_value: merchant,
          status
        })
      }
    }
  }

  return rows
}
