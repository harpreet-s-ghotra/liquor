import { supabaseAuth } from './supabase'
import type { Merchant, CatalogProductFull, MerchantProductRow, CuratedField } from '../types'

const LOCAL_API_NOT_FOUND_MESSAGE =
  'Catalog admin API route not found. Start the local admin server with "npm run admin" from the repo root or "npm run dev" in tools/catalog-admin.'

async function getAccessToken(): Promise<string> {
  const {
    data: { session }
  } = await supabaseAuth.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Sign in required')
  }

  return session.access_token
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    if (response.status === 404 && path.startsWith('/api/')) {
      throw new Error(LOCAL_API_NOT_FOUND_MESSAGE)
    }

    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(errorBody?.error ?? `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function fetchMerchants(): Promise<Merchant[]> {
  return apiRequest<Merchant[]>('/api/merchants')
}

export async function fetchMerchantProducts(merchantId: string): Promise<MerchantProductRow[]> {
  const params = new URLSearchParams({ merchantId })
  return apiRequest<MerchantProductRow[]>(`/api/merchant-products?${params.toString()}`)
}

export async function fetchCatalogProductsByTtbIds(
  ttbIds: string[]
): Promise<CatalogProductFull[]> {
  return apiRequest<CatalogProductFull[]>('/api/catalog-products/by-ttb', {
    method: 'POST',
    body: JSON.stringify({ ttbIds })
  })
}

export async function promoteField(
  catalogProductId: number,
  field: CuratedField,
  oldValue: string | null,
  newValue: string,
  sourceMerchantId: string,
  _operatorEmail: string
): Promise<void> {
  await apiRequest('/api/curation/promote', {
    method: 'POST',
    body: JSON.stringify({ catalogProductId, field, oldValue, newValue, sourceMerchantId })
  })
}

export async function clearCuratedField(
  catalogProductId: number,
  field: CuratedField,
  currentCuratedValue: string,
  _operatorEmail: string
): Promise<void> {
  await apiRequest('/api/curation/clear', {
    method: 'POST',
    body: JSON.stringify({ catalogProductId, field, currentCuratedValue })
  })
}

export async function bulkPromoteEmptyCatalogFields(
  rows: Array<{
    catalog_product_id: number
    merchant_value: string
    merchant_product_id: string
  }>,
  field: CuratedField,
  sourceMerchantId: string,
  _operatorEmail: string
): Promise<{ promoted: number; errors: string[] }> {
  return apiRequest<{ promoted: number; errors: string[] }>('/api/curation/bulk-promote', {
    method: 'POST',
    body: JSON.stringify({ rows, field, sourceMerchantId })
  })
}
