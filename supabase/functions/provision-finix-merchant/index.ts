import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BusinessAddress {
  line1: string
  line2?: string
  city: string
  region: string
  postal_code: string
  country: string
}

interface BusinessInfoInput {
  business_name: string
  doing_business_as: string
  business_type:
    | 'INDIVIDUAL_SOLE_PROPRIETORSHIP'
    | 'PARTNERSHIP'
    | 'LIMITED_LIABILITY_COMPANY'
    | 'CORPORATION'
  business_phone: string
  business_address: BusinessAddress
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: { year: number; month: number; day: number }
  tax_id: string
  business_tax_id: string
  url?: string
  principal_percentage_ownership?: number
  annual_card_volume?: number
  incorporation_date?: { year: number; month: number; day: number }
  bank_account: {
    account_number: string
    routing_number: string
    account_type: 'PERSONAL_CHECKING' | 'PERSONAL_SAVINGS' | 'BUSINESS_CHECKING' | 'BUSINESS_SAVINGS'
    name: string
  }
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ──
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // ── Parse input ──
  let input: BusinessInfoInput
  try {
    input = (await req.json()) as BusinessInfoInput
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!input.business_name || !input.first_name || !input.last_name || !input.email) {
    return jsonResponse({ error: 'Missing required fields' }, 400)
  }

  // ── Read platform credentials from Vault ──
  const finixUsername = Deno.env.get('FINIX_API_USERNAME')
  const finixPassword = Deno.env.get('FINIX_API_PASSWORD')
  const finixAppId = Deno.env.get('FINIX_APPLICATION_ID')
  const finixEnv = Deno.env.get('FINIX_ENVIRONMENT') ?? 'sandbox'

  if (!finixUsername || !finixPassword || !finixAppId) {
    return jsonResponse({ error: 'Payment platform not configured' }, 500)
  }

  const baseUrl =
    finixEnv === 'live'
      ? 'https://finix.live-payments-api.com'
      : 'https://finix.sandbox-payments-api.com'

  const basicAuth = btoa(`${finixUsername}:${finixPassword}`)
  const finixHeaders = {
    'Content-Type': 'application/json',
    'Finix-Version': '2022-02-01',
    Authorization: `Basic ${basicAuth}`
  }

  // ── Step 1: Create Finix Identity ──
  const identityPayload = {
    entity: {
      business_name: input.business_name,
      doing_business_as: input.doing_business_as,
      business_type: input.business_type,
      business_phone: input.business_phone,
      business_address: {
        line1: input.business_address.line1,
        line2: input.business_address.line2 ?? null,
        city: input.business_address.city,
        region: input.business_address.region,
        postal_code: input.business_address.postal_code,
        country: 'USA'
      },
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      personal_address: {
        line1: input.business_address.line1,
        line2: input.business_address.line2 ?? null,
        city: input.business_address.city,
        region: input.business_address.region,
        postal_code: input.business_address.postal_code,
        country: 'USA'
      },
      dob: {
        year: input.dob.year,
        month: input.dob.month,
        day: input.dob.day
      },
      tax_id: input.tax_id.replace(/\D/g, ''),
      business_tax_id: input.business_tax_id,
      mcc: '5921',
      max_transaction_amount: 1000000,
      default_statement_descriptor: input.doing_business_as.substring(0, 20),
      ...(input.url ? { url: input.url } : {}),
      ...(input.principal_percentage_ownership !== undefined
        ? { principal_percentage_ownership: input.principal_percentage_ownership }
        : {}),
      ...(input.annual_card_volume !== undefined
        ? { annual_card_volume: input.annual_card_volume }
        : {}),
      ...(input.incorporation_date
        ? { incorporation_date: input.incorporation_date }
        : {})
    }
  }

  const identityRes = await fetch(`${baseUrl}/identities`, {
    method: 'POST',
    headers: finixHeaders,
    body: JSON.stringify(identityPayload)
  })

  if (!identityRes.ok) {
    const errBody = await identityRes.text()
    console.error('[provision] Identity creation failed:', identityRes.status, errBody)
    return jsonResponse({ error: `Failed to create business identity: ${identityRes.status}`, finix_error: errBody }, 502)
  }

  const identity = (await identityRes.json()) as { id: string }

  // ── Step 2: Associate Identity with Application ──
  const assocRes = await fetch(`${baseUrl}/identities/${identity.id}`, {
    method: 'PUT',
    headers: finixHeaders,
    body: JSON.stringify({
      tags: { application_id: finixAppId }
    })
  })

  if (!assocRes.ok) {
    console.error('[provision] Identity association warning:', assocRes.status)
    // Non-fatal — continue with merchant creation
  }

  // ── Step 2.5: Create Bank Account payment instrument ──
  const bankAccountRes = await fetch(`${baseUrl}/payment_instruments`, {
    method: 'POST',
    headers: finixHeaders,
    body: JSON.stringify({
      type: 'BANK_ACCOUNT',
      identity: identity.id,
      account_number: input.bank_account.account_number,
      bank_code: input.bank_account.routing_number,
      account_type: input.bank_account.account_type,
      name: input.bank_account.name
    })
  })

  if (!bankAccountRes.ok) {
    const errBody = await bankAccountRes.text()
    console.error('[provision] Bank account creation failed:', bankAccountRes.status, errBody)
    return jsonResponse(
      { error: `Failed to add bank account: ${bankAccountRes.status}`, finix_error: errBody },
      502
    )
  }

  // ── Step 3: Create Merchant under the Identity ──
  const processor = finixEnv === 'live' ? 'FINIX_V1' : 'DUMMY_V1'

  const merchantRes = await fetch(`${baseUrl}/identities/${identity.id}/merchants`, {
    method: 'POST',
    headers: finixHeaders,
    body: JSON.stringify({ processor })
  })

  if (!merchantRes.ok) {
    const errBody = await merchantRes.text()
    console.error('[provision] Merchant creation failed:', merchantRes.status, errBody)
    return jsonResponse(
      { error: `Failed to provision payment account: ${merchantRes.status}`, finix_error: errBody },
      502
    )
  }

  const merchant = (await merchantRes.json()) as { id: string }
  const finixMerchantId = merchant.id

  // ── Step 4: Store finix_merchant_id in Supabase ──
  // Use service role to bypass RLS for this write
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { error: updateError } = await adminClient
    .from('merchants')
    .update({
      finix_merchant_id: finixMerchantId,
      merchant_name: input.doing_business_as || input.business_name
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[provision] Failed to update merchant row:', updateError.message)
    return jsonResponse(
      { error: 'Payment account created but failed to save. Contact support.' },
      500
    )
  }

  return jsonResponse(
    {
      finix_merchant_id: finixMerchantId,
      merchant_name: input.doing_business_as || input.business_name
    },
    200
  )
})
