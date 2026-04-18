# Inventory Improvements Plan

**Status:** Draft plan — not yet implemented. To be reviewed before work begins.
**Date:** 2026-04-17 (revised after edge-case review)
**Scope:** Central catalog curation (merchant→catalog harvesting), disaster-recovery fixes, POS grid hygiene, Favorites, register-scoped reports, FIFO cost layers, onboarding UX polish, modal keyboard-input bug fixes.

---

## Context

Four inventory/catalog pain points surfaced, which together point to one theme: **the line between the vendor-curated catalog and each store's working inventory is blurred**, and the POS grid treats every product row equally regardless of whether it's actually sellable.

1. **Central catalog is read-only and un-curated.** `catalog_products` (Supabase, ~80K NYSLA rows) is imported once at onboarding and never updated. Many rows lack SKU/UPC, have stale costs, or carry a size that never appears as a selectable option in the inventory form (e.g., a wine with `700ml`). There is no tool for Checkoutmain & Co. to curate the central rows and propagate fixes back to stores.
2. **Disaster recovery is partial.** The product-sync layer (`src/main/services/sync/initial-sync.ts` + `product-sync.ts`) correctly restores `merchant_products` (prices, cost, stock, SKUs, alt SKUs, special pricing) on a fresh install. But cashiers, tax codes, distributors, item types, transactions, departments and business settings have **no initial pull** — only forward-going Realtime. A new machine forces PIN recreation, shows product rows with dangling FK references, and has no receipt branding. W2 closes those gaps.
3. **$0 imports clutter the POS grid.** Distributor onboarding inserts thousands of products with `price = 0`; `getProducts()` filters by `is_active = 1` only, so unpriced items appear on the main screen. They cannot be sold until priced.
4. **Favorites tab is automatic and unusable.** `usePosScreen.ts` hard-codes three SKUs and falls back to top-12-by-stock. No UI to set favorites, no persistence.

**Outcome:** a central catalog curated by **harvesting good values from individual merchants** via a local admin tool (merchant → catalog), pushed back out to all other merchants in real time via a store-side diff/apply flow (catalog → merchants), plus full disaster recovery for every merchant-scoped entity, a clean POS grid with a "Needs pricing" workflow, real user-controlled favorites, a "this register only" toggle on reports, FIFO cost-layer tracking for accurate margins, and onboarding polish.

---

## Key Findings from Current Code

- Local products schema: `src/main/database/schema.ts:242-283` — has `cost`, `retail_price`, `price`, `size` (free text), `sku`, `barcode`, `is_active`, and cloud sync columns (`cloud_id`, `synced_at`, `last_modified_by_device`). Alt SKUs live in `product_alt_skus`.
- Supabase tables: `catalog_distributors`, `catalog_products` (global read-only), `merchant_products`, `merchant_product_alt_skus`, `merchant_special_pricing`, `inventory_deltas` (per-merchant). Migration dir: `supabase/migrations/`.
- Distributor import: `src/renderer/src/pages/DistributorOnboardingScreen.tsx` + `scripts/upload-catalog.ts`. Mapping: `sku ← ttb_id`, `size ← item_size + unit_of_measure`, `cost ← bot_price`, `case_cost ← case_price`.
- Bidirectional sync already runs: `src/main/services/sync/{initial-sync,product-sync,inventory-delta-sync,sync-worker}.ts` with LWW on `updated_at`.
- POS grid source: `usePosScreen.ts:61-88` `deriveFilteredProducts`. Backend: `products.repo.ts:27-48` `getProducts`.
- Favorites logic: `usePosScreen.ts:22,45-54` — hard-coded `preferredFavoriteSkus`, no DB column.
- ItemForm size: free-text input (`src/renderer/src/components/inventory/items/ItemForm.tsx:668-671`).

---

## Design Decisions (confirmed)

| Question                                 | Decision                                                                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where does the admin dashboard live?     | **Local-only standalone tool** in the same monorepo (`tools/catalog-admin/`), run via `npm run admin`. Not deployed.                                                                                                                 |
| How is the central catalog curated?      | **Merchant → catalog.** Admin selects a merchant, sees per-product diffs between `catalog_products` and that merchant's `merchant_products`, accepts the merchant's values into the catalog. One merchant at a time → no collisions. |
| Which fields sync from central → stores? | **SKU, barcode/UPC, size, cost, alt SKUs.** **Price never syncs down.**                                                                                                                                                              |
| How do catalog updates propagate?        | **Realtime push.** A Supabase Realtime subscription on `catalog_revision` triggers an immediate `checkCatalogUpdates` on every connected register. Manual "Check for updates" button remains as a fallback.                          |
| How to handle $0 items on the POS grid?  | **Hide from grid, surface in Inventory as "Needs pricing"** filter with count badge. Barcode scan of a $0 item routes differently by role (see W3).                                                                                  |
| Favorites scope?                         | **Merchant-wide, synced** via existing product-sync. New `is_favorite` column.                                                                                                                                                       |
| Register-scoped reports?                 | **Toggle off by default. Persisted per-register** once the user flips it.                                                                                                                                                            |
| Historical transaction backfill window?  | **7 days.** Matches the product's refund policy; longer windows are unnecessary.                                                                                                                                                     |
| Cost tracking for margin reports?        | **FIFO cost layers** per product. Current single-column `cost` is the default / latest cost; COGS for each sale consumes the oldest layer first.                                                                                     |

---

## Workstreams

Ships in **twelve** workstreams, organised into eight phases.

### Phased Release Plan

| Phase | Release theme                    | Workstreams                                             | Why this grouping                                                                                                                  |
| ----- | -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Quick wins                       | W3 (hide $0 + Needs pricing), W5 (register toggle)      | Small, low-risk, user-visible. Zero schema risk.                                                                                   |
| **2** | UX polish                        | W4 (real Favorites), W7 (onboarding + credentials)      | Still low-risk, but touches auth and sync payload (W4's `is_favorite`).                                                            |
| **3** | Disaster recovery                | W2 (full initial sync, settings, departments, backfill) | The most load-bearing sync change. Needs dedicated QA; do not share a release with anything else.                                  |
| **4** | Accurate financials              | W6 (FIFO cost layers)                                   | Changes reporting numbers — needs its own release so accountants and store owners can validate margin reports against expectation. |
| **5** | Security and historical cleanups | W8 (PIN hashing), W9 (retroactive FIFO seeding)         | Post-Phase-3 and Phase-4 cleanup. Can co-ship because both are one-shot data migrations with narrow blast radius.                  |
| **6** | Central catalog                  | W1 (curation admin + Realtime push)                     | Biggest workstream. Needs the merchant sync plumbing from Phase 3 in place first.                                                  |
| **7** | Resilience                       | W10 (offline catchup), W11 (extended refund lookup)     | Edge cases that become real at scale. Both depend on the full sync model being stable.                                             |
| **8** | Extensibility                    | W12 (custom / non-NYSLA distributor catalogs)           | Opens the platform beyond New York. Not urgent, but required before selling into another state.                                    |

Inside each phase, workstreams may ship in parallel if they touch disjoint files. The ordering within the table reflects recommended sequence when parallel is not possible.

---

### W1 — Central catalog: merchant-harvested curation with Realtime push (biggest)

**Direction of data flow — important.** Curation is **merchant → catalog**, not the other way around. Merchants fix their own products over time (a cashier types the correct SKU for that 700ml wine, the owner sets a better barcode, etc.). The admin tool lets Checkoutmain & Co. visit one merchant at a time, see where that merchant's `merchant_products` data disagrees with `catalog_products`, and promote the merchant's better values **into** the catalog. Distribution back to every other merchant is then catalog → stores via Realtime.

Because the admin reviews one merchant at a time, there are **no write collisions in the catalog** — each curated field has at most one pending proposal at any moment.

#### W1.1 Catalog schema — curated overlay + revision log + audit

Create `supabase/migrations/NNNN_catalog_curation.sql`:

- **`catalog_products` gets curated-overlay columns** (nullable; when non-null they override the original NYSLA values on distribution):
  - `curated_sku TEXT`
  - `curated_barcode TEXT`
  - `curated_size TEXT`
  - `curated_cost NUMERIC(12,4)`
  - `curated_updated_at TIMESTAMPTZ`
  - `curated_updated_by TEXT` (admin email)
  - `curation_source_merchant_id UUID` — which merchant's data was promoted in
  - `curation_notes TEXT`
- **`catalog_product_alt_skus`** (new table): `(catalog_product_id UUID FK, alt_sku TEXT, PRIMARY KEY(catalog_product_id, alt_sku))`.
- **`catalog_revision`** (new single-row table): `revision_id BIGINT, updated_at TIMESTAMPTZ`. Trigger bumps on every curated write.
- **`catalog_curation_log`** (new, append-only): `(id, catalog_product_id, field, old_value, new_value, source_merchant_id, updated_by, updated_at)` — every curated change is logged. Required for incident response and revert paths; small cost, large safety net.
- **RLS:** keep `catalog_products` read-only for authenticated users; writes only via service-role key (admin tool).
- **Baseline migration** (separate file, committed first): `20260101000000_baseline_merchant_schema.sql` — capture the current cloud schema for `merchant_products`, `merchant_product_alt_skus`, `merchant_special_pricing`, `merchant_cashiers`, `merchant_tax_codes`, `merchant_distributors`, `merchant_item_types`, `merchant_transactions`, `merchant_transaction_items`, `inventory_deltas`, `trg_apply_inventory_delta`. Without this, a fresh Supabase project cannot be bootstrapped from the repo.

#### W1.2 Local admin tool — merchant→catalog diff UI

Create `tools/catalog-admin/` as a standalone Vite + React app in the monorepo (not bundled into the POS):

- `tools/catalog-admin/package.json` — its own deps.
- Dedicated feature spec: `docs/features/central-catalog-admin.md`.
- `npm run admin` at the repo root launches it on `localhost:5181`.
- Local-only v1: installed only on the maintainer workstation, bound to `127.0.0.1`, and never deployed.
- Operator must sign in with a Supabase account marked `auth.users.app_metadata.is_super_user = true`.
- Privileged Supabase credentials remain local to that workstation and are injected from the existing secret-management flow; they are not committed or distributed via a shared `.env.admin` file.
- **UI flow:**
  1. Top bar: pick a merchant from a searchable dropdown of `merchants`.
  2. Table of that merchant's `merchant_products` joined to `catalog_products` by `ttb_id` / `nys_item`. Columns: product name, field, catalog value, merchant value, status (`match` | `differs` | `merchant_has_value_catalog_missing` | `no_catalog_match`).
  3. Quick filters: "SKU differs", "size differs", "cost differs", "barcode differs", "merchant has alt SKUs catalog doesn't".
  4. Bulk-action controls for large diff sets: "Promote all SKU values where catalog is empty", "Promote all barcode values where merchant matches NYSLA pattern". Per-row "Promote" button for everything else.
  5. Promote = upsert curated column on `catalog_products`, insert rows in `catalog_curation_log`, bump `catalog_revision`.
  6. "Clear curated value" affordance per field — NULLs the `curated_X`, logs the change, bumps revision. Lets admins revert accidental bad curations.
- Reuses `src/renderer/src/components/common/{FormField, ValidatedInput, AppButton}` via path alias — do not rewrite primitives.
- README in `tools/catalog-admin/README.md` covers setup, key rotation, and workflow.

**Example walkthrough** — "Fix the 700ml wine" scenario from the user's original report:

1. Store owner at Merchant A notices a wine shows up without size `700ml`. They open the inventory item in the POS and type `700ml` into the size field.
2. The change syncs to `merchant_products` (existing LWW path).
3. Admin runs `npm run admin`, selects Merchant A, filters to "size differs".
4. The row shows: catalog size = `(empty)`, merchant size = `700ml`.
5. Admin clicks "Promote" → `catalog_products.curated_size = '700ml'`, log row written, revision bumped.
6. All other merchants' registers receive the Realtime push (W1.3), see a diff badge, accept the update, and now have the correct size without anyone at those stores typing it.

#### W1.3 Store-side diff/apply with Realtime push

**Backend — `src/main/services/catalog-sync.ts` (new):**

- `subscribeToCatalogRevision()` — opens a Supabase Realtime channel on `catalog_revision`. On each bump, triggers `checkCatalogUpdates` automatically. Called during `startSyncWorker` so every online register reacts within seconds, not app-start cycles.
- `checkCatalogUpdates()` — compares local `last_catalog_revision` (new row in `device_config`) to remote `catalog_revision.revision_id`. Returns `{ hasUpdates: boolean, pending: DiffRow[] }`.
- `buildCatalogDiff()` — for each of the store's distributors, fetches `catalog_products` rows where `curated_updated_at > last_catalog_revision_at`, joins to local `products` by `nys_item` / `ttb_id`, computes per-field diff. Only SKU, barcode, size, cost, alt SKUs are considered. **Price is never touched.**
- **Pre-flight collision check** — before surfacing each pending field to the UI, verify applying it would not violate local UNIQUE constraints (`products.sku`, `product_alt_skus` PK). Any collisions come back tagged with `{ conflictWith: <other product row> }` so the UI can block accept on that field until resolved.
- `applyCatalogDiff(selectedDiffs)` — single SQLite transaction. For each accepted change, updates local `products` + `product_alt_skus`, enqueues a sync push. Stamps `last_modified_by_device = 'catalog-pull'` so LWW plays nice. Any individual failure rolls back the whole apply and reports which field caused it.
- `markCatalogRevisionApplied(revisionId)` — persists the new `last_catalog_revision` in `device_config`.

**IPC wiring** (`src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`): add `checkCatalogUpdates`, `getCatalogDiff`, `applyCatalogDiff`, `getCatalogRevisionStatus` following the 5-step pattern in CLAUDE.md.

**UI — `src/renderer/src/components/inventory/catalog-updates/CatalogUpdatesPanel.tsx` (new):**

- New tab in `InventoryModal` beside Items / Departments / Tax Codes / Vendors: **"Catalog Updates"** (shown only when `hasUpdates = true`, with badge count).
- Grouped diff view: per distributor → per product → per field (current local value ▸ proposed value). Checkboxes per field to accept / reject.
- **Bulk-action row** for large diff sets: "Accept all SKU-only changes", "Accept all size-only changes", "Accept all (no collisions)".
- **Collision UI:** fields tagged with `conflictWith` render disabled with a tooltip like _"This SKU is already used by `Chardonnay 2023`. Resolve the conflict on the Items tab, then come back."_
- **Apply Selected** button.
- Manual **"Check for updates"** button in the tab header — user-triggered refresh in addition to the Realtime push.
- Toast on POS when a catalog revision lands: _"Catalog updates available — open Inventory → Catalog Updates."_ Dismissable; reappears once per new revision.

#### W1.4 Size suggestions from the user's own data

- New repo function `getDistinctSizes()` in `products.repo.ts` — `SELECT DISTINCT size FROM products WHERE size IS NOT NULL AND size != '' ORDER BY size`.
- `ItemForm.tsx` size field — swap the free-text input for a combobox using existing `InventoryInput` with a `datalist` (or the `Popover` primitive). Free text still allowed; the dropdown only suggests.
- This satisfies "unique set of sizes in the user's localDB" without shipping a predefined list.

---

### W2 — Full disaster recovery (initial sync for every merchant-scoped table)

**Status of current sync (verified in code):**

- `src/main/services/sync/initial-sync.ts` only calls `reconcileProducts` — a full pull of `merchant_products` (+ alt SKUs + special pricing).
- `src/main/services/sync/{cashier,tax-code,distributor,item-type}-sync.ts` each expose an `uploadX` and `applyRemoteXChange` function but **no initial pull**. They only react to Realtime events going forward.
- Result on a new machine: products restore, but cashiers, tax codes, distributors, item types, transactions, departments, and business settings do not. The auth state machine lands in `pin-setup` because local SQLite has no cashiers, forcing the user to recreate PINs. Product rows would also have dangling `distributor_number` / tax-code references.

**Scope of W2:** extend the initial-sync pipeline so that every merchant-scoped entity is reconciled on first login, and add the two tables that don't yet have cloud sync at all.

#### W2.1 Reconcile the existing merchant tables on startup

For each of cashiers, tax codes, distributors, item types — add a `reconcileX(supabase, merchantId, deviceId)` function next to the existing upload/apply pair in its `-sync.ts` file. Pattern mirrors `reconcileProducts`:

- Page through `merchant_<entity>` filtered by `merchant_id`, ordered by `(updated_at, id)`.
- For each remote row, look up the local row by its natural key (SKU for products, PIN for cashiers, code for tax codes, distributor_number for distributors, name for item types).
- LWW on `updated_at`: skip if local is fresher; call `applyRemoteXChange` otherwise.
- After the remote→local pass, upload any local-only rows (no `cloud_id`).

Files: `cashier-sync.ts`, `tax-code-sync.ts`, `distributor-sync.ts`, `item-type-sync.ts`.

Then extend `runInitialSync` in `initial-sync.ts` to call all five reconcilers **in this order** — dependencies matter:

1. `reconcileTaxCodes` (products reference tax codes)
2. `reconcileDistributors` (products reference distributor_number)
3. `reconcileItemTypes` (products reference item_type)
4. `reconcileCashiers` (needed before auth state machine decides `pin-setup` vs `login`)
5. `reconcileProducts` (existing — runs last so FKs resolve)

#### W2.2 Gate the auth state machine on initial sync completion, with real progress UI

The auth state machine in `useAuthStore.ts` currently routes to `pin-setup` when local `cashiers` table is empty. On a fresh install this races `runInitialSync`. Fix:

- Add a new transient state between `auth` and `pin-setup`: `syncing-initial`.
- `src/main/index.ts:1100-1120` already kicks off `runInitialSync` after a 3s delay — replace the fire-and-forget with an IPC-exposed `getInitialSyncStatus()` that returns:
  ```ts
  {
    state: 'idle' | 'running' | 'done' | 'failed',
    currentEntity: 'settings' | 'tax_codes' | 'distributors' | 'item_types' | 'departments' | 'cashiers' | 'products' | 'transactions' | null,
    entityProgress: { done: number, total: number | null },  // null = unknown yet
    completed: string[],   // entities already finished
    errors: Array<{ entity: string, message: string }>,
  }
  ```
- Renderer subscribes via a new hook `useInitialSyncStatus` (polls at 500ms or uses an IPC push — push is better; add a `sync:status-changed` event from main).
- **Progress UI** — a modal shown during `syncing-initial` state:
  - Per-entity rows with checkmark when complete
  - Active row shows `Syncing products… 1,240 / 50,000` with a progress bar
  - Failed rows show a red × and the error
  - Overall ETA if total is known
- **Failure handling — explicit, not silent.**
  - If any entity fails and all others complete: show the failure with a **"Retry"** button that re-runs just that reconciler.
  - If the whole sync fails (network down): show **"Continue offline and set up as new install"** button that transitions to `pin-setup`. This creates a local-only deployment; a background retry keeps trying so the merchant can recover later.
  - On success, the modal shows a 1-second "Done" checkmark before fading out.

This same progress/failure UX is reused during **distributor onboarding** (W7) — one component, two entry points.

#### W2.3 Add cloud sync for departments (with name-based dedup)

Departments currently have no `merchant_departments` table. Plan:

- Migration `supabase/migrations/NNNN_merchant_departments.sql`:
  ```sql
  CREATE TABLE merchant_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tax_code_id TEXT,
    device_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(merchant_id, name)
  );
  ```
  `(merchant_id, name)` UNIQUE is the dedup anchor. `id` is server-generated UUID — no client-side ID collisions.
- New `src/main/services/sync/department-sync.ts` — `uploadDepartment`, `applyRemoteDepartmentChange`, `reconcileDepartments`.
- **Upsert-with-existing-UUID semantics.** `uploadDepartment` uses PostgREST `upsert` with `onConflict: 'merchant_id,name'` and `returning: 'representation'`. If a department with the same name already exists on the merchant, the cloud returns the existing row (with its existing UUID and `updated_at`), and the client writes that UUID back into local SQLite's `cloud_id`. The API effectively returns 200-OK with the first-wins UUID rather than creating a duplicate.
- Add `'department'` entity to `sync-worker.ts` dispatch + Realtime subscription.
- Call `reconcileDepartments` from `runInitialSync` **before** products (products reference departments via `dept_id`).
- Local repo enqueues a sync push on create/update/delete.
- **Deletes:** soft-delete pattern (`is_deleted BOOLEAN`) rather than hard-delete — products referencing a deleted department would otherwise orphan their `dept_id`.

#### W2.4 Add cloud sync for business settings (hot fields split out)

Business settings (store name, receipt header/footer, theme) are per-merchant, single-row.

- Migration `supabase/migrations/NNNN_merchant_business_settings.sql`:
  ```sql
  CREATE TABLE merchant_business_settings (
    merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
    store_name TEXT,
    receipt_header TEXT,
    receipt_footer TEXT,
    theme TEXT,
    extras_json JSONB NOT NULL DEFAULT '{}',
    device_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```
  **Hot fields are columns, not JSON.** This avoids the concurrent-edit wipeout problem: if Register A updates the theme and Register B updates the store name at the same second, PostgREST column-level LWW still loses one full row, but we can use `UPDATE ... SET theme = $1 WHERE updated_at = $2` optimistic-concurrency patterns against individual fields. `extras_json` remains for free-form future fields.
- **Finix secrets NEVER go here.** Finix API keys stay in the merchant's existing credential store / `device_config`. Document explicitly in the migration header comment: "Do not add Finix keys, Supabase service-role keys, or any other secret to this table — it replicates to every register."
- **Exclude device-specific settings** from both the columns and `extras_json`: printer device IDs, the local Finix terminal serial, any per-register calibration. These belong in local-only `device_config`.
- New `src/main/services/sync/settings-sync.ts` with `uploadSettings`, `applyRemoteSettingsChange`, `reconcileSettings`.
- Call from `runInitialSync` **early** (before cashiers) so branded UI can render during pin setup on a new machine.

**PIN storage security note.** `merchant_cashiers` stores cashier PINs. Verify before shipping W2.1 whether PINs are hashed in the cloud; if not, that's a pre-existing security issue that W2 must not silently propagate. File a follow-up and hash them in a separate migration.

#### W2.5 Sessions stay local

`sessions` (register sessions for clock-in/clock-out) are **intentionally not synced**. Each physical register has its own cash drawer; sharing sessions across registers would contaminate cash reconciliation. `merchant_transactions` in the cloud also does not carry `session_id`, so Realtime-mirrored rows land locally with `session_id = NULL` and are correctly excluded from end-of-day session reports. W2 must not add `session_id` to the cloud transaction schema, and must not add a reconciler for sessions.

#### W2.6 Historical transactions (7-day backfill)

New registers need access to recent transactions for refund lookup. Window is **7 days**, matching the product's refund policy — longer windows would add sync cost with no business value.

- On first login only (gated by `device_config.has_completed_initial_sync`), paginate through `merchant_transactions` where `created_at >= now() - interval '7 days'` and insert into local `transactions` + `transaction_items`. Dedup via `INSERT OR IGNORE` on `transaction_number`.
- Do **not** sync inventory_deltas for historical transactions — stock is already materialized in `merchant_products.in_stock`.
- Mark synced rows with a `backfilled = 1` flag so session-level reports can distinguish "this register rang it up" from "this was pulled from cloud". Backfilled rows always have `session_id = NULL` (consistent with W2.5).

#### W2.7 Tests and docs

- Unit: one `reconcile*` test per entity using the `createTestDb()` helper.
- E2E: `tests/e2e/disaster-recovery.spec.ts`
  1. Seed mocked Supabase with a merchant + cashiers + tax codes + distributors + item types + departments + settings + ~50 products + 10 past transactions.
  2. Launch app fresh (empty local SQLite).
  3. Sign in → wait for `syncing-initial` → verify auth goes directly to `login` (not `pin-setup`), all entities present locally, product FKs resolve, receipt header shows merchant's branding.
- Update `docs/features/cloud-sync.md` with an explicit **"Restore on a new machine"** section + new table list + ordering notes.
- Update `docs/ai/repo-map.md` IPC channel list with `getInitialSyncStatus`.

---

### W3 — Hide $0 items + "Needs pricing" workflow (smallest)

**Filter logic — use `GREATEST`, not `COALESCE`.** `retail_price NUMERIC NOT NULL DEFAULT 0`, so it's never NULL; `COALESCE(retail_price, price)` would always return `retail_price`. A product with `price = 10, retail_price = 0` (a real state from bad imports) would be hidden even though it has a valid price. Use:

```sql
AND GREATEST(COALESCE(retail_price, 0), COALESCE(price, 0)) > 0
```

Also add a one-shot cleanup migration that sets `retail_price = NULL` wherever it's currently `0` — the `NOT NULL DEFAULT 0` convention was the root mistake and we fix it going forward via an `ALTER COLUMN ... DROP NOT NULL` on local SQLite.

**Backend — `src/main/database/products.repo.ts`:**

- `getProducts()` at `products.repo.ts:27-48`: add the `GREATEST(...) > 0` filter.
- New `getUnpricedInventoryProducts()` — filters for `GREATEST(COALESCE(retail_price,0), COALESCE(price,0)) = 0`.

**UI:**

- `InventoryModal` Items tab: filter chip row with "All / Needs pricing / Active / Archived". "Needs pricing" calls `getUnpricedInventoryProducts`; badge shows count.
- `HeaderBar` or `BottomShortcutBar`: small indicator `"N items need pricing"` linking to that filter when count > 0.

**Barcode scan of an unpriced item** — the POS grid is hidden but barcode scanners bypass the grid. New behavior in the scan-to-cart path:

1. Scan resolves the product as today (via SKU / alt SKU / barcode lookup — these paths keep returning $0 items).
2. Before adding to cart, check the product's effective price. If it's $0:
   - **If the logged-in cashier has admin role** → open the `InventoryModal` pre-filled on that item, General Info tab, focus on the price field. On save, re-enter the scan flow and add to cart.
   - **If the cashier is NOT admin** → show an inline prompt: _"This item is not priced. Enter a price to sell it now, or ask a manager to set the retail price."_ Prompt accepts a one-off sale price (keyboard or numpad), adds the item to cart at that price, and flags the transaction line with a "manual price" indicator visible in the receipt and in reports. Does not update the product's retail_price — that remains an admin action.
3. Cashier role is already on `cashiers.role` — check against `'admin' | 'manager'`.

Files touched: `src/renderer/src/store/usePosScreen.ts` (scan handler), new `UnpricedItemPrompt.tsx` under `components/pos/`, `ItemForm.tsx` (support `initialFocusField` prop).

**Bug fix riding along with W3 — modal keyboard input.** The current **quantity change** and **price change** modals in the POS accept only on-screen numpad clicks; keyboard input (digits, backspace, Enter, Escape) does not work. Add proper keyboard handlers in both modals so cashiers with physical keyboards can type. Test via Playwright. Files likely `src/renderer/src/components/ticket/QuantityModal.tsx` and `PriceModal.tsx` (verify paths during implementation).

**Tests:** update `products.repo.test.ts` (ensure $0 items excluded from `getProducts`, and `price=10, retail_price=0` is NOT hidden), add a new case for `getUnpricedInventoryProducts`, add `tests/e2e/needs-pricing.spec.ts`, add `tests/e2e/scan-unpriced-item.spec.ts` with both admin and cashier paths, add keyboard-input E2E tests on the quantity / price modals.

---

### W4 — Real Favorites

**Schema migration — `supabase/migrations/NNNN_product_favorites.sql`:**

- `merchant_products.is_favorite BOOLEAN NOT NULL DEFAULT false`
- Local SQLite: `products.is_favorite INTEGER NOT NULL DEFAULT 0` (add to `schema.ts:242`).
- Extend `ProductSyncPayload` in `src/main/services/sync/types.ts` + both sync directions in `product-sync.ts` + `initial-sync.ts` to include `is_favorite`.

**IPC:** add `toggleFavorite(productId: number)` in `products.repo.ts`, `src/main/index.ts`, preload.

**UI:**

- `ActionPanel` product tile: small star button (top-right corner) — `AppButton` with `size="sm"` + icon variant, click toggles and re-renders.
- `usePosScreen.ts`: delete `preferredFavoriteSkus` (line 22) + `getFavoriteSkuSet` (lines 45-54). Replace with `product.is_favorite === 1` filter when `activeCategory === FAVORITES_CATEGORY`. Hide the Favorites chip when no product is starred.
- `ItemForm` General Info: checkbox "Show on Favorites tab".

**Tests:** `POSScreen.test.tsx` — starring a product moves it into Favorites; `products.repo.test.ts` — `toggleFavorite` flips the flag.

---

### W5 — "This register only" toggle on reports

**Context.** All reports query local SQLite without a `device_id` filter (`reports.repo.ts:29-74`), and Realtime mirrors other registers' transactions into every local DB. Result: every register's report shows merchant-wide sales. Useful as a default, but end-of-shift reconciliation needs a way to scope to the current terminal.

Every transaction row already stamps `device_id` (`transactions.repo.ts:71,115,405`), so this is purely additive.

**Backend — `src/main/database/reports.repo.ts`:**

- Extend `ReportDateRange` in `src/shared/types/index.ts` (or add a sibling `ReportScope`) with an optional `deviceId?: string` field. When present, every query in `reports.repo.ts` appends `AND device_id = ?`.
- Apply to all report functions in the file, not just `getSalesSummary`: `getProductSalesReport`, `getCategorySalesReport`, `getTaxReport`, `getComparisonReport`, `getCashierSalesReport`, `getHourlySalesReport`.
- No IPC signature change needed if the scope rides inside the existing `ReportDateRange` payload; otherwise add a second optional argument to each IPC handler in `src/main/index.ts`.

**UI — reports modal (`src/renderer/src/components/reports/`):**

- Add a toggle labeled **"This register only"** in the reports modal header, next to the date range picker.
- **Default: off** — reports remain merchant-wide by default, matching today's behaviour.
- When on, the renderer passes the current device's id (already available via `window.api.getDeviceConfig()` or similar) into the report query.
- **Persist the toggle state per-register** in a new `useReportsPrefsStore` (Zustand, localStorage-backed via `persist` middleware). Keyed by device_id so a cashier's preference sticks across modal opens on the same register but never leaks to other registers.
- Caption under the toggle when on: `"Showing only sales rung up on this register (<device name or last 4 of id>)."`
- **Re-imaged machine caveat** — if the current device has zero historical transactions (new device*id from a re-install), show a note with the toggle on: *"This register was registered on <date>; sales rung up on the prior install won't appear here."\_

**Tests:**

- `reports.repo.test.ts` — add cases with two seeded `device_id`s: total includes both; scoped returns only matching rows.
- Renderer test on the reports modal — toggling the switch changes the IPC arguments.

**Out of scope for W5:** per-cashier scope (the existing `CashierSalesReport` already breaks down by cashier; no new UI needed). Offline-register catchup remains separately scoped and is intentionally deferred.

---

### W6 — FIFO cost layers for accurate margins

**Problem.** `products.cost` is a single scalar. When the cost of a SKU goes up (distributor raises price), the column gets overwritten, but the older stock sitting in the store was purchased at the lower price. Margin reports and COGS both become wrong:

- Old bottles of a wine cost $10 each. Store receives 30 at $10 → `cost = 10`, `in_stock = 30`.
- New shipment of 20 arrives at $12 each. Current code would overwrite `cost = 12` and bump `in_stock = 50`.
- Store sells 10 bottles at retail $20. Report shows COGS = 10 × $12 = $120, gross margin = $200 − $120 = $80.
- Truth under FIFO: those 10 bottles came from the first $10 layer. COGS = $100, margin = $100. Report overstates COGS by $20 and understates margin by $20.

As the user called out, this also affects sales reporting — today's reports bake the wrong assumption in.

#### W6.1 Cost-layer table

Local SQLite (and mirrored to cloud for disaster recovery):

```sql
CREATE TABLE product_cost_layers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  received_at TEXT NOT NULL,        -- ISO timestamp
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  cost_per_unit NUMERIC NOT NULL,
  source TEXT,                      -- 'receiving' | 'initial_import' | 'manual_adjustment'
  source_reference TEXT,            -- e.g., PO number
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cost_layers_product_remaining
  ON product_cost_layers(product_id, received_at)
  WHERE quantity_remaining > 0;
```

Layer is created on any stock-increasing event: receiving (purchase order), positive manual adjustment, initial distributor import (one layer per imported product at the import cost).

#### W6.2 Consume on sale (FIFO)

When a sale decrements stock (sale, not refund):

1. Load open layers for the product ordered by `received_at ASC`.
2. Walk them, deducting `quantity_sold` from `quantity_remaining` until satisfied.
3. The sale's **COGS** = sum of `(units_taken_from_layer × layer.cost_per_unit)` across touched layers.
4. Store COGS on the transaction item row: add `transaction_items.cost_at_sale NUMERIC` via migration.
5. Transaction: the existing `inventory_deltas` entry still records the stock change; layer consumption happens in the same SQLite transaction.

Refunds walk in reverse: create a new layer at the COGS of the original sale (so refunded stock goes back with its original cost, not current cost).

#### W6.3 Reporting updates

- `ProductSalesReport`, `CategorySalesReport`, `ComparisonReport` and `SalesSummaryReport` currently derive margin from `products.cost`. Change to `SUM(transaction_items.cost_at_sale)` for the reporting window.
- Legacy transaction rows (pre-W6) have `cost_at_sale = NULL`. Report functions must either (a) fall back to the product's current `cost` for pre-W6 rows and add a caption ("Margins for transactions before <date> use current cost, not layer cost"), or (b) backfill `cost_at_sale` on migration from the product's `cost` at that moment. (a) is safer.

#### W6.4 UI

- Inventory item detail: new "Cost layers" read-only panel showing open layers (received_at, cost, remaining). Helpful during audits.
- Receiving flow (if there's a purchase-order or receiving screen): prompt for unit cost at receiving; defaults to the distributor's catalog cost but editable. Save creates a new layer.
- If no PO / receiving flow exists today: add a minimal "Receive stock" action in the inventory item modal — `(quantity, unit_cost)` → creates a layer + adjusts in_stock.

#### W6.5 Cloud sync

Layers sync to a new `merchant_product_cost_layers` table with the same shape, keyed by `(merchant_id, product_sku, received_at, device_id)`. Realtime + initial sync follow the standard pattern. Transactions continue to sync via existing `transaction-sync.ts`, now carrying `cost_at_sale`.

#### W6.6 Migration strategy

- On first rollout of W6, for each existing product: create one seed layer `(quantity_remaining = products.in_stock, cost_per_unit = products.cost, received_at = now(), source = 'migration_seed')`. This means all pre-existing stock is treated as a single layer at the currently-stored cost — imperfect but defensible.
- Going forward, every receiving event creates new layers.

**Tests:** `product-cost-layers.repo.test.ts` — FIFO consumption, partial layer consumption, refund reversal, migration seed; `reports.repo.test.ts` — margin using `cost_at_sale` vs fallback.

---

### W7 — Onboarding and credential-input UX polish

Small but high-leverage. Ships alongside W2's sync progress UI since they share the spinner/error components.

- **Onboarding progress.** The existing `DistributorOnboardingScreen` displays no progress while importing thousands of rows. Surface the same per-entity progress/failure modal from W2.2 (one component, two entry points) so the user sees `Importing Empire Distributors… 1,240 / 9,600` instead of a dead screen. Errors get a retry button per distributor.
- **Show/hide toggle on sensitive inputs.** Add a show/hide eye icon on every masked input:
  - `AuthScreen` email/password
  - `PinSetupScreen` and `LoginScreen` PIN entry
  - Any Supabase/Finix key inputs (if surfaced during onboarding)
  - Settings screens that accept secret inputs
    Use a single `PasswordInput` wrapper component (extends `ValidatedInput`) so the styling stays consistent.
- **Error surfacing across onboarding.** Any IPC error during onboarding (auth failure, network, migration error) should show in an `ErrorModal` with the stripped message (no `Error invoking remote method '...': Error:` prefix per CLAUDE.md). Today some errors silently fail.
- **Activation / Business setup retry.** If `BusinessSetupScreen` submission fails mid-way (e.g., Finix merchant provisioning), allow retry from the point of failure instead of starting over.

**Tests:** E2E `tests/e2e/onboarding-progress.spec.ts` mocks slow imports and verifies progress updates; unit tests on `PasswordInput` for toggle state + aria labels.

---

### W8 — Hash cashier PINs (Phase 5)

Status (2026-04-18): Implemented in the local/main process path using bcrypt hashing and compare in `cashiers.repo.ts`, with `pin_hash` continuing to be the sync payload field for cross-register cashier reconciliation.

**Problem.** Before Phase 3 ships initial-sync for `merchant_cashiers`, verify whether cloud PINs are stored in plaintext or hashed. If plaintext (very likely today), anyone with `service_role` access sees every cashier's PIN. The W2 initial-pull would download plaintext PINs to every new register — concentrating the blast radius.

**Plan**

- Add a `pin_hash TEXT` column alongside the existing `pin TEXT` on both `cashiers` (local SQLite) and `merchant_cashiers` (cloud). Migration is additive.
- Server-side function (`hash_cashier_pin(merchant_id, cashier_id)`) using `pgcrypto` — `crypt(pin, gen_salt('bf'))` bcrypt. Runs once across all existing rows, populating `pin_hash`. After completion, NULL-out `pin`.
- Local SQLite: add a one-shot migration that rehashes all local PINs via `bcrypt` (from `bcryptjs` or `node-forge`) and clears the plaintext column.
- PIN verification path (`cashier-auth`) switches to `bcrypt.compare(input, pin_hash)`.
- Onboarding new cashier: `pin_hash` is computed in the main process, never in the renderer. Plaintext never leaves the main process memory.
- Drop the `pin` column in a follow-up release (30 days later) after confirming nobody still reads it.

**Tests:** `cashier-auth.test.ts` — bcrypt verify correct/incorrect PINs; migration test that seeds plaintext PINs, runs migration, verifies hashes validate the old PINs.

---

### W9 — Retroactive FIFO seeding for historical transactions (Phase 5)

Status (2026-04-18): Implemented via `transaction_items.cost_at_sale` + `cost_basis_source` with local backfill to `legacy_baseline` for pre-FIFO rows, plus sync propagation of both fields.

**Problem.** W6 introduces `cost_at_sale` on transaction items going forward. Pre-W6 transactions have `cost_at_sale = NULL`; reports fall back to current `cost` with a caption. A better answer is to backfill historical COGS using a best-effort reconstruction.

**Plan**

Best-effort historical COGS backfill. We can't perfectly recreate FIFO for the past because we don't know old receiving events, but we can approximate:

- For each product, snapshot the current `cost` at W9 rollout as `legacy_baseline_cost`.
- For each pre-W6 `transaction_items` row: `cost_at_sale = legacy_baseline_cost` of that product at rollout time.
- Store both `cost_at_sale` and a `cost_basis_source TEXT` column: values `'fifo_layer' | 'legacy_baseline'`. Reports can show both margin numbers or filter to FIFO-only going forward.
- Run the backfill as a one-shot local migration; upload the updated rows via existing `transaction-sync`.

**Tests:** historical transactions get `cost_at_sale = legacy_baseline_cost`; post-W6 transactions keep their layer-derived COGS; reports show a "historical margin uses current cost" badge for pre-W6 windows.

**Caveat to document:** if distributor costs changed significantly in the past, this backfill understates or overstates historical margin. W9 ships with a clear doc note that pre-W6 margin is an approximation.

---

### W10 — Offline-register transaction catchup (Phase 7)

**Problem.** `handleRemoteTransaction` in `sync-worker.ts:212-244` only receives events while connected to Realtime. If Register v1 is offline (sleeping laptop, network outage) while v2 rings up sales, v1 never sees those INSERTs. Today's reports silently undercount.

**Plan**

- New `src/main/services/sync/transaction-catchup.ts`:
  - On sync-worker start and on every connectivity-restored event, query `merchant_transactions` where `created_at > local_max_synced_transaction_at AND device_id != this_device_id`, paginated by 200.
  - For each fetched row, reuse `handleRemoteTransaction` (already dedup'd by `transaction_number`).
  - Persist the high-water mark as `device_config.last_transaction_catchup_at`.
- `transaction-catchup.ts` runs in parallel with the existing initial-sync; they don't conflict because both use `INSERT OR IGNORE`.
- Surface a small "Reconciling…" indicator in the HeaderBar while catchup is running; pair with a success toast `"Caught up on N sales from other registers"`.

**Tests:** E2E `tests/e2e/offline-catchup.spec.ts` — take register v1 offline, ring sales on v2, bring v1 back → within seconds its reports include v2's sales. Integration test for the pagination cursor + high-water-mark persistence.

---

### W11 — Extended refund lookup (Phase 7)

**Problem.** W2.6 backfills 7 days of transactions on a new machine. A customer returns something older than 7 days → local lookup fails.

**Plan**

- `LookupOriginalTransaction` flow in the refund screen currently queries local only. Extend:
  - Query local first (same as today).
  - On miss, query `merchant_transactions` by `transaction_number` via the existing Supabase client. Online-only — if offline, show a clear error.
  - If the cloud returns a match, offer to refund against it and **insert a read-only local copy** with `backfilled = 1` (reusing W2.6's schema).
- Add a `refundable_through TIMESTAMPTZ` column on `merchant_business_settings` (hot-field in W2.4 extras_json) so merchants can configure their own refund window. Defaults to 7 days to match today's policy; admins can extend.
- Reject refunds where `now() - original.created_at > refundable_through` regardless of lookup success.

**Tests:** unit test for the extended lookup fallback; E2E for "refund of 30-day-old transaction on a fresh machine" (with settings extended to 90 days).

---

### W12 — Custom / non-NYSLA distributor catalogs (Phase 8)

**Problem.** `catalog_distributors` and `catalog_products` were seeded from the New York State Liquor Authority feed. Stores in other states, or stores with direct-ship distributors outside the NYSLA system, have no catalog and can't participate in the W1 curation flow.

**Plan**

- **Schema.** Add `catalog_distributors.region TEXT NOT NULL DEFAULT 'NY-NYSLA'` and `catalog_distributors.source TEXT NOT NULL DEFAULT 'nysla'`. Add an `imports_config JSONB` column for region-specific parser hints.
- **Import pipeline.**
  - Extract the NYSLA-specific logic from `scripts/upload-catalog.ts` into a `CatalogSource` interface: `fetch()`, `parse(raw)`, `upsert(catalog_products_rows)`.
  - Add `CatalogSource` implementations for at least one additional region (e.g., Texas TABC) and a generic **custom CSV** source that accepts a mapping config.
- **Admin tool extension.**
  - Add a "Distributors" tab to `tools/catalog-admin/` where the admin can create custom distributor records and upload product CSVs with a field-mapping UI (`csv_column → catalog_products field`).
  - Saves the mapping into `catalog_distributors.imports_config` so re-imports reuse it.
- **Store-side impact.**
  - `DistributorOnboardingScreen` already lists `catalog_distributors`; once W12 ships, non-NY distributors appear in the picker.
  - Region field surfaces as a filter so stores don't browse irrelevant catalogs.

**Tests:** unit tests on each `CatalogSource` parser; E2E importing a custom CSV and confirming it flows through the full W1 curation→push cycle.

---

## Critical Files to Touch

| File                                                                                  | Change                                                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260101000000_baseline_merchant_schema.sql` (new)               | Capture the already-deployed cloud schema so fresh Supabase bootstrap works                         |
| `supabase/migrations/NNNN_catalog_curation.sql` (new)                                 | Curated overlay columns + `catalog_revision` + alt SKU table + `catalog_curation_log`               |
| `supabase/migrations/NNNN_product_favorites.sql` (new)                                | `is_favorite` on `merchant_products`                                                                |
| `supabase/migrations/NNNN_merchant_departments.sql` (new)                             | New cloud table for departments with name-based dedup (W2.3)                                        |
| `supabase/migrations/NNNN_merchant_business_settings.sql` (new)                       | Hot fields as columns + `extras_json` for future (W2.4)                                             |
| `supabase/migrations/NNNN_cost_layers.sql` (new)                                      | `merchant_product_cost_layers` + `cost_at_sale` on `merchant_transaction_items` (W6)                |
| `supabase/migrations/NNNN_fix_retail_price_zeros.sql` (new)                           | NULL-out `retail_price = 0` rows so W3 filter works (W3)                                            |
| `src/main/services/sync/{cashier,tax-code,distributor,item-type}-sync.ts`             | Add `reconcileX` functions (W2.1)                                                                   |
| `src/main/services/sync/department-sync.ts` (new)                                     | Upload/apply/reconcile for departments (W2.3)                                                       |
| `src/main/services/sync/settings-sync.ts` (new)                                       | Upload/apply/reconcile for business settings (W2.4)                                                 |
| `src/main/services/sync/initial-sync.ts`                                              | Orchestrate all reconcilers in dependency order; expose `getInitialSyncStatus` (W2.1–W2.4)          |
| `src/main/services/sync-worker.ts`                                                    | Dispatch new entity types + Realtime subscriptions for departments and settings                     |
| `src/renderer/src/store/useAuthStore.ts`                                              | New `syncing-initial` state; gate pin-setup on sync completion (W2.2)                               |
| `src/renderer/src/hooks/useInitialSyncStatus.ts` (new)                                | Renderer hook consuming `getInitialSyncStatus` (W2.2)                                               |
| `tools/catalog-admin/` (new)                                                          | Standalone admin Vite app — merchant→catalog diff UI                                                |
| `src/main/database/schema.ts`                                                         | Add `products.is_favorite`, `product_cost_layers`, `transaction_items.cost_at_sale`                 |
| `src/main/database/products.repo.ts`                                                  | `getProducts` GREATEST filter, `getUnpricedInventoryProducts`, `toggleFavorite`, `getDistinctSizes` |
| `src/main/database/cost-layers.repo.ts` (new)                                         | FIFO consumption + layer creation (W6)                                                              |
| `src/main/database/reports.repo.ts`                                                   | Use `cost_at_sale` for margin; add `device_id` filter (W5, W6.3)                                    |
| `src/main/services/catalog-sync.ts` (new)                                             | Diff/apply + `subscribeToCatalogRevision` Realtime push                                             |
| `src/main/services/sync/{cashier,tax-code,distributor,item-type}-sync.ts`             | Add `reconcileX` functions (W2.1)                                                                   |
| `src/main/services/sync/department-sync.ts` (new)                                     | Upload/apply/reconcile with name-based dedup (W2.3)                                                 |
| `src/main/services/sync/settings-sync.ts` (new)                                       | Upload/apply/reconcile for hot-fields business settings (W2.4)                                      |
| `src/main/services/sync/cost-layer-sync.ts` (new)                                     | Upload/apply/reconcile for cost layers (W6.5)                                                       |
| `src/main/services/sync/types.ts` + `product-sync.ts` + `initial-sync.ts`             | Extend payload with `is_favorite`; orchestrate all reconcilers in dependency order                  |
| `src/main/services/sync-worker.ts`                                                    | Dispatch new entity types + Realtime subscriptions for departments, settings, cost layers           |
| `src/renderer/src/store/useAuthStore.ts`                                              | New `syncing-initial` state; gate pin-setup on sync completion (W2.2)                               |
| `src/renderer/src/store/useReportsPrefsStore.ts` (new)                                | Persist per-device "this register only" toggle (W5)                                                 |
| `src/renderer/src/hooks/useInitialSyncStatus.ts` (new)                                | Renderer hook consuming `getInitialSyncStatus` (W2.2)                                               |
| `src/renderer/src/components/common/PasswordInput.tsx` (new)                          | Reusable masked-input with show/hide toggle (W7)                                                    |
| `src/renderer/src/components/common/SyncProgressModal.tsx` (new)                      | Shared progress/failure UI for initial sync + distributor onboarding (W2.2 + W7)                    |
| `src/main/index.ts` + `src/preload/index.ts` + `src/preload/index.d.ts`               | New IPC: catalog updates, favorites, unpriced, distinct sizes, cost layers, sync status             |
| `src/renderer/src/components/inventory/catalog-updates/CatalogUpdatesPanel.tsx` (new) | Diff review UI (with collision handling + bulk actions)                                             |
| `src/renderer/src/components/inventory/InventoryModal.tsx`                            | New tab + filter chips + cost layers panel                                                          |
| `src/renderer/src/components/inventory/items/ItemForm.tsx`                            | Favorite checkbox, size combobox, `initialFocusField` prop for scan-then-edit                       |
| `src/renderer/src/components/action/ActionPanel.tsx`                                  | Star button on tiles                                                                                |
| `src/renderer/src/components/pos/UnpricedItemPrompt.tsx` (new)                        | Cashier path for scan of $0 item (W3)                                                               |
| `src/renderer/src/components/ticket/QuantityModal.tsx`, `PriceModal.tsx`              | Add keyboard handlers (W3 bug fix)                                                                  |
| `src/renderer/src/store/usePosScreen.ts`                                              | Remove hard-coded favorites; scan-handler role branching                                            |
| `docs/features/central-catalog-admin.md` (new)                                        | Admin tool + curation workflow spec                                                                 |
| `docs/features/cloud-sync.md`                                                         | Add "Restore on new machine" section + new table list                                               |
| `docs/features/favorites.md` (new)                                                    | New feature spec                                                                                    |
| `docs/features/cost-layers.md` (new)                                                  | FIFO architecture, migration, reporting impact                                                      |
| `docs/README.md` + `CLAUDE.md` docs table                                             | Register new docs                                                                                   |
| `docs/ai/repo-map.md` + `docs/ai/inventory-map.md`                                    | Update with new IPC channels + files                                                                |
| `supabase/migrations/NNNN_hash_cashier_pins.sql` (new)                                | Add `pin_hash` + pgcrypto bcrypt function (W8)                                                      |
| `src/main/services/cashier-auth.ts`                                                   | Switch from plaintext compare to bcrypt compare (W8)                                                |
| `supabase/migrations/NNNN_fifo_retroactive_seed.sql` (new)                            | Backfill `cost_at_sale` + `cost_basis_source` on historical rows (W9)                               |
| `src/main/services/sync/transaction-catchup.ts` (new)                                 | Realtime-gap catchup on connect (W10)                                                               |
| `src/renderer/src/components/layout/HeaderBar.tsx`                                    | "Reconciling…" indicator (W10); "N items need pricing" (W3); "Catalog updates available" (W1)       |
| `src/main/database/transactions.repo.ts`                                              | Extended refund lookup with cloud fallback (W11)                                                    |
| `src/renderer/src/components/payment/RefundScreen.tsx` (or equivalent)                | Hook into extended lookup + `refundable_through` enforcement (W11)                                  |
| `scripts/catalog-sources/` (new directory)                                            | `CatalogSource` interface + NYSLA, TABC, custom-CSV implementations (W12)                           |
| `tools/catalog-admin/src/distributors/CustomDistributorImport.tsx` (new)              | CSV upload + field mapping UI (W12)                                                                 |
| `docs/features/cashier-auth.md` (update)                                              | PIN hashing migration + compatibility notes (W8)                                                    |
| `docs/features/offline-catchup.md` (new)                                              | Realtime-gap model + catchup guarantees (W10)                                                       |
| `docs/features/refund-policy.md` (new)                                                | Refund window config + extended lookup flow (W11)                                                   |
| `docs/features/catalog-sources.md` (new)                                              | Multi-region catalog architecture + adding a new source (W12)                                       |

---

## Reuse (do not rewrite)

- `useCrudPanel` (`src/renderer/src/hooks/useCrudPanel.ts`) for the admin tool's product list state.
- `FormField`, `ValidatedInput`, `InventoryInput`, `InventorySelect`, `AppButton`, `ConfirmDialog`, `ErrorModal`, `SuccessModal` — mandatory per CLAUDE.md component rules.
- `formatCurrency`, `normalizeCurrencyForInput`, `parseCurrencyDigitsToDollars` — for cost editing in admin tool.
- `enqueueSyncItem` (`src/main/database/sync-queue.repo.ts`) — call this in `applyCatalogDiff` so applied changes propagate to other registers.
- Existing LWW pattern in `initial-sync.ts` — extending, not replacing.

---

## Verification

Per-workstream, run the quality gate from CLAUDE.md:

```bash
npx prettier --write .
npm run lint
npx stylelint "src/**/*.css"
npm run typecheck
npm run test:coverage     # must stay >= 80%
npm run test:e2e          # for UI flows
```

End-to-end manual test:

1. **W3:** `npm run dev` → import a distributor with 500+ products → confirm main POS grid shows only priced items; Inventory → "Needs pricing" shows the rest with a count badge. Verify `price=10, retail_price=0` rows are visible (not hidden). As an admin, scan an unpriced item → inventory modal opens pre-focused on price. As a cashier, scan → inline prompt for one-off price, sale completes, line marked "manual price" on receipt and in the sales report. Type digits on the quantity / price modal via a physical keyboard → confirms W3 bug fix.
2. **W4:** Star three products → they appear under Favorites on POS; remove star → they disappear. Open on a second register (same merchant) → favorites match after sync.
3. **W1:** Merchant A edits a wine's size to `700ml` in their inventory modal → change syncs. Run `npm run admin` → select Merchant A → filter "size differs" → promote the size into the catalog → `catalog_revision` bumps. On Merchant B's register, the "Catalog Updates" tab badge appears within a few seconds (Realtime) → open, accept the size update → confirm local product now shows `700ml`, price unchanged, other register on Merchant B also receives the change via existing product-sync. Check `catalog_curation_log` for the audit row.
4. **W2:** Fresh install on a second machine → sign in as the same merchant → progress modal shows per-entity counts → app routes directly to `login` (not `pin-setup`) → confirm cashiers / tax codes / distributors / item types / departments / business settings (store name, receipt header/footer, theme) / products / last 7 days of transactions all appear with no manual re-import or re-onboarding. Kill the network mid-sync → error surfaces with retry; reconnect → retry succeeds. Create a department with an existing name on one register → verify no duplicate on the other register after sync.
5. **W5:** With two registers (v1, v2) online under the same merchant, ring up 3 sales on v1 and 2 sales on v2 → open reports on v1 with toggle **off** → see 5 transactions (merchant-wide). Turn toggle **on** → see only the 3 transactions rung up on v1. Close and reopen the reports modal → toggle stays **on** (persisted per device). Open reports on v2 → its toggle is independent and defaults to off.
6. **W6:** Create a wine, receive 30 at $10/unit → one cost layer. Receive 20 more at $12/unit → second layer. Sell 10 bottles at $20 retail → transaction COGS = $100 (all from first layer), margin = $100. Verify the reports product-margin breakdown shows $100, not $120. Sell 25 more → COGS = $250 (remaining 20 of first layer at $10 + 5 of second layer at $12) = $200 + $60 = $260. Refund the last 5 bottles → new layer at $12 created for those 5 units. Confirm cost-layer panel in inventory reflects all four states.
7. **W7:** On a fresh install, AuthScreen password field has a show/hide eye icon that reveals plaintext when clicked. During distributor onboarding, the progress modal shows `Importing X… N / total` and handles a simulated failure with a visible retry button. Any IPC error shows a clean message (no `Error invoking remote method` prefix).
8. **W8:** Seed cashiers with plaintext PINs → run the W8 migration → confirm `pin_hash` is populated, `pin` is NULL, login with the original PIN still succeeds, and `merchant_cashiers` rows in the cloud mirror the hash change. Attempting to read raw PINs from the database returns no plaintext.
9. **W9:** Pre-W6 transactions have `cost_at_sale = NULL` → run the W9 backfill → every pre-W6 row gets `cost_at_sale = legacy_baseline_cost` and `cost_basis_source = 'legacy_baseline'`. Reports now show a historical margin with the caption "uses current cost" for the affected period; post-W6 transactions keep their FIFO-derived values.
10. **W10:** Take Register v1 offline, ring 5 sales on v2, reconnect v1 → within seconds v1's HeaderBar shows "Reconciling…", then "Caught up on 5 sales from other registers" → v1's reports now include the 5 sales. `device_config.last_transaction_catchup_at` has advanced.
11. **W11:** On a fresh machine with 7-day backfill only, attempt to refund a 30-day-old transaction → cloud lookup succeeds, refund completes, local gets a `backfilled = 1` copy. Change `refundable_through` to `interval '3 days'` → attempt to refund a 5-day-old transaction → refund is rejected with a clear message.
12. **W12:** In `tools/catalog-admin/`, create a custom distributor "Acme Direct Wines" with a CSV mapping → upload a 200-row CSV → rows appear in `catalog_products` with `region = 'custom'`. In the POS, `DistributorOnboardingScreen` shows "Acme Direct Wines" in the picker under a "Custom" section; importing it populates local `products`; the full W1 curation cycle works end-to-end on the custom distributor.

---

## Design Decisions (Intentional, Not Work Items)

These are not deferred work — they're explicit product decisions that shape the plan's shape. Documented here so future contributors know they were considered, not forgotten.

- **Prices never sync central → stores.** Each merchant sets their own retail prices. The central catalog only curates SKU, barcode, size, cost, and alt SKUs. This is a contractual and legal choice, not a technical limitation.
- **Favorites are merchant-wide, not per-device or per-cashier.** Simpler mental model; stays consistent as cashiers move between registers during a shift.
- **Catalog updates require user review.** No auto-apply. Each accepted field is explicit. Keeps the merchant in control of their catalog even when the central curator makes a mistake.
- **Sessions (clock-in/clock-out) are strictly local.** Cash reconciliation is per physical register; syncing sessions would cross-contaminate drawer counts.
- **Per-cashier reporting is already covered.** `CashierSalesReport` breaks down by cashier today. No new UI needed in W5 — the existing report is sufficient.
- **Sync layer extends, not rebuilds.** W2 adds reconcilers alongside the existing upload/apply handlers; it does not replace the product-sync or inventory-delta-sync pipelines that already work.
