-- Run this against the local SQLite database after the Supabase SQL has been applied.
-- Example:
-- sqlite3 "$HOME/Library/Application Support/liquor-pos/data/liquor-pos.db" < scripts/sql/local-sync-queue-retry.sql

UPDATE sync_queue
SET status = 'pending',
    attempts = 0,
    last_error = NULL
WHERE entity_type IN ('transaction', 'inventory_delta');

SELECT id, entity_type, entity_id, status, attempts, last_error
FROM sync_queue
ORDER BY id DESC;