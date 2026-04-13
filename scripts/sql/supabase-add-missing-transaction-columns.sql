-- Run this in the Supabase SQL Editor.
-- It aligns merchant_transactions with the current sync uploader contract.

ALTER TABLE public.merchant_transactions
  ADD COLUMN IF NOT EXISTS finix_authorization_id TEXT,
  ADD COLUMN IF NOT EXISTS finix_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id INTEGER;

-- Early cloud schemas used sold_at instead of created_at and required it.
-- The current app contract sends created_at, so sold_at must not block inserts.
UPDATE public.merchant_transactions
SET sold_at = COALESCE(sold_at, created_at, now())
WHERE sold_at IS NULL;

ALTER TABLE public.merchant_transactions
  ALTER COLUMN sold_at DROP NOT NULL,
  ALTER COLUMN sold_at SET DEFAULT now(),
  ALTER COLUMN payment_method DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchant_transactions'
ORDER BY ordinal_position;