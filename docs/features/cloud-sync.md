# Cloud Sync — Multi-Register Transaction & Inventory Sync

> Phase B of the cloud integration. Adds multi-register support via Supabase Realtime, with offline-capable sync queue and delta-based inventory tracking.

## Implementation Status

### Phase 1: Infrastructure — Complete

- [x] `device_config` SQLite table (singleton — device UUID, name, fingerprint)
- [x] `sync_queue` SQLite table (entity_type, operation, payload, status, retry tracking)
- [x] `device_id` and `synced_at` columns added to `transactions` table
- [x] `device-config.repo.ts` — get/save/clear device config
- [x] `sync-queue.repo.ts` — enqueue, getPending, markInFlight, markDone, markFailed, retryFailed, recoverInFlight, getQueueStats
- [x] `connectivity.ts` — Electron `net.isOnline()` polling, listener pattern
- [x] `device-registration.ts` — registers terminal with Supabase `registers` table (upsert by fingerprint)
- [x] `sync-worker.ts` — background queue drain loop, Realtime subscription setup, exponential backoff retry
- [x] `supabase.ts` — exposed `getSupabaseClient()` and `getMerchantCloudId()`
- [x] IPC channels: `sync:get-status`, `sync:get-device-config`, `sync:connectivity-changed` (event)
- [x] Preload + type definitions for sync IPC
- [x] Startup wiring: connectivity monitor + sync worker auto-start after auth

### Phase 2: Transaction Sync — Complete

- [x] `sync/transaction-sync.ts` — uploads transactions to `merchant_transactions` + `merchant_transaction_items`
- [x] `sync/types.ts` — cloud payload types (TransactionSyncPayload, CloudTransactionPayload)
- [x] `transactions.repo.ts` modified to enqueue sync items after every save (sale + refund)
- [x] Product SKU lookup for sync payload (cloud uses SKUs, not local IDs)
- [x] Realtime subscription on `merchant_transactions` for receiving other registers' transactions
- [x] Echo suppression (skip own device_id) + dedup by transaction_number
- [x] Remote transaction items fetched and inserted with local product_id lookup by SKU

### Phase 3: Inventory/Product Sync — In Progress

- [x] Schema: `inventory_deltas` local SQLite table + `cloud_id`/`synced_at`/`last_modified_by_device` columns on `products`
- [x] `inventory-deltas.repo.ts` — recordDelta, getUnsyncedDeltas, markDeltaSynced
- [x] Sync types: `ProductSyncPayload`, `CloudProductPayload`, `InventoryDeltaSyncPayload`, `CloudInventoryDeltaPayload`
- [x] `product-sync.ts` — uploadProduct (upsert by merchant_id+sku), applyRemoteProductChange (LWW by updated_at)
- [x] `inventory-delta-sync.ts` — uploadInventoryDelta (append-only INSERT to cloud)
- [x] `initial-sync.ts` — full product reconciliation on first connect/reconnect (cursor-based pagination, LWW via updated_at, uploads local-only products)
- [x] `products.repo.ts` — enqueue product sync after saveInventoryItem, record inventory_delta on stock change
- [x] `transactions.repo.ts` — record inventory_delta (reason='sale'/'refund') after stock decrement
- [x] Supabase tables: `merchant_products`, `inventory_deltas`, `merchant_product_alt_skus`, `merchant_special_pricing`
- [ ] Postgres trigger: `trg_apply_inventory_delta` — materializes stock from deltas
- [x] Sync worker: dispatch `product` + `inventory_delta` entity types, Realtime subscriptions

### Phase 4: Full Entity Sync — Complete

- [x] Sync types: `CloudItemTypePayload`, `ItemTypeSyncPayload`, `CloudTaxCodePayload`, `TaxCodeSyncPayload`, `CloudCashierPayload`, `CashierSyncPayload`, `CloudDistributorPayload`, `DistributorSyncPayload` in `sync/types.ts`
- [x] `item-type-sync.ts` — upload (upsert by merchant_id+name) + applyRemoteItemTypeChange (LWW; propagates name renames to products table)
- [x] `tax-code-sync.ts` — upload (upsert by merchant_id+code) + applyRemoteTaxCodeChange (LWW)
- [x] `distributor-sync.ts` — upload (upsert by merchant_id+distributor_number) + applyRemoteDistributorChange (LWW)
- [x] `cashier-sync.ts` — upload (upsert by merchant_id+pin_hash) + applyRemoteCashierChange (LWW); includes pin_hash for cross-register PIN validation
- [x] Enqueue hooks in: `item-types.repo.ts`, `tax-codes.repo.ts`, `cashiers.repo.ts`, `distributors.repo.ts` (create/update/delete, delete enqueued before row removal)
- [x] Sync worker: dispatch cases for `item_type`, `tax_code`, `cashier`, `distributor` + Realtime subscriptions on all four tables
- [x] Supabase tables: `merchant_item_types`, `merchant_tax_codes`, `merchant_cashiers`, `merchant_distributors`

### Renderer: Sync Indicator — In Progress

- [ ] `SyncIndicator.tsx` + `sync-indicator.css` — green/yellow/red dot in HeaderBar
- [ ] `SyncIndicator.test.tsx` — unit tests
- [ ] Embed in `HeaderBar.tsx`
- [ ] E2E mock updates: add `getSyncStatus` and `onConnectivityChanged` to all test mocks
- [x] `last_synced_at` tracking in sync worker + `sync:get-status` IPC handler

---

## Architecture

### Hub-and-Spoke Model

```
Register A: Local change -> SQLite -> sync_queue -> [Background Worker] -> Supabase
                                                                            |
                                                                      Realtime event
                                                                            |
Register B: Realtime listener -> Apply to local SQLite (skip own events)
```

- **SQLite** is the primary store on each register (fast, offline-capable)
- **Supabase** is the central hub
- **Background sync worker** drains the queue when online
- **Supabase Realtime** pushes changes to all registers
- Each register ignores its own echoed events via `device_id`

### Data Flow

1. User completes a sale on Register A
2. `saveTransaction()` writes to local SQLite
3. After the SQLite write, `enqueueTransactionSync()` adds the transaction to `sync_queue`
4. The sync worker picks up the item and uploads it to `merchant_transactions` in Supabase
5. Supabase Realtime fires a `postgres_changes` event
6. Register B's Realtime listener receives the event, checks `device_id` (not its own), checks `transaction_number` (not a duplicate), and inserts into its local SQLite

### Offline Behavior

- When offline, all local writes proceed normally against SQLite
- Each write also inserts into `sync_queue` with status `pending`
- When connectivity returns, the worker wakes up and drains the queue in FIFO order
- The queue is persisted in SQLite, so it survives app restarts
- On startup, any items left `in_flight` from a crash are recovered to `pending`

### Retry Strategy

- Max 5 retry attempts per sync queue item
- Exponential backoff: 1s, 4s, 16s, 64s, 256s
- Network errors are retried; validation errors are logged but not retried
- After 5 failures: marked `failed`, requires manual resync

---

## Supabase Tables

### To Create (Run in Supabase SQL Editor)

#### `registers` table

```sql
CREATE TABLE registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, device_fingerprint)
);

ALTER TABLE registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own registers"
  ON registers FOR ALL
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

#### `merchant_transactions` table

```sql
CREATE TABLE merchant_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  local_id INTEGER NOT NULL,
  transaction_number TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  payment_method TEXT,
  finix_authorization_id TEXT,
  finix_transfer_id TEXT,
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

ALTER TABLE merchant_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own transactions"
  ON merchant_transactions FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE INDEX idx_merchant_txn_merchant ON merchant_transactions(merchant_id);
CREATE INDEX idx_merchant_txn_number ON merchant_transactions(transaction_number);
```

Legacy note: if an older Supabase project already has `merchant_transactions` with a required
`sold_at` column from an earlier draft, drop that `NOT NULL` constraint or give it a default.
The current sync worker writes `created_at`, not `sold_at`.

#### `merchant_transaction_items` table

```sql
CREATE TABLE merchant_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES merchant_transactions(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

ALTER TABLE merchant_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own transaction items"
  ON merchant_transaction_items FOR ALL
  USING (transaction_id IN (
    SELECT id FROM merchant_transactions WHERE merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_merchant_txn_items_txn ON merchant_transaction_items(transaction_id);
```

### Realtime Configuration

Enable Realtime on these tables in the Supabase Dashboard:

1. Go to Database -> Replication
2. Enable the `supabase_realtime` publication for:
   - `merchant_transactions`
   - (Phase 3: `merchant_products`, `inventory_deltas`)

- (Phase 4: `merchant_item_types`, `merchant_tax_codes`, `merchant_cashiers`, `merchant_distributors`)

---

## New IPC Channels

| Channel                     | Direction    | Returns                |
| --------------------------- | ------------ | ---------------------- |
| `sync:get-status`           | invoke       | `SyncStatus`           |
| `sync:get-device-config`    | invoke       | `DeviceConfig \| null` |
| `sync:connectivity-changed` | event (push) | `boolean`              |

---

## File Map

```
src/main/
  database/
    device-config.repo.ts          (new)
    sync-queue.repo.ts             (new)
    schema.ts                      (modified — new tables + columns)
    transactions.repo.ts           (modified — enqueue sync on save)
    index.ts                       (modified — re-exports new repos)
  services/
    connectivity.ts                (new)
    device-registration.ts         (new)
    sync-worker.ts                 (new)
    supabase.ts                    (modified — getSupabaseClient, getMerchantCloudId)
    sync/
      transaction-sync.ts          (new)
      types.ts                     (new)
src/shared/types/index.ts         (modified — DeviceConfig, SyncQueueItem, SyncStatus)
src/preload/index.ts              (modified — sync IPC methods)
src/preload/index.d.ts            (modified — sync type declarations)
```

---

## Design Decisions

### Why SQLite as primary + Supabase as hub (not the reverse)?

POS terminals must work offline. If Supabase is down or the internet drops, the store still needs to ring up sales. SQLite is synchronous, local, and never fails due to network issues. Supabase serves as the cloud backup and cross-register sync layer.

### Why transaction_number instead of local ID for cross-register references?

Local SQLite auto-increment IDs are not globally unique. Two registers could both have transaction ID 42. The `transaction_number` (format: `TXN-{timestamp}-{random}`) is globally unique and used as the natural key for dedup across registers.

### Why product SKU (not product ID) in cloud transaction items?

Same reason as above — local product IDs are not globally unique. SKU is the stable, cross-register identifier for products.

### Why enqueue inside the repo (not the IPC handler)?

Keeping the enqueue call in the repo ensures it always fires, regardless of how the save is called. It also keeps the sync concern close to the data write, making it harder to accidentally skip.

---

## Phase 3: Inventory/Product Sync — Detailed Design

### Stock Conflict Resolution (Delta-Based)

- **Never sync absolute stock** between registers
- Each register uploads signed deltas only (e.g., sale = -2, refund = +1, manual adjustment = +10)
- Cloud Postgres trigger materializes stock: `UPDATE merchant_products SET in_stock = in_stock + NEW.delta`
- Registers receive materialized stock via Realtime UPDATE events on `merchant_products`
- Result: eventually consistent, commutative (order doesn't matter)

### Product Metadata: Last-Writer-Wins (LWW)

- `updated_at` timestamp is the conflict resolution key
- Remote change applied only if `remote.updated_at > local.updated_at`
- Simple, deterministic, appropriate for POS where concurrent product edits on different registers are rare

### Item Type Compatibility

- The renderer now treats item types as the canonical product classification.
- The existing local `departments` table remains in place as the storage and migration compatibility layer for item type defaults.
- Product saves write the selected item type into both `item_type` and legacy `dept_id` fields so older reports and sync consumers keep working during the transition.

### Local SQLite Changes

**New table — `inventory_deltas`:**

```sql
CREATE TABLE IF NOT EXISTS inventory_deltas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  product_sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'refund', 'manual_adjustment', 'receiving')),
  reference_id TEXT,
  device_id TEXT,
  synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

**New columns on `products`:** `cloud_id TEXT`, `synced_at DATETIME`, `last_modified_by_device TEXT`

### New Files

| File                                             | Purpose                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/main/database/inventory-deltas.repo.ts`     | recordDelta, getInventoryDeltaSyncPayload, getUnsyncedDeltas, markDeltaSynced, getDeltasByProduct |
| `src/main/services/sync/product-sync.ts`         | uploadProduct (upsert by merchant_id+sku), applyRemoteProductChange (LWW)                         |
| `src/main/services/sync/inventory-delta-sync.ts` | uploadInventoryDelta (append-only INSERT)                                                         |
| `src/main/services/sync/initial-sync.ts`         | Full product reconciliation on first connect/reconnect                                            |

### Modified Files

| File                                     | Changes                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/main/database/schema.ts`            | Add `inventory_deltas` table, `cloud_id`/`synced_at`/`last_modified_by_device` on products               |
| `src/main/database/products.repo.ts`     | Enqueue product sync after save/delete, record inventory_delta on stock change                           |
| `src/main/database/transactions.repo.ts` | Record inventory_delta (reason='sale'/'refund') after stock decrement and queue sync uploads             |
| `src/main/services/sync/types.ts`        | Add ProductSyncPayload, CloudProductPayload, InventoryDeltaSyncPayload, CloudInventoryDeltaPayload       |
| `src/main/services/sync-worker.ts`       | Dispatch 'product' + 'inventory_delta', Realtime subscription on merchant_products, track last_synced_at |

### Enqueue Pattern (products.repo.ts)

After `saveInventoryItem()` completes:

1. Read previous `in_stock` before the transaction
2. Enqueue product sync in try/catch (silent failure — never blocks saves)
3. If `in_stock` changed, call `recordDelta({ reason: 'manual_adjustment', delta: new - old })` and enqueue delta sync

After `deleteInventoryItem()`: enqueue with operation `'DELETE'`.

### Enqueue Pattern (transactions.repo.ts)

In `saveTransaction()`, after stock decrement loop:

- For each item, INSERT into local `inventory_deltas` (reason='sale', delta=-quantity)
- Enqueue each delta to sync_queue after transaction succeeds

In `saveRefundTransaction()`: same with reason='refund', delta=+quantity.

---

## Phase 4: Full Entity Sync — Detailed Design

### Generic Entity Syncer Factory

All four entity types (departments, tax codes, cashiers, distributors) follow an identical pattern:

- Upsert to cloud by natural key
- LWW on receive (by `updated_at`)
- Soft delete (`is_deleted = 1`)

A factory function `uploadEntity<T>(config)` avoids four copies of the same code:

```typescript
type EntitySyncConfig<TCloud> = {
  cloudTable: string
  naturalKeyConflict: string // e.g. 'merchant_id,name'
  toCloud: (merchantId: string, deviceId: string, entity: unknown) => TCloud
}
```

### Local SQLite Changes

Add to all entity tables: `cloud_id TEXT`, `synced_at DATETIME`, `last_modified_by_device TEXT`

### New Files

| File                                    | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `src/main/services/sync/entity-sync.ts` | Generic `uploadEntity` factory + concrete configs for each entity |

### Modified Files

| File                                     | Changes                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `src/main/database/schema.ts`            | Add cloud sync columns to departments, tax_codes, cashiers, distributors      |
| `src/main/database/departments.repo.ts`  | Enqueue after create/update/delete                                            |
| `src/main/database/tax-codes.repo.ts`    | Enqueue after create/update/delete                                            |
| `src/main/database/cashiers.repo.ts`     | Enqueue after create/update/delete (include pin_hash in payload)              |
| `src/main/database/distributors.repo.ts` | Enqueue after create/update/delete                                            |
| `src/main/services/sync-worker.ts`       | Dispatch all entity types, Realtime subscriptions for all merchant\_\* tables |

### Cashier Sync — Special Handling

- `pin_hash` must be included in sync payload for cross-register PIN validation
- `pin_hash` is NOT on the returned `Cashier` type, so it's fetched separately from DB
- UNIQUE constraint on `(merchant_id, pin_hash)` in cloud `merchant_cashiers` prevents PIN collisions

### Remote Entity Handler

For each entity type in the sync worker:

1. Skip if `row.device_id === localDeviceId` (echo suppression)
2. LWW by `updated_at` — skip if local is newer
3. Upsert into local SQLite
4. Set `cloud_id`, `synced_at`, `last_modified_by_device`

---

## Sync Indicator UI — Detailed Design

### Component: `SyncIndicator`

| State   | Dot Color                          | Label         | Trigger                          |
| ------- | ---------------------------------- | ------------- | -------------------------------- |
| online  | Green (`--semantic-success-text`)  | "Synced"      | `online=true`, `pending_count=0` |
| pending | Yellow (`--semantic-warning-text`) | "Syncing (N)" | `online=true`, `pending_count>0` |
| offline | Red (`--semantic-danger-text`)     | "Offline"     | `online=false`                   |

- Polls `window.api.getSyncStatus()` every 5 seconds
- Listens to `window.api.onConnectivityChanged()` for immediate offline/online transitions
- Pulse animation on pending dot (functional feedback, not decorative)
- Embedded in `HeaderBar.tsx` inside `header-bar__left` after "Register Active"

### BEM CSS

- Block: `sync-indicator`
- Elements: `sync-indicator__dot`, `sync-indicator__label`
- Modifiers: `sync-indicator__dot--online`, `sync-indicator__dot--pending`, `sync-indicator__dot--offline`

### last_synced_at Tracking

- Module-level variable in `sync-worker.ts`, set after each successful `markDone()`
- Exported via `getLastSyncedAt()`, consumed by `sync:get-status` IPC handler

---

## Supabase Tables — Phase 3 & 4

### `merchant_products`

```sql
CREATE TABLE merchant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC,
  retail_price NUMERIC NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 0,
  tax_1 NUMERIC,
  tax_2 NUMERIC,
  dept_id TEXT,
  distributor_number INTEGER,
  bottles_per_case INTEGER DEFAULT 12,
  case_discount_price NUMERIC,
  special_pricing_enabled INTEGER DEFAULT 0,
  special_price NUMERIC,
  barcode TEXT,
  is_active INTEGER DEFAULT 1,
  item_type TEXT,
  size TEXT,
  case_cost NUMERIC,
  brand_name TEXT,
  proof NUMERIC,
  alcohol_pct NUMERIC,
  vintage TEXT,
  ttb_id TEXT,
  device_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, sku)
);

ALTER TABLE merchant_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_products_rls" ON merchant_products
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `merchant_product_alt_skus`

```sql
CREATE TABLE merchant_product_alt_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  alt_sku TEXT NOT NULL,
  UNIQUE(merchant_id, product_sku, alt_sku)
);

ALTER TABLE merchant_product_alt_skus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_product_alt_skus_rls" ON merchant_product_alt_skus
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `merchant_special_pricing`

```sql
CREATE TABLE merchant_special_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE merchant_special_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_special_pricing_rls" ON merchant_special_pricing
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `inventory_deltas` (Cloud)

```sql
CREATE TABLE inventory_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'refund', 'manual_adjustment', 'receiving')),
  reference_id TEXT,
  device_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory_deltas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_deltas_rls" ON inventory_deltas
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### Postgres Trigger — Materialize Stock from Deltas

```sql
CREATE OR REPLACE FUNCTION trg_apply_inventory_delta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE merchant_products
  SET in_stock = in_stock + NEW.delta,
      updated_at = now()
  WHERE merchant_id = NEW.merchant_id
    AND sku = NEW.product_sku;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_inventory_delta
  AFTER INSERT ON inventory_deltas
  FOR EACH ROW
  EXECUTE FUNCTION trg_apply_inventory_delta();
```

### `merchant_item_types`

```sql
CREATE TABLE merchant_item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_profit_margin NUMERIC DEFAULT 0,
  default_tax_rate NUMERIC DEFAULT 0,
  device_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, name)
);

ALTER TABLE merchant_item_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_item_types_rls" ON merchant_item_types
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `merchant_tax_codes`

```sql
CREATE TABLE merchant_tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  device_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, code)
);

ALTER TABLE merchant_tax_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_tax_codes_rls" ON merchant_tax_codes
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `merchant_cashiers`

```sql
CREATE TABLE merchant_cashiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT DEFAULT 'cashier',
  is_active INTEGER DEFAULT 1,
  device_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, pin_hash)
);

ALTER TABLE merchant_cashiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_cashiers_rls" ON merchant_cashiers
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### `merchant_distributors`

```sql
CREATE TABLE merchant_distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  distributor_name TEXT NOT NULL,
  license_id TEXT,
  serial_number TEXT,
  premises_name TEXT,
  premises_address TEXT,
  is_active INTEGER DEFAULT 1,
  device_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted INTEGER DEFAULT 0,
  UNIQUE(merchant_id, distributor_name)
);

ALTER TABLE merchant_distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant_distributors_rls" ON merchant_distributors
  FOR ALL USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  ));
```

### Realtime Configuration

Enable Realtime on these tables in the Supabase Dashboard (Database > Replication):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_products;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_deltas;
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_item_types;
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_tax_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_cashiers;
ALTER PUBLICATION supabase_realtime ADD TABLE merchant_distributors;
```

---

## Updated File Map

```
src/main/
  database/
    device-config.repo.ts          (Phase 1)
    sync-queue.repo.ts             (Phase 1)
    inventory-deltas.repo.ts       (Phase 3 — new)
    schema.ts                      (modified — inventory_deltas table + sync columns)
    transactions.repo.ts           (modified — record inventory deltas on sale/refund)
    products.repo.ts               (modified — enqueue sync + record deltas on stock change)
    departments.repo.ts            (modified — enqueue sync after CRUD)
    tax-codes.repo.ts              (modified — enqueue sync after CRUD)
    cashiers.repo.ts               (modified — enqueue sync after CRUD, include pin_hash)
    distributors.repo.ts           (modified — enqueue sync after CRUD)
    index.ts                       (modified — re-exports new repos)
  services/
    connectivity.ts                (Phase 1)
    device-registration.ts         (Phase 1)
    sync-worker.ts                 (modified — all entity dispatch + Realtime + last_synced_at)
    supabase.ts                    (Phase 1)
    sync/
      transaction-sync.ts          (Phase 2)
      types.ts                     (modified — product, delta, entity payload types)
      product-sync.ts              (Phase 3 — new)
      inventory-delta-sync.ts      (Phase 3 — new)
      initial-sync.ts              (Phase 3 — new)
      entity-sync.ts               (Phase 4 — new)
src/shared/types/index.ts         (Phase 1 — already has all sync types)
src/preload/index.ts              (Phase 1 — already has sync IPC methods)
src/preload/index.d.ts            (Phase 1 — already has sync type declarations)
src/renderer/src/
  components/layout/
    SyncIndicator.tsx              (Sync Indicator — new)
    sync-indicator.css             (Sync Indicator — new)
    SyncIndicator.test.tsx         (Sync Indicator — new)
    HeaderBar.tsx                  (modified — embed SyncIndicator)
```

---

## Implementation Batches

| Batch | Scope                         | Key Files                                                            |
| ----- | ----------------------------- | -------------------------------------------------------------------- |
| 1     | Schema migrations             | `schema.ts`                                                          |
| 2     | Inventory deltas repo + tests | `inventory-deltas.repo.ts`, `inventory-deltas.repo.test.ts`          |
| 3     | Sync types + upload functions | `types.ts`, `product-sync.ts`, `inventory-delta-sync.ts`             |
| 4     | Enqueue hooks in repos        | `products.repo.ts`, `transactions.repo.ts`                           |
| 5     | Sync worker integration       | `sync-worker.ts`, `index.ts`                                         |
| 6     | Sync Indicator UI             | `SyncIndicator.tsx`, `.css`, `.test.tsx`, `HeaderBar.tsx`, E2E mocks |
| 7     | Documentation                 | This file                                                            |

---

## Out of Scope

- Admin "force resync" button
- Sync conflict viewer/resolver UI
