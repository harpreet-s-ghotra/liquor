-- Migration: Replace Stax payment columns with Finix equivalents
-- Removes Stax-specific columns from the merchants table and adds finix_merchant_id.
-- Platform API credentials are stored in Supabase Vault (secrets), not per-merchant columns.

-- 1. Add finix_merchant_id column
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS finix_merchant_id TEXT;

-- 2. Copy existing stax_merchant_id values into finix_merchant_id (preserve data)
UPDATE merchants
  SET finix_merchant_id = stax_merchant_id
  WHERE stax_merchant_id IS NOT NULL;

-- 3. Drop stax_merchant_id
ALTER TABLE merchants
  DROP COLUMN IF EXISTS stax_merchant_id;

-- 4. Drop payment_processing_api_key (credentials now come from Vault, not per-merchant)
ALTER TABLE merchants
  DROP COLUMN IF EXISTS payment_processing_api_key;
