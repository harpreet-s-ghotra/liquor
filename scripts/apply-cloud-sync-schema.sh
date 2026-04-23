#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

set -a
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in .env" >&2
  exit 1
fi

run_stmt() {
  local sql
  sql="$(cat)"
  npx supabase db query --db-url "$DATABASE_URL" "$sql"
}

run_stmt <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pgcrypto"
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, device_fingerprint)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.registers ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registers'
      AND policyname = 'Merchants manage own registers'
  ) THEN
    CREATE POLICY "Merchants manage own registers"
      ON public.registers
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC,
  retail_price NUMERIC NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 0,
  tax_1 NUMERIC,
  tax_2 NUMERIC,
  dept_id TEXT,
  distributor_number INTEGER,
  bottles_per_case INTEGER DEFAULT 12,
  case_discount_price NUMERIC,
  special_pricing_enabled INTEGER DEFAULT 0,
  special_price NUMERIC,
  barcode TEXT,
  is_active INTEGER DEFAULT 1,
  item_type TEXT,
  size TEXT,
  case_cost NUMERIC,
  brand_name TEXT,
  proof NUMERIC,
  alcohol_pct NUMERIC,
  vintage TEXT,
  ttb_id TEXT,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, sku)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_products'
      AND policyname = 'merchant_products_rls'
  ) THEN
    CREATE POLICY merchant_products_rls
      ON public.merchant_products
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE INDEX IF NOT EXISTS idx_merchant_products_merchant
  ON public.merchant_products(merchant_id)
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_product_alt_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  alt_sku TEXT NOT NULL,
  UNIQUE(merchant_id, product_sku, alt_sku)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_product_alt_skus ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_product_alt_skus'
      AND policyname = 'merchant_product_alt_skus_rls'
  ) THEN
    CREATE POLICY merchant_product_alt_skus_rls
      ON public.merchant_product_alt_skus
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_special_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_special_pricing ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_special_pricing'
      AND policyname = 'merchant_special_pricing_rls'
  ) THEN
    CREATE POLICY merchant_special_pricing_rls
      ON public.merchant_special_pricing
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.inventory_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'refund', 'manual_adjustment', 'receiving')),
  reference_id TEXT,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  created_at TIMESTAMPTZ DEFAULT now()
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.inventory_deltas ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_deltas'
      AND policyname = 'inventory_deltas_rls'
  ) THEN
    CREATE POLICY inventory_deltas_rls
      ON public.inventory_deltas
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE OR REPLACE FUNCTION public.trg_apply_inventory_delta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.merchant_products
  SET in_stock = in_stock + NEW.delta,
      updated_at = now()
  WHERE merchant_id = NEW.merchant_id
    AND sku = NEW.product_sku;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SQL

run_stmt <<'SQL'
DROP TRIGGER IF EXISTS trg_apply_inventory_delta ON public.inventory_deltas
SQL

run_stmt <<'SQL'
CREATE TRIGGER trg_apply_inventory_delta
  AFTER INSERT ON public.inventory_deltas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_inventory_delta()
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_profit_margin NUMERIC DEFAULT 0,
  default_tax_rate NUMERIC DEFAULT 0,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, name)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_item_types ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_item_types'
      AND policyname = 'merchant_item_types_rls'
  ) THEN
    CREATE POLICY merchant_item_types_rls
      ON public.merchant_item_types
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, code)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_tax_codes ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_tax_codes'
      AND policyname = 'merchant_tax_codes_rls'
  ) THEN
    CREATE POLICY merchant_tax_codes_rls
      ON public.merchant_tax_codes
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_cashiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT DEFAULT 'cashier',
  is_active INTEGER DEFAULT 1,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, pin_hash)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_cashiers ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_cashiers'
      AND policyname = 'merchant_cashiers_rls'
  ) THEN
    CREATE POLICY merchant_cashiers_rls
      ON public.merchant_cashiers
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
CREATE TABLE IF NOT EXISTS public.merchant_distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  distributor_name TEXT NOT NULL,
  license_id TEXT,
  serial_number TEXT,
  premises_name TEXT,
  premises_address TEXT,
  is_active INTEGER DEFAULT 1,
  device_id UUID NOT NULL REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, distributor_name)
)
SQL

run_stmt <<'SQL'
ALTER TABLE public.merchant_distributors ENABLE ROW LEVEL SECURITY
SQL

run_stmt <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_distributors'
      AND policyname = 'merchant_distributors_rls'
  ) THEN
    CREATE POLICY merchant_distributors_rls
      ON public.merchant_distributors
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$
SQL

run_stmt <<'SQL'
DO $$
DECLARE
  sync_table TEXT;
BEGIN
  FOREACH sync_table IN ARRAY ARRAY[
    'merchant_products',
    'inventory_deltas',
    'merchant_item_types',
    'merchant_tax_codes',
    'merchant_cashiers',
    'merchant_distributors'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = sync_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', sync_table);
    END IF;
  END LOOP;
END $$
SQL

run_stmt <<'SQL'
NOTIFY pgrst, 'reload schema'
SQL

npx supabase db query --db-url "$DATABASE_URL" -o csv "select table_name from information_schema.tables where table_schema='public' and table_name in ('merchant_products','merchant_product_alt_skus','merchant_special_pricing','inventory_deltas','merchant_item_types','merchant_tax_codes','merchant_cashiers','merchant_distributors') order by table_name"
npx supabase db query --db-url "$DATABASE_URL" -o csv "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('merchant_products','inventory_deltas','merchant_item_types','merchant_tax_codes','merchant_cashiers','merchant_distributors') order by tablename"