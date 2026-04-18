-- W2.4: Cloud sync table for merchant business settings.
-- Hot-field columns for settings that need cross-register consistency.
-- extras_json holds any future free-form settings.
--
-- Security note: Finix API keys, Supabase service-role keys, and any other secrets
-- MUST NOT be added to this table. It replicates to every register belonging to the
-- merchant, so any secret here would be exposed to every authenticated device.
-- Keep Finix credentials in the local device_config table only.
--
-- Device-specific settings (printer device ID, terminal serial, per-register
-- calibration) also MUST NOT appear here. They belong in local-only device_config.

CREATE TABLE IF NOT EXISTS public.merchant_business_settings (
  merchant_id UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  store_name TEXT,
  receipt_header TEXT,
  receipt_footer TEXT,
  theme TEXT,
  extras_json JSONB NOT NULL DEFAULT '{}',
  device_id UUID REFERENCES public.registers(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.merchant_business_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_business_settings'
      AND policyname = 'Merchants manage own business settings'
  ) THEN
    CREATE POLICY "Merchants manage own business settings"
      ON public.merchant_business_settings
      FOR ALL
      USING (
        merchant_id IN (
          SELECT id FROM public.merchants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
