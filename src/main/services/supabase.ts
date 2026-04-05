/**
 * Supabase service for the Electron main process.
 *
 * The URL and anon key are intentionally hardcoded — they are designed to be public
 * and are protected by Supabase Row Level Security policies, not by secrecy.
 *
 * Auth tokens are persisted to a JSON file in the app's userData directory so sessions
 * survive app restarts.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type {
  CatalogDistributor,
  CatalogProduct,
  AuthResult,
  MerchantConfig
} from '../../shared/types'
import { saveMerchantConfig, getMerchantConfig } from '../database'
import { validateApiKey } from './stax'

const SUPABASE_URL = 'https://jaqhifauqusvphdmrklv.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphcWhpZmF1cXVzdnBoZG1ya2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTI4NjgsImV4cCI6MjA5MDM2ODg2OH0.v017kt1cha6ykQgg7fkYcmaOR8tDCXGHT6qhaPgQdRo'

let supabase: SupabaseClient | null = null

// ── Custom file-based auth storage (Node.js has no localStorage) ──

function createFileStorage(filePath: string): {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
} {
  return {
    getItem: (key: string): string | null => {
      try {
        if (!existsSync(filePath)) return null
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, string>
        return data[key] ?? null
      } catch {
        return null
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        let data: Record<string, string> = {}
        if (existsSync(filePath)) {
          data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, string>
        }
        data[key] = value
        writeFileSync(filePath, JSON.stringify(data), 'utf-8')
      } catch {
        // non-critical — session will just not persist
      }
    },
    removeItem: (key: string): void => {
      try {
        if (!existsSync(filePath)) return
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, string>
        delete data[key]
        writeFileSync(filePath, JSON.stringify(data), 'utf-8')
      } catch {
        // non-critical
      }
    }
  }
}

/**
 * Must be called once in app.whenReady() with the Electron userData path.
 */
export function initializeSupabaseService(userDataPath: string): void {
  mkdirSync(userDataPath, { recursive: true })
  const authFilePath = join(userDataPath, 'supabase-auth.json')

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createFileStorage(authFilePath),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  })
}

function getClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase service not initialized')
  return supabase
}

/**
 * Public accessor for the Supabase client — used by the sync worker.
 */
export function getSupabaseClient(): SupabaseClient {
  return getClient()
}

/**
 * Fetch the merchant's cloud UUID from the `merchants` table.
 * Needed for FK references when writing to cloud sync tables.
 */
export async function getMerchantCloudId(): Promise<string | null> {
  const client = getClient()
  const { data: sessionData } = await client.auth.getSession()
  if (!sessionData.session) return null

  const userId = sessionData.session.user.id
  const { data, error } = await client.from('merchants').select('id').eq('user_id', userId).single()

  if (error || !data) return null
  return data.id as string
}

// ── Auth ──

/**
 * Sign in with email + password. On success, fetches the merchant record from Supabase,
 * validates the Stax API key, and saves the merchant config to local SQLite.
 */
export async function supabaseSignIn(email: string, password: string): Promise<AuthResult> {
  const client = getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Sign in failed')
  }

  const merchant = await fetchAndSaveMerchant(data.user.id)
  return { user: { id: data.user.id, email: data.user.email! }, merchant }
}

/**
 * Exchange an invite/recovery access token + refresh token for a live session.
 * Called when the app opens via a deep link (liquorpos://auth/callback#access_token=...).
 * Returns the user's email so the renderer can show the set-password screen.
 */
export async function supabaseSetSession(
  accessToken: string,
  refreshToken: string
): Promise<{ email: string }> {
  const client = getClient()
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })
  if (error || !data.user) throw new Error(error?.message ?? 'Failed to establish session')
  return { email: data.user.email! }
}

/**
 * Set a new password for the currently signed-in user.
 * Used after accepting an email invite.
 */
export async function supabaseSetPassword(password: string): Promise<AuthResult> {
  const client = getClient()
  const { data, error } = await client.auth.updateUser({ password })
  if (error || !data.user) throw new Error(error?.message ?? 'Failed to set password')
  const merchant = await fetchAndSaveMerchant(data.user.id)
  return { user: { id: data.user.id, email: data.user.email! }, merchant }
}

/**
 * Sign out and clear the persisted session.
 */
export async function supabaseSignOut(): Promise<void> {
  const client = getClient()
  await client.auth.signOut()
}

/**
 * Check if a valid session exists. If so, ensures the merchant config is saved locally.
 * Returns the auth result or null if no session.
 */
export async function supabaseCheckSession(): Promise<AuthResult | null> {
  const client = getClient()
  const { data } = await client.auth.getSession()

  if (!data.session) return null

  const user = data.session.user
  // Check if we already have the merchant config locally
  let localConfig = getMerchantConfig()
  if (!localConfig) {
    localConfig = await fetchAndSaveMerchant(user.id)
  }

  return { user: { id: user.id, email: user.email! }, merchant: localConfig }
}

// ── Helpers ──

async function fetchAndSaveMerchant(userId: string): Promise<MerchantConfig> {
  const client = getClient()
  const { data, error } = await client
    .from('merchants')
    .select('payment_processing_api_key, merchant_name, stax_merchant_id')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new Error('Merchant account not found. Please contact support.')
  }

  // Attempt to validate the payment API key; fall back to Supabase data if unavailable
  let merchantId = data.stax_merchant_id ?? ''
  let merchantName = data.merchant_name
  try {
    const paymentInfo = await validateApiKey(data.payment_processing_api_key)
    merchantId = paymentInfo.merchant_id
    merchantName = paymentInfo.company_name
  } catch {
    // Payment provider not configured yet — proceed with Supabase merchant data
  }

  saveMerchantConfig({
    payment_processing_api_key: data.payment_processing_api_key,
    merchant_id: merchantId,
    merchant_name: merchantName
  })

  return getMerchantConfig()!
}

// ── Catalog ──

/**
 * Fetch all distributors from the Supabase master catalog.
 */
export async function getCatalogDistributors(): Promise<CatalogDistributor[]> {
  const client = getClient()
  const { data, error } = await client
    .from('catalog_distributors')
    .select('distributor_id, distributor_name, distributor_permit_id, county, post_type')
    .order('distributor_name')

  if (error) throw new Error(`Failed to fetch distributors: ${error.message}`)
  return (data ?? []) as CatalogDistributor[]
}

/**
 * Fetch catalog products for the given distributor IDs.
 * Fetches in batches to handle large result sets.
 */
export async function getCatalogProductsByDistributors(
  distributorIds: number[]
): Promise<CatalogProduct[]> {
  if (distributorIds.length === 0) return []

  const client = getClient()
  const BATCH_SIZE = 1000
  const all: CatalogProduct[] = []

  // Supabase query limit is 1000 rows per request by default; page through results
  let from = 0
  while (true) {
    const { data, error } = await client
      .from('catalog_products')
      .select(
        'id, distributor_id, nys_item, ttb_id, brand_name, prod_name, beverage_type, bev_type_code, item_type, item_size, unit_of_measure, bottles_per_case, proof, alcohol_pct, vintage, bot_price, case_price, post_type'
      )
      .in('distributor_id', distributorIds)
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(`Failed to fetch catalog products: ${error.message}`)
    if (!data || data.length === 0) break

    all.push(...(data as CatalogProduct[]))
    if (data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  return all
}
