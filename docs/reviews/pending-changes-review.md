# Senior Review — Pending Uncommitted Changes

**Date:** 2026-04-24
**Branch:** `main`
**Scope:** 97 files changed, +2914 / -4587

---

## Headline

**Too much in one commit.** The working tree bundles five-plus unrelated features:

- Inventory v2: Reorder Dashboard + Purchase Orders moved from Manager modal into Inventory modal
- Multi-merchant per-account DB isolation (`merchants/<id>/database.sqlite` + legacy-DB migration)
- Velocity-based reorder projections (new Supabase RPC + `velocity-sync`)
- New auth states: `signing-out`, `set-password`, `pin-reset`, `business-setup`, `syncing-initial`
- Extracted `SearchDropdown` + `useSearchDropdown` keyboard-nav hook
- New `useAlertStore` / `AlertBar` toast system, `SignOutProgressModal`
- Size-field normalization fix, sync-drain-on-sign-out, SKU existence check + pull-by-SKU

Plus 20+ doc files and an untracked `test_output.txt` stray file.

**Action:** Split into feature-scoped commits/PRs. `git bisect` becomes useless at this granularity, and review load is too high for meaningful sign-off. Make sure the deleted `src/renderer/src/components/manager/purchase-orders/*` and new `src/renderer/src/components/inventory/purchase-orders/*` land in the same commit so CI doesn't break mid-bisect.

---

## Architecture — Direction Is Right

- `startMerchantSyncSession` / `stopMerchantSession` in `src/main/index.ts` — good. Boot logic that was scattered (3s `setTimeout`, inline `clearMerchantConfig`) is now centralized and called from auth IPC.
- Per-merchant DB at `merchants/<merchant_account_id>/database.sqlite` — correct multi-tenant model. `migrate-legacy.ts` handles the one-time move from the shared `data/liquor-pos.db` path with both `merchant_account_id` and legacy `merchant_id` match semantics.
- `drainSyncQueue(10_000)` on full sign-out — thoughtful back-pressure. Returns `{ drained, remaining }` so the UI can inform the user.
- `registerDatabaseInitializer` indirection in `connection.ts` + `schema.ts` avoids a circular import between schema and connection. Clean.
- New tests for `connection.ts`, `schema.ts`, `initial-sync.ts`, `velocity-sync.ts`, `useAlertStore`, `useSearchDropdown`, `SearchDropdown`, `SyncProgressModal`, `BottomShortcutBar`, `badge`, `popover`, `separator` — coverage added alongside code. Good.

---

## Concerns

### 1. Sign-in now blocks on sync setup — potential regression

**Where:** `src/main/index.ts:627-669`, `src/main/index.ts:103-114`

`auth:login`, `auth:check-session`, `auth:set-password` now `await startMerchantSyncSession(...)` before returning the `AuthResult`. `startMerchantSyncSession` awaits `registerDevice(client, merchantAccountId)` — a network call to Supabase — before starting the sync worker.

Old code fired sync setup via `setTimeout(3000)` after `app.whenReady`, fully decoupled from login.

Risks:

- If `registerDevice` is slow or flaky, login UI hangs.
- No timeout wrapper.
- `runInitialSync` is `void`-ed, but no abort path exists if user signs out of merchant A mid-sync and signs into merchant B. The in-flight sync writes into whatever `getDb()` now returns — cross-merchant data bleed.

**Fix:**

- Return `AuthResult` immediately, kick off `startMerchantSyncSession` fire-and-forget, let renderer poll `sync:get-initial-status` (already wired).
- At minimum, bound `registerDevice` with a timeout and fall back to offline-first login.
- Pass `merchantAccountId` into `runInitialSync` and check it equals `getActiveMerchantAccountId()` between entity stages; bail if changed.

---

### 2. `setActiveMerchantDb` has side effects before merchant fetch is confirmed good

**Where:** `src/main/services/supabase.ts:241-305`

`fetchAndSaveMerchant` calls `setActiveMerchantDb(merchantAccountId, finixMerchantId)` at line 260 — which opens/creates `merchants/<id>/database.sqlite` and runs `applySchema` + `seedData` — _before_ the edge function `get-finix-config` is invoked. If any future edit throws between line 260 and `saveMerchantConfig`, the active DB has been switched to a half-configured state.

Today both the success path and the edge-function-failure path reach `saveMerchantConfig`, so it's currently safe. The ordering is fragile, though.

**Fix:** Move `setActiveMerchantDb` after a verified merchant fetch, or wrap the post-switch work in a try/rollback that closes the DB and restores the previous active merchant on error.

---

### 3. `resolvePostAuthState` loads the entire product catalog to check emptiness

**Where:** `src/renderer/src/store/useAuthStore.ts:58-89`

```ts
const products = await window.api!.getProducts()
if (products.length === 0) return 'distributor-onboarding'
```

On a merchant with 50k products, this loads all of them (via IPC) just to check `length === 0`. Same in `resolvePostSyncState` and `completeSetup` / `completeBusinessSetup`.

**Fix:** Add `getProductCount()` or `SELECT EXISTS(SELECT 1 FROM products WHERE is_active=1)` IPC. Also, `resolvePostAuthState` and `resolvePostSyncState` differ only in the `pin-setup` vs `syncing-initial` branch — extract a shared resolver.

---

### 4. File sizes — refactor pressure

| File                                                                           | Lines                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `src/main/index.ts`                                                            | 1759 (127 `handle()` calls, 107 `try {}` wrappers) |
| `src/renderer/src/components/inventory/items/ItemForm.tsx`                     | 1598                                               |
| `src/renderer/src/components/inventory/purchase-orders/PurchaseOrderPanel.tsx` | 1272                                               |
| `src/renderer/src/components/inventory/reorder/ReorderDashboard.tsx`           | 662                                                |

Every IPC handler in `main/index.ts` wraps its body in the same:

```ts
try {
  return await doX(args)
} catch (err) {
  throw new Error(err instanceof Error ? err.message : 'Failed to X')
}
```

Extract a `handleSafe(channel, fn, fallbackMsg)` helper — drops ~200 lines and makes new handlers harder to get wrong.

`ItemForm.tsx` and `PurchaseOrderPanel.tsx` need to be split by inner tab / section. They're single files doing too many jobs and will become merge-conflict magnets.

---

### 5. `purchase-orders.repo.ts` — inventory math and cost-layer integrity

**Where:** `src/main/database/purchase-orders.repo.ts:316-349, 394-447, 87-114`

**a.** Dual-column write:

```sql
UPDATE products
SET in_stock = COALESCE(in_stock, quantity, 0) + ?,
    quantity = COALESCE(quantity, in_stock, 0) + ?
WHERE id = ?
```

This is a band-aid over an unresolved single-source-of-truth problem. Writing both with the same delta works today, but it keeps the parallel columns alive and encourages future code to pick one arbitrarily. File a debt ticket to consolidate to `in_stock` and drop `quantity`.

**b.** `updatePurchaseOrderItems` retroactively edits `product_cost_layers.cost_per_unit`:

```sql
UPDATE product_cost_layers
SET cost_per_unit = ?
WHERE product_id = ? AND source_reference = ?
```

If the layer has already been partially consumed by sales, historical COGS changes retroactively. Verify reports tolerate this. If not, restrict cost edits to unconsumed layers, or record a cost-correction delta instead of mutating.

**c.** `reconcilePurchaseOrderStatus` auto-reverts `received` → `submitted` when an edit pushes received counts below ordered. Intentional? If so, document in the feature spec; if not, lock status once received.

---

### 6. `resolveDistributorNumber` silently drops unknown distributors

**Where:** `src/main/services/sync/product-sync.ts:15-24`

Remote product references a distributor not yet reconciled locally → `distributor_number` gets set to `null`. `runInitialSync` reconciles distributors before products, so the initial-sync path is safe. But the Realtime change path (`applyRemoteProductChange` called from `sync-worker`) doesn't guarantee ordering — a new product arriving for a brand-new distributor loses the link.

**Fix:** Either reconcile distributors on demand when a new distributor_number is seen, or run a periodic backfill pass that re-links products with null distributor_numbers when matching distributors exist.

---

### 7. `error` field misused as a general message channel

**Where:** `src/renderer/src/store/useAuthStore.ts:186-205`

```ts
error: result.remaining > 0
  ? `${result.remaining} sync item(s) remain queued for this account. They will resume next sign-in.`
  : null
```

This is informational, not an error. `useAlertStore.showWarning(...)` is the right home now that it exists.

`handleInviteLink` has a dead `void email` block (lines 146-159) — leftover scaffolding. Drop it.

---

### 8. `useAlertStore` — minor cleanup

**Where:** `src/renderer/src/store/useAlertStore.ts`

- No stacking cap. A chatty code path could pile up dozens of alerts. Cap at ~5 (drop oldest).
- `setTimeout` ids are never retained or cleared. Manually dismissing an alert leaves the timer alive until it fires a no-op `dismissAlert`. Not a bug, but tidier to store the timer id on the alert and `clearTimeout` on manual dismiss.

---

### 9. `useSearchDropdown` highlight resets too eagerly

**Where:** `src/renderer/src/hooks/useSearchDropdown.ts:37-39`

```ts
useEffect(() => {
  setHighlightIndex(-1)
}, [results, isOpen])
```

Highlight resets whenever `results` identity changes — even if the underlying list is the same (e.g., debounced refetch returns the same rows). User's highlight position drops every keystroke in the worst case. Consider resetting on length change or content hash instead of reference.

---

### 10. Hygiene

- Untracked `test_output.txt` at repo root — stray Vitest console capture. Delete, add pattern to `.gitignore`.
- 20+ doc files modified in the same tree as substantive code changes. Split `docs:` commits so reviewers can skim the code diff.

---

### 11. Minor

- `src/main/services/supabase.ts:30-32` — hardcoded `SUPABASE_URL` and anon key. The comment justifies this (anon key is public, protected by RLS). Acceptable, but document the rotation procedure somewhere obvious and consider env-overrides for staging.
- `src/main/database/migrate-legacy.ts` uses `renameSync`. Fine because `userData` is a single filesystem root on every platform Electron supports. Worth a comment.
- `src/main/database/connection.ts:26-64` — `closeActiveMerchantDb()` + `setDatabase(nextDb)` both close the prior DB (guarded). Dual-ownership of the `database` variable lifecycle is confusing. Consolidate to one owner of close semantics.
- `runInitialSync` reconciles strictly sequentially: `settings → tax_codes → distributors → item_types → departments → cashiers → products`. Only `products` depends on the rest; `tax_codes / distributors / item_types / departments / cashiers / settings` are independent of each other and could run in parallel. Not critical (one-time cost) but an easy win on a cold login.
- `src/main/index.ts` — no `try` wrapper on `sync:get-initial-status` (`src/main/index.ts:1166-1168`). Fine for a pure getter, but the inconsistency stands out next to every other handler.

---

## Verdict

Architectural direction is correct. Blockers before merging as-is:

1. **Split commits.** Five+ features in one tree is unreviewable.
2. **Don't block login on `registerDevice`.** Either fire-and-forget the sync session or bound it with a timeout.
3. **Guard `runInitialSync` against mid-flight merchant switch.** Cancel token or merchant-id check between entities.
4. **Delete `test_output.txt`.**

Everything else is follow-up debt worth tickets but not blocking.

---

## Implementation Status — 2026-04-24

Everything below has been applied except where noted. All 908 renderer + 441 node tests pass; typecheck clean.

| #   | Concern                                    | Status                                                                                                                                                                                                                                   |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —   | Split commits                              | **Not done** — user owns this, not a code change                                                                                                                                                                                         |
| 1   | Sign-in blocks on `registerDevice`         | Done — `startMerchantSyncSession` now fire-and-forget; merchant-switch guard added to `runInitialSync` and `reconcileProducts`                                                                                                           |
| 2   | `setActiveMerchantDb` ordering             | Done — post-activation work wrapped in try/rollback that closes the DB on error                                                                                                                                                          |
| 3   | `resolvePostAuthState` loads full catalog  | Done — new `hasAnyActiveProduct()` repo + `products:has-any` IPC + `hasAnyProduct` preload; shared `resolveAppState` helper replaces duplicate resolvers; `completeSetup` / `completeBusinessSetup` updated                              |
| 4   | File sizes & `handleSafe` helper           | **Skipped** — `handle()` already catches/logs/rethrows, so per-handler wrappers are DRY-violation not correctness. 127-site rewrite inflates diff with typo risk. ItemForm/PurchaseOrderPanel splits are multi-day refactors. Follow-up. |
| 5a  | Dual-column `quantity`/`in_stock`          | **Skipped** — flagged as debt ticket in the review. Consolidation is a separate effort.                                                                                                                                                  |
| 5b  | Cost-layer retroactive edit                | Done — cost edit now rejected if the layer has been consumed by sales; only rewrites unconsumed layers                                                                                                                                   |
| 5c  | Status auto-revert on edit                 | Done — `reconcilePurchaseOrderStatus` locks once `received`; PO status no longer downgrades to `submitted` when later edits reduce received counts. Existing test updated to match.                                                      |
| 6   | Silent distributor drop                    | Done — `resolveDistributorNumber` in `product-sync.ts` now does a just-in-time pull from `merchant_distributors` when the local row is missing, so Realtime product arrivals don't orphan                                                |
| 7   | `error` field misuse                       | Done — sign-out informational message routed via `useAlertStore.showWarning`; dead `void email` scaffolding removed from `handleInviteLink`                                                                                              |
| 8   | `useAlertStore`                            | Done — `MAX_ALERTS = 5` stacking cap (drops oldest); timer ids retained in a module-level `Map` and cleared on manual dismiss                                                                                                            |
| 9   | `useSearchDropdown` highlight reset        | Done — reset now keyed on `results.length` instead of `results` reference, so same-size refetches don't drop the user's highlight                                                                                                        |
| 10a | `test_output.txt` stray                    | Done — deleted, added to `.gitignore`                                                                                                                                                                                                    |
| 10b | Doc churn bundled with code                | **Not done** — depends on split-commits decision                                                                                                                                                                                         |
| 11a | Hardcoded Supabase URL + anon key          | **Skipped** — comment already justifies. Env-override is a follow-up.                                                                                                                                                                    |
| 11b | `renameSync` fs-root assumption            | Done — added inline comment documenting the userData single-fs guarantee                                                                                                                                                                 |
| 11c | Connection dual-ownership                  | Done — `setActiveMerchantDb` is now sole lifecycle owner; `setDatabase` docstring marks it as test-only                                                                                                                                  |
| 11d | Sequential non-product sync stages         | Done — `settings`, `tax_codes`, `distributors`, `item_types`, `departments`, `cashiers` now run via `Promise.all`; products still waits                                                                                                  |
| 11e | `sync:get-initial-status` missing try-wrap | **Skipped** — pure getter, no throw surface. Not worth the noise.                                                                                                                                                                        |

### Follow-up debt (not in this pass)

- Split the working tree into feature-scoped commits (user's decision).
- Full migration of the 127 IPC `try/catch` wrappers to a `handleSafe` helper.
- Split `ItemForm.tsx` (1598 lines) and `PurchaseOrderPanel.tsx` (1272 lines) by inner tab / section.
- Consolidate `products.quantity` and `products.in_stock` to a single source of truth.
- Move hardcoded Supabase URL + anon key to env-overrides for staging.
