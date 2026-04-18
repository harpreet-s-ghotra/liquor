-- Cloud schema catch-up for initial-sync reconcilers.
--
-- Resolves three errors surfaced at app startup:
--   1. relation "merchant_business_settings" does not exist
--   2. relation "merchant_departments" does not exist
--   3. column merchant_distributors.distributor_number does not exist
--
-- Safe to run on an already-populated Supabase project: uses IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS everywhere.

-- ── merchant_distributors: add the missing column the uploader expects ──

ALTER TABLE IF EXISTS public.merchant_distributors
  ADD COLUMN IF NOT EXISTS distributor_number INTEGER;

-- Back-fill distributor_number from id where missing so UPSERT on
-- (merchant_id, distributor_number) works for existing rows. Runs only once.
UPDATE public.merchant_distributors
   SET distributor_number = COALESCE(distributor_number, CAST(id::text AS INTEGER))
 WHERE distributor_number IS NULL;

-- Enforce uniqueness so the uploader's onConflict target is valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'merchant_distributors_merchant_number_uniq'
  ) THEN
    CREATE UNIQUE INDEX merchant_distributors_merchant_number_uniq
      ON public.merchant_distributors (merchant_id, distributor_number);
  END IF;
END $$;

-- ── merchant_departments ──

CREATE TABLE IF NOT EXISTS public.merchant_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_code_id TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  device_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, name)
);

-- Backfill for projects where the catch-up migration was applied with is_active
ALTER TABLE public.merchant_departments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.merchant_departments
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.merchant_departments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'merchant_departments'
       AND policyname = 'merchant_departments_rls'
  ) THEN
    CREATE POLICY "merchant_departments_rls" ON public.merchant_departments
      FOR ALL USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- ── merchant_business_settings ──

CREATE TABLE IF NOT EXISTS public.merchant_business_settings (
  merchant_id UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  store_name TEXT,
  receipt_header TEXT,
  receipt_footer TEXT,
  theme TEXT,
  extras_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_business_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'merchant_business_settings'
       AND policyname = 'merchant_business_settings_rls'
  ) THEN
    CREATE POLICY "merchant_business_settings_rls" ON public.merchant_business_settings
      FOR ALL USING (
        merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Note: do NOT add Finix/Supabase keys or any secret to this table — it
-- replicates to every register.
