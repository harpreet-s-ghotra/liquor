-- Adds the third-party delivery service name (e.g. UberEats, DoorDash) to
-- merchant_transactions. Populated only when payment_method = 'account';
-- null otherwise. Lets cloud reports group account-method sales by service.

ALTER TABLE public.merchant_transactions
  ADD COLUMN IF NOT EXISTS account_service_name TEXT;

COMMENT ON COLUMN public.merchant_transactions.account_service_name IS
  'Account-only: third-party delivery service the sale is billed to. Null for cash/credit/debit.';
