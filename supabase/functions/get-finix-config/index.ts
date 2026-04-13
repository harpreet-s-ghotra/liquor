import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Verify JWT from Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Create client with the user's JWT — respects RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  // Get authenticated user
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Fetch merchant row for this user
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('finix_merchant_id, merchant_name')
    .eq('user_id', user.id)
    .single()

  if (merchantError || !merchant) {
    return new Response(
      JSON.stringify({
        error: 'Merchant not provisioned. Contact support to set up your account.'
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!merchant.finix_merchant_id) {
    return new Response(
      JSON.stringify({
        error: 'Payment account not configured. Contact support to complete your Finix setup.'
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Read platform credentials from Vault (set via supabase secrets set)
  const apiUsername = Deno.env.get('FINIX_API_USERNAME')
  const apiPassword = Deno.env.get('FINIX_API_PASSWORD')

  if (!apiUsername || !apiPassword) {
    return new Response(JSON.stringify({ error: 'Payment configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(
    JSON.stringify({
      finix_merchant_id: merchant.finix_merchant_id,
      api_username: apiUsername,
      api_password: apiPassword,
      merchant_name: merchant.merchant_name
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
