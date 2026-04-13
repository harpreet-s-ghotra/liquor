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
  MerchantConfig,
  BusinessInfoInput,
  ProvisionMerchantResult
} from '../../shared/types'
import { saveMerchantConfig, getMerchantConfig } from '../database'
import { verifyMerchant } from './finix'
import { provisionMerchantForUser } from './merchant-provisioning'

const SUPABASE_URL = 'https://jaqhifauqusvphdmrklv.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphcWhpZmF1cXVzdnBoZG1ya2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTI4NjgsImV4cCI6MjA5MDM2ODg2OH0.v017kt1cha6ykQgg7fkYcmaOR8tDCXGHT6qhaPgQdRo'

let supabase: SupabaseClient | null = null
let supabaseAdmin: SupabaseClient | null = null

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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createFileStorage(authFilePath),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  })

  if (serviceRoleKey) {
    supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  } else {
    supabaseAdmin = null
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY not found. Invite onboarding cannot auto-provision missing merchant rows.'
    )
  }
}

function getClient(): SupabaseClient {
  if (!supabase) throw new Error('Supabase service not initialized')
  return supabase
}

function getAdminClient(): SupabaseClient | null {
  return supabaseAdmin
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
 * fetches Finix credentials via the get-finix-config Edge Function, and saves the merchant config to local SQLite.
 */
export async function supabaseSignIn(email: string, password: string): Promise<AuthResult> {
  const client = getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Sign in failed')
  }

  const merchant = await ensureMerchantAndSave(data.user.id, data.user.email!)
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
  const merchant = await ensureMerchantAndSave(data.user.id, data.user.email!)
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
    localConfig = await ensureMerchantAndSave(user.id, user.email!)
  }

  return { user: { id: user.id, email: user.email! }, merchant: localConfig }
}

// ── Helpers ──

async function ensureMerchantAndSave(userId: string, email: string): Promise<MerchantConfig> {
  try {
    return await fetchAndSaveMerchant(userId)
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('Merchant account')) {
      throw err
    }

    const adminClient = getAdminClient()
    if (!adminClient) {
      throw new Error(
        'Merchant account has not been provisioned for this invite yet. Configure SUPABASE_SERVICE_ROLE_KEY or pre-create the merchant row before inviting the user.'
      )
    }

    await provisionMerchantForUser(adminClient as never, { userId, email })
    return await fetchAndSaveMerchant(userId)
  }
}

async function fetchAndSaveMerchant(userId: string): Promise<MerchantConfig> {
  const client = getClient()

  // Call the Edge Function to get Finix credentials + merchant ID from Vault
  const { data: fnData, error: fnError } = await client.functions.invoke('get-finix-config')

  if (fnError || !fnData) {
    // Edge Function not reachable — fall back to querying the DB directly
    const { data, error } = await client
      .from('merchants')
      .select('finix_merchant_id, merchant_name')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new Error(
        'Merchant account has not been provisioned for this invite yet. Please contact support to resend the invite.'
      )
    }

    // finix_merchant_id may be null if Finix provisioning hasn't been completed yet.
    // That's fine — the merchant can still log in and set up the app; payments will
    // be blocked at charge time rather than here.
    saveMerchantConfig({
      finix_api_username: '',
      finix_api_password: '',
      merchant_id: data.finix_merchant_id ?? '',
      merchant_name: data.merchant_name
    })

    return getMerchantConfig()!
  }

  const { finix_merchant_id, api_username, api_password, merchant_name } = fnData as {
    finix_merchant_id: string
    api_username: string
    api_password: string
    merchant_name: string
  }

  // Optionally verify merchant is still active in Finix (non-blocking)
  let resolvedMerchantName = merchant_name
  try {
    const merchantInfo = await verifyMerchant(api_username, api_password, finix_merchant_id)
    if (merchantInfo.merchant_name) resolvedMerchantName = merchantInfo.merchant_name
  } catch {
    // Finix unreachable or not yet configured — proceed with Supabase data
  }

  saveMerchantConfig({
    finix_api_username: api_username,
    finix_api_password: api_password,
    merchant_id: finix_merchant_id,
    merchant_name: resolvedMerchantName
  })

  return getMerchantConfig()!
}

// ── Finix Merchant Provisioning ──

/**
 * Provision a Finix merchant for the current user by calling the Edge Function.
 * After provisioning, fetches and saves the full merchant config locally.
 */
export async function provisionFinixMerchant(
  input: BusinessInfoInput
): Promise<ProvisionMerchantResult> {
  const client = getClient()

  const { data: sessionData } = await client.auth.getSession()
  if (!sessionData.session) throw new Error('Not authenticated')

  // Use raw fetch so we always get the full response body for debugging
  const accessToken = sessionData.session.access_token
  const fnUrl = `${SUPABASE_URL}/functions/v1/provision-finix-merchant`
  console.log('[provision-finix] Calling Edge Function:', fnUrl)

  const rawRes = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(input)
  })

  const responseText = await rawRes.text()
  console.log('[provision-finix] HTTP status:', rawRes.status)
  console.log('[provision-finix] Response body:', responseText)

  if (!rawRes.ok) {
    let message = `Edge Function failed (${rawRes.status})`
    try {
      const parsed = JSON.parse(responseText)
      if (parsed.finix_error) {
        console.error('[provision-finix] Finix API error:', parsed.finix_error)
      }
      message = parsed.error ?? message
    } catch {
      message = responseText || message
    }
    throw new Error(message)
  }

  const data = JSON.parse(responseText)

  const result = data as ProvisionMerchantResult

  // Now fetch the full merchant config (including Finix API credentials from Vault)
  const userId = sessionData.session.user.id
  await fetchAndSaveMerchant(userId)

  return result
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
