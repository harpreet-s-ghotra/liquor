-- Re-introduce optional expiry on special pricing rules. Rules with a past
-- expires_at are filtered out by the pricing engine on the device. NULL means
-- the rule never expires.
--
-- The column was previously named duration_days and was dropped in
-- 20260421000000. This time we use an absolute timestamp so devices in
-- different timezones agree on when a promo ends.

ALTER TABLE public.merchant_special_pricing
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.merchant_special_pricing.expires_at IS
  'Optional cutoff for the special pricing rule. NULL = no expiration.';
