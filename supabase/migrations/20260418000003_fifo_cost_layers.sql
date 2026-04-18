-- W6: FIFO cost tracking primitives
-- 1) Persist per-line COGS on cloud transaction items
-- 2) Add merchant product cost layers for cross-register recovery

ALTER TABLE public.merchant_transaction_items
  ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC;

ALTER TABLE public.merchant_transaction_items
  ADD COLUMN IF NOT EXISTS cost_basis_source TEXT DEFAULT 'fifo_layer';

CREATE TABLE IF NOT EXISTS public.merchant_product_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  cost_per_unit NUMERIC NOT NULL,
  source TEXT,
  source_reference TEXT,
  device_id UUID REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, product_sku, received_at, device_id)
);

ALTER TABLE public.merchant_product_cost_layers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_product_cost_layers'
      AND policyname = 'Merchants manage own cost layers'
  ) THEN
    CREATE POLICY "Merchants manage own cost layers"
      ON public.merchant_product_cost_layers
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_merchant_cost_layers_lookup
  ON public.merchant_product_cost_layers(merchant_id, product_sku, received_at, id);
