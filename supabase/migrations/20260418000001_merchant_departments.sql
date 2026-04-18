-- W2.3: Cloud sync table for merchant departments (product categories with tax code assignment).
-- Products reference departments via the dept_id TEXT field (name-based reference).
-- Uses name-based dedup: (merchant_id, name) UNIQUE prevents duplicates.
-- Soft-delete: is_deleted = true hides rows without orphaning product dept_id references.
--
-- Security note: this table holds only non-secret metadata. Do NOT add Finix API keys,
-- Supabase service keys, or any device-specific settings here.

CREATE TABLE IF NOT EXISTS public.merchant_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_code_id TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  device_id UUID REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, name)
);

ALTER TABLE public.merchant_departments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_departments'
      AND policyname = 'Merchants manage own departments'
  ) THEN
    CREATE POLICY "Merchants manage own departments"
      ON public.merchant_departments
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Index for merchant-scoped queries ordered by updated_at (used by reconcile cursor pagination)
CREATE INDEX IF NOT EXISTS idx_merchant_departments_merchant_updated
  ON public.merchant_departments(merchant_id, updated_at, id);
