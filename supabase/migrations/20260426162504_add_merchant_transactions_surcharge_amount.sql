-- Adds the card-processing surcharge component to merchant_transactions so
-- multi-register merchants and downstream cloud reports can compute net fee
-- revenue. Cash sales and refunds where no surcharge applies store 0.
--
-- For refund rows the value is stored as a negative number, so:
--   SUM(surcharge_amount) WHERE status IN ('completed', 'refund')
-- yields gross-collected minus refunded fees in a single query.

ALTER TABLE public.merchant_transactions
  ADD COLUMN IF NOT EXISTS surcharge_amount NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.merchant_transactions.surcharge_amount IS
  'Card processing surcharge folded into total. 0 for cash and pre-surcharge rows; negative on refunds that returned a fee.';
