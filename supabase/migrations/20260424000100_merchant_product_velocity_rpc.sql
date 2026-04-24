CREATE OR REPLACE FUNCTION public.merchant_product_velocity(
  p_merchant_id uuid,
  p_days integer
)
RETURNS TABLE (
  product_sku text,
  units_sold numeric,
  velocity_per_day numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mti.product_sku,
    SUM(mti.quantity)::numeric AS units_sold,
    (
      SUM(mti.quantity)::numeric / GREATEST(COALESCE(p_days, 0), 1)::numeric
    ) AS velocity_per_day
  FROM public.merchant_transaction_items mti
  INNER JOIN public.merchant_transactions mt ON mt.id = mti.transaction_id
  WHERE mt.merchant_id = p_merchant_id
    AND mt.status = 'completed'
    AND mt.created_at >= now() - (GREATEST(COALESCE(p_days, 0), 1) || ' days')::interval
    AND mt.merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  GROUP BY mti.product_sku;
$$;

REVOKE ALL ON FUNCTION public.merchant_product_velocity(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_product_velocity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_product_velocity(uuid, integer) TO service_role;
