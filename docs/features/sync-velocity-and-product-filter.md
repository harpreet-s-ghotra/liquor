# Reorder Velocity Without Local History + Product Sync Slimming

**Status:** Implemented
**Date:** 2026-04-24
**Scope:** Two related fixes that fell out of the multi-merchant switch:

1. Restore the Reorder Dashboard for accounts that have no local sales history (the multi-merchant change stopped auto-pulling transactions, so every freshly-switched merchant shows zero velocity → no reorder rows).
2. Make the first-login product reconcile fast and observable: filter to products with a real price, show per-entity progress (`X of Y`, %), and add an on-demand SKU lookup so the skipped zero-price rows are still discoverable when the user adds a new item.

---

## Why

### Problem 1 — Reorder Dashboard is empty after account switch

`getReorderProducts` (`src/main/database/products.repo.ts:950-1024`) computes velocity locally:

```sql
WITH sales_velocity AS (
  SELECT ti.product_id, SUM(ti.quantity) / 365.0 AS velocity_per_day
  FROM transaction_items ti
  INNER JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.status = 'completed' AND t.created_at >= date('now', '-365 days')
  GROUP BY ti.product_id
) ...
```

Since the multi-merchant change dropped `backfillRecentTransactions()` from `runInitialSync()`, a merchant the manager just switched into has **zero rows in `transactions` / `transaction_items`** locally. Velocity collapses to 0 for every product, projected stock equals current stock, and no row drops below the reorder point — so the Reorder tab looks empty even though the cloud knows the store is selling. The local guard `COALESCE(p.retail_price, p.price, 0) > 0` (line 996) further filters anything left.

The user explicitly does not want raw transactions auto-pulled. But what reorder needs is a **single aggregate per product**, not the underlying rows. Pulling aggregates is cheap and does not violate the "no sales history" rule.

### Problem 2 — Initial product sync is slow, opaque, and 98% wasted

A live count against `merchant_products`:

```
total = 24,031
with retail_price > 0 = 493 (~2%)
```

`reconcileProducts()` (`src/main/services/sync/initial-sync.ts:132-222`) pages through **all 24 k** rows on first login. The other 98% are catalog imports the merchant never priced — they exist only so the SKU is reservable. Downloading them all blows the first-run experience.

The existing `SyncProgressModal` (`src/renderer/src/components/common/SyncProgressModal.tsx`) shows entity-level state (`pending / active / done / failed`) but no sub-progress for `products`, which is the slow one. The user wants a percent indicator while it runs.

Zero-price rows still need to be **reachable** — when an operator adds a new item, the system must say "SKU XYZ already exists in your account" without round-tripping to the user. So skip is OK provided we add a cloud lookup at add-time.

---

## Target Behaviour

### Fix 1 — Cloud-aggregated velocity

Reorder Dashboard reads velocity from a per-merchant cloud aggregate, not from local `transaction_items`. Cached in renderer state for the dashboard session.

**Cloud surface:** new RPC `merchant_product_velocity(merchant_id uuid, days int)` returning `(product_sku text, units_sold numeric, velocity_per_day numeric)`. Implemented in a Supabase migration as a SECURITY DEFINER function over `merchant_transactions` + `merchant_transaction_items`. Filtered by `merchant_id` and `created_at >= now() - days`.

**Renderer flow:**

1. `ReorderDashboard` mounts → calls new IPC `inventory:get-reorder-products` (already exists) → main process resolves local product rows + queries the RPC and merges by SKU before returning.
2. If offline / RPC fails → fall back to local velocity calc and show a small "Velocity offline — using cached data" hint.
3. If the response shows zero rows for a merchant that has products but no cloud transactions yet (truly fresh store), show the existing empty-state, not an error.

**Repo change:** in `getReorderProducts`, drop the `sales_velocity` CTE entirely. Move the SQL aggregate to the cloud. The repo accepts an optional `velocityBySku: Map<string, number>` parameter and joins it post-query in JS. This keeps the function callable in tests with no cloud dependency.

**Why aggregated, not raw:** matches the user's intent (no sales-history download), keeps the local DB lean, and avoids re-pulling 365 days of transactions on every account switch. The wire payload is one number per SKU — for 500 priced products this is a few KB.

### Fix 2a — Filter product reconcile to priced rows

Server-side filter on the existing pull at `initial-sync.ts:144-159`:

```ts
let query = supabase
  .from('merchant_products')
  .select('*')
  .eq('merchant_id', merchantId)
  .gt('retail_price', 0)        // NEW
  .order('updated_at', { ascending: true })
  ...
```

Result: 24 k → ~500 rows. Works because:

- Reorder needs a price to compute anything (`retail_price > 0` is already its filter).
- POS sale needs a price.
- The only place a zero-price row matters is "is this SKU taken when I create a new item?" — handled by Fix 2c.

If a row's price later transitions from 0 → >0 in cloud, Realtime delivers it as a normal update — already supported by the existing subscription path.

### Fix 2b — Per-entity progress (% complete)

Extend the existing `useInitialSyncStatus` shape so each entity carries optional `processed` and `total` counts:

```ts
type InitialSyncStatus = {
  state: 'idle' | 'running' | 'done' | 'failed'
  currentEntity: InitialSyncEntity | null
  completed: InitialSyncEntity[]
  errors: Array<{ entity: InitialSyncEntity; message: string }>
  progress: Partial<Record<InitialSyncEntity, { processed: number; total: number }>> // NEW
}
```

`reconcileProducts()` emits a `progress` event after each batch:

```ts
function emitProgress(entity: InitialSyncEntity, processed: number, total: number) {
  // existing event channel — add a new event type
  mainWindow.webContents.send('initial-sync:progress', { entity, processed, total })
}
```

`SyncProgressModal` renders the % and a thin progress bar on the active entity row only. Other rows stay at the existing icon-only state. The `total` for products is captured up-front via a single `count` query before paging starts:

```ts
const { count: productsTotal } = await supabase
  .from('merchant_products')
  .select('*', { count: 'exact', head: true })
  .eq('merchant_id', merchantId)
  .gt('retail_price', 0)
emitProgress('products', 0, productsTotal ?? 0)
```

Same `count(head: true)` trick works for any other entity that turns out to be slow later — only wire it for products in this pass.

### Fix 2c — On-demand SKU existence lookup

When the user adds a new item in `ItemForm`, the SKU input gets a debounced cloud lookup:

- New IPC `inventory:check-sku-exists(sku: string) → { exists: boolean, source: 'local' | 'cloud' }`.
- Main process first checks local `products.sku` (cheap, indexed). If found → `{ exists: true, source: 'local' }`. If not → query Supabase: `select 1 from merchant_products where merchant_id = ? and sku = ? limit 1`.
- Renderer surfaces "SKU already exists in your catalog" inline next to the field — same component pattern as the existing field validation.

If the user wants to load that hidden zero-price row into the local DB to edit it, add a small `Pull from cloud` action in the inline error: confirms → calls `inventory:pull-product-by-sku(sku)` → main fetches the single row from `merchant_products` and runs it through the existing `applyRemoteProductChange` path. One row, no batch.

---

## Architecture Changes

### Cloud (new Supabase migration)

`supabase/migrations/<ts>_merchant_product_velocity_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.merchant_product_velocity(
  p_merchant_id uuid,
  p_days integer
)
RETURNS TABLE (product_sku text, units_sold numeric, velocity_per_day numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mti.product_sku,
    SUM(mti.quantity)::numeric AS units_sold,
    (SUM(mti.quantity)::numeric / GREATEST(p_days, 1)::numeric) AS velocity_per_day
  FROM merchant_transaction_items mti
  INNER JOIN merchant_transactions mt ON mt.id = mti.transaction_id
  WHERE mt.merchant_id = p_merchant_id
    AND mt.status = 'completed'
    AND mt.created_at >= now() - (p_days || ' days')::interval
  GROUP BY mti.product_sku;
$$;
```

RLS notes: `SECURITY DEFINER` is required because the renderer-facing role won't have direct read on `merchant_transactions`. The function locks scope to the passed `merchant_id`; the caller's session context must already match. Validate via the existing tenant check helper (or add `auth.uid()` check inside the function — confirm during implementation against the project's RLS pattern).

### Main process

| File                                            | Change                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/sync/initial-sync.ts:144`    | Add `.gt('retail_price', 0)` filter; add `count(head: true)` pre-query; emit `progress`                                                                 |
| `src/main/services/sync/initial-sync.ts`        | Extend `InitialSyncStatus` with per-entity progress map; thread through existing emitter                                                                |
| `src/main/services/sync/product-sync.ts`        | New `pullSingleProductBySku(supabase, merchantId, sku)` for the on-demand lookup                                                                        |
| `src/main/services/sync/velocity-sync.ts` (new) | `fetchVelocityBySku(supabase, merchantId, days)` calls the RPC, returns `Map<sku, vel>`                                                                 |
| `src/main/database/products.repo.ts:950-1024`   | `getReorderProducts` accepts optional `velocityBySku`, drops the local CTE                                                                              |
| `src/main/index.ts`                             | New IPC: `inventory:check-sku-exists`, `inventory:pull-product-by-sku`. Update `inventory:get-reorder-products` to fetch velocity from cloud and merge. |
| `src/preload/index.ts` + `index.d.ts`           | Expose the two new IPCs                                                                                                                                 |

### Renderer

| File                                                                 | Change                                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/hooks/useInitialSyncStatus.ts`                     | Subscribe to `initial-sync:progress`; keep latest `{processed,total}` per entity                          |
| `src/renderer/src/components/common/SyncProgressModal.tsx`           | When `currentEntity` has progress, render `processed / total · X%` + thin `<progress>`                    |
| `src/renderer/src/components/inventory/items/ItemForm.tsx`           | Debounced SKU lookup on the SKU field; render inline existence warning + pull-from-cloud action           |
| `src/renderer/src/components/inventory/reorder/ReorderDashboard.tsx` | No UI change — velocity arrives via the existing `inventory:get-reorder-products` IPC; offline hint added |

### Types

`src/shared/types/index.ts`:

```ts
export type InitialSyncProgressEvent = {
  entity: InitialSyncEntity
  processed: number
  total: number
}

// Extend the existing status type
export type InitialSyncStatus = {
  // existing fields...
  progress: Partial<Record<InitialSyncEntity, { processed: number; total: number }>>
}

export type SkuExistenceResult = { exists: boolean; source: 'local' | 'cloud' }
```

---

## Tests

### Cloud RPC

- `supabase/tests/merchant_product_velocity.sql` — seed 2 merchants, 5 transactions each over various dates, call the RPC for one merchant + 30 days, assert SUM/divide math and zero cross-leak from the other merchant.

### Backend

- `initial-sync.test.ts` — `reconcileProducts` pulls only `retail_price > 0` rows (mock Supabase responses verify the `.gt` filter is sent).
- `initial-sync.test.ts` — emits `progress` events with monotonically increasing `processed`, hits `processed === total` at end.
- `velocity-sync.test.ts` (new) — RPC returns map keyed by SKU; offline/error returns null and the caller falls back.
- `products.repo.test.ts` — `getReorderProducts` with an injected `velocityBySku` map produces the expected `velocity_per_day`, `days_of_supply`, `projected_stock`. Without a map, velocity is 0 for every row (regression for offline path).
- `index.test.ts` (or wherever IPC handlers are tested) — `inventory:check-sku-exists` returns `local` when SKU is in `products`, hits cloud only on miss, returns `cloud` when found there, returns `{ exists: false }` when neither has it.
- `pullSingleProductBySku` — fetches and applies a single cloud row via `applyRemoteProductChange`.

### Renderer

- `useInitialSyncStatus.test.ts` — receives `initial-sync:progress` events, updates the right entity slot.
- `SyncProgressModal.test.tsx` — when products is active with `processed=120 total=500`, renders "120 / 500 · 24%" and a `<progress value=120 max=500>`.
- `ItemForm.test.tsx` — typing a SKU triggers debounced `checkSkuExists`; when `exists`, renders the inline warning; clicking `Pull from cloud` calls `pullProductBySku` and reloads the form.
- `ReorderDashboard.test.tsx` — when `getReorderProducts` returns rows with `velocity_per_day > 0` the table shows them; when the velocity RPC fails, the offline hint renders and rows still appear with `velocity_per_day=0`.

### E2E

- Sign in fresh as Merchant B (no local DB) → SyncProgressModal appears → products row shows `0 / N · 0%` → progresses → `done` → modal closes.
- Open Reorder Dashboard → confirm rows appear for any product whose cloud velocity puts it under reorder point (seed test data accordingly).
- Inventory → New Item → type a SKU known to be a zero-price cloud-only row → see the existence warning → click `Pull from cloud` → form populates with the cloud row.

---

## Risks

- **Cloud RPC permission model.** SECURITY DEFINER opens a small attack surface; the function must validate `auth.uid()` belongs to a user with access to `p_merchant_id`. Reuse whatever helper the project already has for this — do not write a new one.
- **Velocity divergence vs old behaviour.** Today's local CTE counts only transactions present on this register. The cloud aggregate counts all transactions for the merchant across all registers. That's actually more correct — multi-register stores were under-counting before. Worth calling out in the changelog.
- **Zero-price rows still in the way.** A zero-price row created locally and pushed to cloud would make the post-skip world inconsistent. Confirm by spot-check that the renderer can't save a product with `retail_price = 0` (the current `ItemForm` validation should already block this; verify during implementation).
- **Offline first run.** If the very first login has no internet, the reconcile completes with empty data and the user lands in `pos`. The progress modal already handles this — confirm the new `progress` events don't crash when `total = 0`.
- **Count query cost.** `count(head: true)` on `merchant_products` for 24 k rows is ~50 ms. Acceptable. Skip if it ever shows up in profiling.

---

## Verification

1. `npx prettier --write .` / `npm run lint` / `npx stylelint "src/**/*.css"` / `npm run typecheck`
2. `npm run test:coverage` ≥ 80%
3. `npm run test:e2e`
4. `npx supabase db push` to apply the velocity RPC migration; verify with `npx supabase db query --linked "SELECT * FROM merchant_product_velocity('<merchant_id>', 30) LIMIT 5;"`
5. Manual:
   - Sign out → sign in as a merchant on a fresh install → SyncProgressModal renders, products row counts up to ~500 (not 24 000) with a visible progress bar reaching 100%.
   - Open Reorder Dashboard immediately after sync completes → rows appear with non-zero `velocity_per_day` and a `days_of_supply` value where applicable.
   - Create a draft PO from a reorder row → confirm prefill works (regression check).
   - Inventory → New Item → enter a SKU that exists in cloud as zero-price → warning appears within ~400 ms → `Pull from cloud` populates the form.
   - Disable network → reload Reorder → offline hint appears, table still renders local products with velocity 0.
   - Inspect `merchant_products` count locally vs cloud — local should be ~2% of cloud, matching the price filter.

---

## Out of Scope

- Removing the local `transaction_items` velocity path entirely. Keep it as the offline fallback.
- Pre-warming the cloud RPC result before the dashboard mounts. Trigger on demand only.
- Multi-window-size velocity (e.g. 7-day vs 30-day). Reorder uses 365 today; preserve.
- Migrating the Sales History panel — already opt-in.
