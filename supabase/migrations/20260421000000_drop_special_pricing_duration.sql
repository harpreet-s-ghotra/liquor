-- Remove duration_days from merchant_special_pricing.
-- Special pricing rules are now permanent until explicitly deleted.

ALTER TABLE public.merchant_special_pricing
  DROP COLUMN IF EXISTS duration_days;
