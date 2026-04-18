/**
 * Register management service.
 *
 * CRUD operations on the Supabase `registers` table for admin management
 * of multi-register setups.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type RegisterRow = {
  id: string
  device_name: string
  device_fingerprint: string
  last_seen_at: string
  created_at: string
}

export async function listRegisters(
  supabase: SupabaseClient,
  merchantCloudId: string
): Promise<RegisterRow[]> {
  const { data, error } = await supabase
    .from('registers')
    .select('id, device_name, device_fingerprint, last_seen_at, created_at')
    .eq('merchant_id', merchantCloudId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list registers: ${error.message}`)
  return (data ?? []) as RegisterRow[]
}

export async function renameRegister(
  supabase: SupabaseClient,
  registerId: string,
  newName: string
): Promise<void> {
  const { error } = await supabase
    .from('registers')
    .update({ device_name: newName })
    .eq('id', registerId)

  if (error) throw new Error(`Failed to rename register: ${error.message}`)
}

export async function deleteRegister(supabase: SupabaseClient, registerId: string): Promise<void> {
  const { error } = await supabase.from('registers').delete().eq('id', registerId)

  if (error) throw new Error(`Failed to delete register: ${error.message}`)
}
