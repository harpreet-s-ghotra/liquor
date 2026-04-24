# Multi-Merchant Account Switching + Sign Out

**Status:** Implemented in phases 1-3 (purchase-order startup reconcile deferred)
**Date:** 2026-04-23
**Scope:** Add an explicit "Sign Out of Account" affordance, isolate per-merchant data on a single install, stop auto-pulling sales history on login, and define exactly what auto-syncs when a multi-store owner switches between merchant accounts on the same physical computer.

---

## Why

A multi-store owner wants to sit at one register and toggle between Store A and Store B accounts to check inventory, edit products, and review activity. Today's install assumes one merchant per machine for life:

- **No "Sign Out of Account" button anywhere in the POS UI.** The only exits are `EXIT POS` (cashier PIN logout — stays signed into Supabase) and the `Forgot PIN? Sign in with email` link on the login screen, which incidentally calls `signOutForPinReset()`. There is no clean "switch merchant" affordance.
- **Initial sync auto-pulls 365 days of sales history.** On every login `runInitialSync()` (`src/main/services/sync/initial-sync.ts:232`) kicks off `backfillRecentTransactions()` in the background (line 310), which pulls `DEFAULT_BACKFILL_DAYS = 365` (`src/main/services/sync/transaction-backfill.ts:6`). The user explicitly does not want that.
- **Local SQLite is single-merchant.** `products`, `transactions`, `inventory_deltas`, `sync_queue` all lack a `merchant_id` column (`src/main/database/schema.ts:331-545`). `merchant_config` is a singleton (id=1).
- **Logout leaves the local DB dirty.** `auth:logout` (`src/main/index.ts:610-617`) only clears the Supabase token + the `merchant_config` row. Products, transactions, inventory deltas, and queued sync items from Merchant A all survive. If the same install signs in as Merchant B next, A's products show up in the catalog and A's pending sync items get pushed **under B's merchant_id** (sync queue carries `device_id` only; the worker injects whichever `merchantId` is current at drain time).
- **Device registration drift.** `device-registration.ts:18-21` keys the device fingerprint by `userData + hostname`. Per merchant a fresh `(merchant_id, fingerprint)` row gets upserted in cloud `registers`, but the local `device_config` singleton still holds the previous merchant's `device_id`. The sync worker reads the stale id and silently mis-scopes.

The end state: the manager signs out of A → signs in as B → sees B's current inventory + open POs without B's sales history flooding in → makes edits → signs out → signs back into A and finds A's data exactly as they left it.

---

## Decisions

| Decision                       | Choice                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Per-merchant data isolation    | **Per-merchant SQLite file** under `userData/merchants/<merchant_account_id>/database.sqlite` |
| Sales history on login         | **Never auto-pull** — manual button in Reports modal only                                     |
| Sign Out gate                  | **Admin only** — cashiers see only `Exit POS`                                                 |
| Pending sync queue on sign-out | **Drain blocking up to 10 s**, show a small progress dialog, then close DB and sign out       |

---

## Target Behaviour

### 1. Per-merchant SQLite database files

Switch from the single shared DB to `userData/merchants/<merchant_account_id>/database.sqlite`. On login or session restore the connection is opened against the current merchant account's file; on sign-out it is closed.

**Why this over per-row `merchant_id` columns**: every repo would need a `WHERE merchant_id = ?` clause and we would touch ~20 files. Per-merchant files keep all repo code unchanged, give us hard isolation (impossible to accidentally cross-read), and the sync queue stays naturally scoped to the merchant whose DB it lives in.

**Lifecycle:**

- `src/main/database/connection.ts` now exposes `setActiveMerchantDb(merchantAccountId, finixMerchantId?)`, `closeActiveMerchantDb()`, and `getActiveMerchantAccountId()`. `getDb()` throws if no merchant is active. The first call for a never-seen merchant creates the directory + applies the schema fresh.
- `src/main/services/supabase.ts` now resolves the Supabase `merchants.id` first, calls `setActiveMerchantDb(merchantAccountId, finixMerchantId)` before any repo write, then saves `merchant_config`. The singleton row inside that DB now stores both `merchant_account_id` and the Finix-facing `merchant_id`.
- `src/main/services/sync-worker.ts:52-53` — already keeps `merchantId` and `deviceId` as module state. Reset both on `stopSyncWorker()` and re-init on login. The drain naturally reads from whichever DB is currently active.
- `src/main/services/device-registration.ts` — keep the deterministic `userData + hostname` fingerprint, but write the returned `device_id` into the **per-merchant** `device_config` table inside the merchant's own DB file. Different merchants → different `device_id` rows in their own DB files. No more drift across switches.

**Migration for existing single-merchant installs:**

On merchant activation, if a legacy `userData/data/liquor-pos.db` exists and the target per-merchant DB does not, inspect the legacy `merchant_config` row and migrate it into `userData/merchants/<merchant_account_id>/database.sqlite` when the stored merchant account id or Finix merchant id matches the newly authenticated account. The migration is idempotent and guarded by `existsSync` checks.

### 2. Real "Sign Out of Account" button

- Header and footer now both expose explicit account sign-out affordances for admins. `EXIT POS` remains cashier logout only.
- `auth:full-sign-out` drains the sync queue for up to 10 seconds, stops the sync worker, closes the active merchant DB, signs out of Supabase, and returns the drain result.
- `useAuthStore.signOut()` now calls `authFullSignOut()`, temporarily enters a `signing-out` auth state, and returns to `auth` when the account session is closed. `signOutForPinReset()` remains separate for the pin-reset flow.

### 3. Stop auto-downloading sales history

- `runInitialSync()` no longer triggers any transaction backfill at login.
- Reports now includes a built-in "Pull sales history from cloud" panel that reuses the existing history IPCs: `history:get-stats`, `history:get-backfill-status`, `history:trigger-backfill`, and `history:backfill-status-changed`. Default input is 30 days; requests stay within the existing safe 365-day window.
- Realtime subscriptions still pick up _new_ transactions as they happen. Only historic backfill is opt-in.

### 4. Auto-sync contract for switched merchants

For a merchant the operator switches into, on login resolve in this order (all scoped to that merchant's DB file):

| Entity                   | When                                           | Source                                            |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------- |
| Settings                 | Every login                                    | `reconcileSettings()`                             |
| Tax codes / item types   | Every login                                    | existing reconcile fns                            |
| Distributors             | Every login                                    | `reconcileDistributors()`                         |
| Departments              | Every login                                    | `reconcileDepartments()`                          |
| Cashiers                 | Every login                                    | `reconcileCashiers()`                             |
| **Products / inventory** | Every login + Realtime ongoing                 | `reconcileProducts()` + Realtime                  |
| **Open purchase orders** | Deferred                                       | No cloud startup reconcile yet                    |
| **Distributor catalog**  | First login per merchant; manual refresh after | existing `catalog:import` path, gated             |
| Transactions backfill    | **Manual only** (Reports modal button)         | Existing history backfill IPCs, moved off startup |

Multi-store manager pattern then becomes: sign out of A → sign in as B → wait ~2-5 s for the reconcile pass → see B's current inventory + open POs → make edits → sign out → switch back to A. No sales history pulled unless explicitly requested.

### 5. Purchase-order startup reconcile

Deferred. Purchase orders still use the current local and cloud paths, but there is no new startup reconcile because the cloud purchase-order schema required for a safe merchant-scoped pull is not in place yet.

### 6. Active-account pill in the header

Add a pill to the right side of `HeaderBar` showing `<merchant_name> · <register_name>`. Click → opens a small menu with `Sign Out of Account` (admin-gated, same wiring as the BottomShortcutBar entry) and `Switch Account` (which is just sign-out → AuthScreen — same path). Hard requirement once multi-account is real, otherwise a manager will edit the wrong store and not notice.

---

## Architecture Changes

### DB connection lifecycle

`src/main/database/connection.ts` becomes:

```ts
let activeDb: Database | null = null
let activeMerchantId: string | null = null

export function setActiveMerchantDb(merchantId: string): void {
  if (activeMerchantId === merchantId && activeDb) return
  closeActiveMerchantDb()
  const dir = path.join(app.getPath('userData'), 'merchants', merchantId)
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'database.sqlite')
  activeDb = new Database(dbPath)
  activeDb.pragma('foreign_keys = ON')
  applySchema(activeDb)
  activeMerchantId = merchantId
}

export function closeActiveMerchantDb(): void {
  if (activeDb) {
    activeDb.close()
    activeDb = null
  }
  activeMerchantId = null
}

export function getDb(): Database {
  if (!activeDb) throw new Error('No active merchant DB')
  return activeDb
}
```

All existing `getDb()` callers keep working unchanged.

### Legacy migration

`src/main/database/schema.ts` (or a new `src/main/database/migrate-legacy.ts`):

```ts
export function migrateLegacyDbIfPresent(): void {
  const legacy = path.join(app.getPath('userData'), 'database.sqlite')
  const merchantsDir = path.join(app.getPath('userData'), 'merchants')
  if (!fs.existsSync(legacy)) return
  if (fs.existsSync(merchantsDir)) return
  const legacyDb = new Database(legacy, { readonly: true })
  const row = legacyDb.prepare('SELECT merchant_id FROM merchant_config WHERE id = 1').get() as
    | { merchant_id: string }
    | undefined
  legacyDb.close()
  if (!row?.merchant_id) return
  const target = path.join(merchantsDir, row.merchant_id, 'database.sqlite')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.renameSync(legacy, target)
  log.info('Migrated legacy DB to per-merchant location', { merchantId: row.merchant_id })
}
```

Call once from `app.whenReady()` before any other DB access.

### Sync queue drain helper

`src/main/services/sync-worker.ts` — add:

```ts
export async function drainSyncQueue(
  timeoutMs: number
): Promise<{ drained: number; remaining: number }> {
  const start = Date.now()
  const initial = getQueueDepth()
  while (Date.now() - start < timeoutMs) {
    if (getQueueDepth() === 0) break
    await drainOnce() // existing helper
    await new Promise((r) => setTimeout(r, 250))
  }
  return { drained: initial - getQueueDepth(), remaining: getQueueDepth() }
}
```

`fullSignOut` IPC waits on this and forwards the result to the renderer for display in the SyncProgressModal.

### Renderer

- `useAuthStore` — `signOut` action becomes `await window.api.fullSignOut()` then transitions to `auth`. Loading guard so the UI shows the SyncProgressModal during the drain.
- `BottomShortcutBar` — add `Sign Out` button next to `Exit POS`, admin-gated via `useAuthStore.currentCashier?.is_admin`.
- `HeaderBar` — active-account pill + menu.
- `ReportsModal` — new `Pull Sales History` panel with day-range picker.

### Types / IPC

Preload additions (`src/preload/index.ts` + `index.d.ts`):

```ts
fullSignOut(): Promise<{ drained: number; remaining: number }>
pullSalesHistory(daysBack: number): Promise<{ inserted: number }>
```

No shared schema additions — `merchant_id` already lives in `merchant_config`; the per-merchant file boundary handles isolation.

---

## Tests

### Backend

- `connection.test.ts` (new) — `setActiveMerchantDb('A')` → write a product → `setActiveMerchantDb('B')` → write a different product → switch back to A → verify A's product is still there and B's is not visible.
- `sync-worker.test.ts` — `drainSyncQueue(timeoutMs)` returns correct counts; honours timeout; works against a mocked Supabase.
- Migrate-legacy test — seed `userData/data/liquor-pos.db` with a `merchant_config` row, run `migrateLegacyDbIfPresent`, assert the file is now under `merchants/<id>/`.
- `initial-sync.test.ts` — assert `runInitialSync` no longer calls `backfillRecentTransactions` (regression guard against re-introducing it).
- Purchase-order startup reconcile remains deferred until the cloud schema exists.

### Renderer

- `useAuthStore.test.ts` — `signOut` calls `fullSignOut`, transitions to `auth`, surfaces the drain result.
- `BottomShortcutBar.test.tsx` — Sign Out button visible only when `currentCashier?.is_admin === true`.
- `HeaderBar.test.tsx` — active-account pill renders merchant + register, opens menu, fires sign-out.
- `ReportsModal.test.tsx` — Pull Sales History panel, day range validation, calls the existing manual backfill flow, surfaces updated local-history coverage.

### E2E

- Sign in as Merchant A → import a distributor catalog → ring a sale → confirm `userData/merchants/<A>/database.sqlite` exists.
- Click `Sign Out` → confirm dialog → SyncProgressModal appears → return to AuthScreen.
- Sign in as Merchant B → confirm `userData/merchants/<B>/database.sqlite` is created → inventory list shows **only B's products** → Reports modal does **not** show A's transactions until the manual pull is run.
- Sign out of B → sign back into A → A's products + cashiers + open POs all return without re-pulling.
- Confirm Supabase: under `merchant_products`, A and B counts each match what was created locally for each (no cross-pollination).

---

## File Touch List

New:

- `src/main/database/migrate-legacy.ts`

Edited:

- `src/main/database/connection.ts`
- `src/main/database/schema.ts` (call `migrateLegacyDbIfPresent` early)
- `src/main/services/supabase.ts:221-239`
- `src/main/services/sync/initial-sync.ts` (drop backfill auto-call)
- `src/main/services/sync-worker.ts` (add `drainSyncQueue` helper, ensure stop/start lifecycle clean)
- `src/main/services/device-registration.ts`
- `src/main/index.ts` (`auth:full-sign-out`, startup sync bound to auth lifecycle, existing history IPCs retained)
- `src/preload/index.ts` + `index.d.ts`
- `src/renderer/src/store/useAuthStore.ts`
- `src/renderer/src/components/layout/BottomShortcutBar.tsx`
- `src/renderer/src/components/layout/HeaderBar.tsx`
- `src/renderer/src/components/reports/ReportsModal.tsx`

Docs:

- This file.
- `docs/features/sales-reports.md` — add the Pull Sales History panel.
- `docs/ai/repo-map.md` — new IPC channels.
- `docs/ai/testing-map.md` — add focused sign-out and history-pull coverage.

---

## Risks

- **Data integrity during the first switch on an existing install.** The legacy migration must run _before_ any IPC fires. Worst case: a half-migrated state where the legacy file is gone but the per-merchant file is also missing. Guard with a transactional `renameSync` + restart-on-failure log.
- **Drain timeout swallowed.** If `drainSyncQueue` times out with items remaining, those items stay in A's DB file and resume on the next A login — acceptable but worth surfacing in the SyncProgressModal so the manager knows why a sync took longer than expected.
- **Cloud `registers` table proliferation.** Every (merchant, fingerprint) pair creates a row. For a multi-store owner with N merchants this becomes N register rows on one machine. Acceptable but document it.
- **Disk usage.** Each merchant DB carries products/transactions/etc. Multi-store owner with 10 merchants on one machine could push ~hundreds of MB. Document; revisit if it bites.
- **Auth state machine drift.** CLAUDE.md says 6 states, code has 10. Adding `signing-out` (transient) makes 11. Update doc explicitly so future contributors do not regress.

---

## Verification

1. `npx prettier --write .`
2. `npm run lint`
3. `npx stylelint "src/**/*.css"`
4. `npm run typecheck`
5. `npm run test:coverage` — must stay ≥ 80%.
6. `npm run test:e2e`.
7. Manual end-to-end multi-merchant test:
   - Sign in as Merchant A → import a distributor catalog → ring a sale → confirm `userData/merchants/<A>/database.sqlite` exists and has the data.
   - Click `Sign Out` → confirm dialog → drain dialog → return to AuthScreen.
   - Sign in as Merchant B → confirm `userData/merchants/<B>/database.sqlite` is created → inventory list shows only B's products → no sales history loads automatically.
   - Sign out of B → sign back into A → A's products + cashiers + open POs all return without re-pulling.
   - In Reports, click `Pull sales history` → 30 days → confirm transactions populate and Realtime keeps streaming new ones.
   - Sync-queue cross-contamination check: rapidly create a draft PO under A, immediately sign out (drain runs), sign in as B, confirm the PO does **not** show up under B in Supabase.
   - Inspect Supabase: `select merchant_id, count(*) from merchant_products group by 1` — A's count and B's count should match what was created locally for each.

---

## Out of Scope

- Concurrent multi-merchant sessions (one active merchant at a time).
- Federated sign-on across merchants (each account still has its own credentials).
- Per-merchant theme or branding beyond the active-account pill.
- Auto sign-out after inactivity.
