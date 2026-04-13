-- RPC called by the upload-catalog.ts script (service role) to efficiently
-- clear all rows before a fresh catalog import. TRUNCATE is much faster than
-- DELETE for large tables and resets the sequence, keeping IDs compact.
CREATE OR REPLACE FUNCTION truncate_catalog_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE catalog_products RESTART IDENTITY;
END;
$$;

-- Only the service role should be able to call this.
REVOKE ALL ON FUNCTION truncate_catalog_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION truncate_catalog_products() TO service_role;
