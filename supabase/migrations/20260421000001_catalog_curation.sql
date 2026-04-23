-- Migration: Catalog curation overlay + audit trail
--
-- Adds curated overlay columns to catalog_products so the admin dashboard
-- can promote merchant-validated values without overwriting the NYSLA source data.
-- Creates catalog_product_alt_skus, catalog_revision, catalog_curation_log,
-- and a bump_catalog_revision() RPC callable by the service-role key only.

-- ── 1. Curated overlay columns on catalog_products ──

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS curated_sku TEXT,
  ADD COLUMN IF NOT EXISTS curated_barcode TEXT,
  ADD COLUMN IF NOT EXISTS curated_size TEXT,
  ADD COLUMN IF NOT EXISTS curated_cost NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS curated_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS curated_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS curation_source_merchant_id UUID,
  ADD COLUMN IF NOT EXISTS curation_notes TEXT;

-- ── 2. catalog_product_alt_skus ──

CREATE TABLE IF NOT EXISTS public.catalog_product_alt_skus (
  catalog_product_id INTEGER NOT NULL REFERENCES public.catalog_products (id) ON DELETE CASCADE,
  alt_sku TEXT NOT NULL,
  PRIMARY KEY (catalog_product_id, alt_sku)
);

ALTER TABLE public.catalog_product_alt_skus ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'catalog_product_alt_skus'
       AND policyname = 'alt_skus_select'
  ) THEN
    CREATE POLICY "alt_skus_select" ON public.catalog_product_alt_skus
      FOR SELECT USING (true);
  END IF;
END $$;

-- ── 3. catalog_revision (single-row monotonic counter) ──

CREATE TABLE IF NOT EXISTS public.catalog_revision (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  revision_id BIGINT      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_revision (id, revision_id, updated_at)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.catalog_revision ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'catalog_revision'
       AND policyname = 'revision_select'
  ) THEN
    CREATE POLICY "revision_select" ON public.catalog_revision
      FOR SELECT USING (true);
  END IF;
END $$;

-- ── 4. catalog_curation_log (append-only audit trail) ──

CREATE TABLE IF NOT EXISTS public.catalog_curation_log (
  id                 BIGSERIAL PRIMARY KEY,
  catalog_product_id INTEGER     NOT NULL REFERENCES public.catalog_products (id) ON DELETE CASCADE,
  field              TEXT        NOT NULL,
  old_value          TEXT,
  new_value          TEXT,
  source_merchant_id UUID,
  updated_by         TEXT        NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_curation_log_product_idx
  ON public.catalog_curation_log (catalog_product_id);

CREATE INDEX IF NOT EXISTS catalog_curation_log_updated_at_idx
  ON public.catalog_curation_log (updated_at DESC);

ALTER TABLE public.catalog_curation_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Block all anonymous / authenticated access — service_role bypasses RLS
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'catalog_curation_log'
       AND policyname = 'curation_log_service_only'
  ) THEN
    CREATE POLICY "curation_log_service_only" ON public.catalog_curation_log
      FOR ALL USING (false);
  END IF;
END $$;

-- ── 5. bump_catalog_revision() RPC ──

CREATE OR REPLACE FUNCTION public.bump_catalog_revision()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.catalog_revision
     SET revision_id = revision_id + 1,
         updated_at  = now()
   WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_catalog_revision() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_catalog_revision() TO service_role;
