/**
 * invite-merchant Edge Function
 *
 * Creates a merchant row + sends a Supabase invite email in one atomic call.
 * This eliminates the need for local scripts — just POST with email and you're done.
 *
 * Usage:
 *   curl -X POST https://<project-ref>.supabase.co/functions/v1/invite-merchant \
 *     -H "Authorization: Bearer <INVITE_ADMIN_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"owner@example.com","merchantName":"Corner Bottle Shop"}'
 *
 * Required Supabase secrets (set via `npx supabase secrets set`):
 *   INVITE_ADMIN_SECRET  — a strong random string you choose; acts as the API key
 *
 * Environment variables automatically available in Edge Functions:
 *   SUPABASE_URL             — injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — injected by Supabase
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REDIRECT_TO = 'liquorpos://auth/callback'

function deriveMerchantName(email: string): string {
  const localPart = email.split('@')[0]?.trim() ?? ''
  const tokens = localPart
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/^\d+|\d+$/g, ''))
    .filter(Boolean)

  if (tokens.length === 0) return 'New Merchant'
  const formatted = tokens
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(' ')
  return formatted.length > 0 ? `${formatted} Store` : 'New Merchant'
}

Deno.serve(async (req: Request) => {
  // Only POST is allowed
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Authenticate the caller
  const adminSecret = Deno.env.get('INVITE_ADMIN_SECRET')
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!adminSecret || callerToken !== adminSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Parse body
  let body: { email?: string; merchantName?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return new Response(JSON.stringify({ error: 'email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const merchantName = body.merchantName?.trim() || deriveMerchantName(email)

  // Build admin client — service role key and URL are injected automatically
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // Check if user already exists
  let userId: string
  let invited = false

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })
  if (listError) {
    return new Response(JSON.stringify({ error: `Failed to list users: ${listError.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const existing = listData.users.find((u) => u.email?.trim().toLowerCase() === email)

  if (existing) {
    userId = existing.id
  } else {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: REDIRECT_TO }
    )
    if (inviteError || !inviteData.user) {
      return new Response(
        JSON.stringify({ error: inviteError?.message ?? 'Failed to send invite' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    userId = inviteData.user.id
    invited = true
  }

  // Upsert merchant row
  const { error: merchantError } = await admin
    .from('merchants')
    .upsert(
      { user_id: userId, merchant_name: merchantName, finix_merchant_id: null },
      { onConflict: 'user_id' }
    )
  if (merchantError) {
    return new Response(
      JSON.stringify({ error: `Failed to provision merchant: ${merchantError.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ success: true, userId, merchantName, invited }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
})
