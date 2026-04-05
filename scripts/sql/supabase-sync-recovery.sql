-- Run this whole file in the Supabase SQL Editor.
-- After it succeeds, run the local SQLite recovery file:
--   scripts/sql/local-sync-queue-retry.sql

BEGIN;

-- 1) Registers table, if not already created
CREATE TABLE IF NOT EXISTS registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, device_fingerprint)
);

ALTER TABLE registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants manage own registers" ON registers;
CREATE POLICY "Merchants manage own registers"
  ON registers
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- 2) Transactions table expected by the app
CREATE TABLE IF NOT EXISTS merchant_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  local_id INTEGER NOT NULL,
  transaction_number TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  payment_method TEXT,
  stax_transaction_id TEXT,
  card_last_four TEXT,
  card_type TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  original_transaction_number TEXT,
  session_id INTEGER,
  device_id UUID REFERENCES registers(id),
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, transaction_number)
);

ALTER TABLE merchant_transactions
  ADD COLUMN IF NOT EXISTS local_id INTEGER,
  ADD COLUMN IF NOT EXISTS stax_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS session_id INTEGER,
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES registers(id),
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT now();

-- Early cloud schemas used sold_at instead of created_at and required it.
-- The current sync worker sends created_at, so make sold_at optional.
UPDATE merchant_transactions
SET sold_at = COALESCE(sold_at, created_at, now())
WHERE sold_at IS NULL;

ALTER TABLE merchant_transactions
  ALTER COLUMN sold_at DROP NOT NULL,
  ALTER COLUMN sold_at SET DEFAULT now(),
  ALTER COLUMN payment_method DROP NOT NULL;

ALTER TABLE merchant_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants manage own transactions" ON merchant_transactions;
CREATE POLICY "Merchants manage own transactions"
  ON merchant_transactions
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_merchant_txn_merchant
  ON merchant_transactions(merchant_id);

CREATE INDEX IF NOT EXISTS idx_merchant_txn_number
  ON merchant_transactions(transaction_number);

-- 3) Transaction items table expected by the app
CREATE TABLE IF NOT EXISTS merchant_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES merchant_transactions(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

ALTER TABLE merchant_transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants manage own transaction items" ON merchant_transaction_items;
CREATE POLICY "Merchants manage own transaction items"
  ON merchant_transaction_items
  FOR ALL
  USING (
    transaction_id IN (
      SELECT id
      FROM merchant_transactions
      WHERE merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
      )
    )
  );

-- 4) Cloud inventory deltas table expected by the app
CREATE TABLE IF NOT EXISTS inventory_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('sale', 'refund', 'manual_adjustment', 'receiving')
  ),
  reference_id TEXT,
  device_id UUID NOT NULL REFERENCES registers(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_deltas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_deltas_rls ON inventory_deltas;
CREATE POLICY inventory_deltas_rls
  ON inventory_deltas
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'merchant_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE merchant_transactions;
  END IF;
END $$;

-- Force PostgREST / Supabase API schema cache reload so new tables/columns are visible immediately
NOTIFY pgrst, 'reload schema';

-- Optional verification queries
-- Expected:
-- 1) inventory_deltas_table => public.inventory_deltas
-- 2) merchant_transactions column list includes stax_transaction_id, session_id, and device_id
-- 3) sold_at is nullable or has a default and no longer blocks inserts
SELECT to_regclass('public.inventory_deltas') AS inventory_deltas_table;
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchant_transactions'
ORDER BY ordinal_position;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'inventory_deltas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory_deltas;
  END IF;
END $$;