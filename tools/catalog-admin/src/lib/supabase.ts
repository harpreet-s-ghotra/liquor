/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config'

/**
 * Auth client — uses the anon key.
 * Used only for operator sign-in/sign-out and reading app_metadata.
 * All data access uses supabaseAdmin instead.
 */
export const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'catalog-admin-session',
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})
