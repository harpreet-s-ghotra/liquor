# Move Reorder Dashboard + Purchase Orders into the Inventory Modal

**Status:** Complete
**Date:** 2026-04-23
**Scope:** Relocate the Reorder Dashboard and Purchase Orders tabs from the Manager modal (F6) to the Inventory modal (F2). Tighten the Manager modal down to operational-admin concerns.

---

## Why

The Reorder Dashboard and Purchase Orders workflow are both inventory-centric:

- Reorder rows are derived from product stock / velocity / reorder points.
- Creating a PO pre-fills from reorder output and ultimately commits inventory receipts.
- The store admin flow is: look at inventory → see what's low → cut a PO → receive it → stock updates.

Today this lives under the Manager modal, which bundles it with unrelated concerns (Cashiers, Registers, Merchant Info, Data History). That split forces the operator to switch modals to complete a single inventory task and makes F6 feel like a grab-bag.

Outcome: Inventory becomes the one-stop surface for stock decisions; Manager stays narrow to people / device / infrastructure admin.

---

## Target State

### Inventory modal (F2) — new tab order

| #   | Tab                 | Panel source                                                        |
| --- | ------------------- | ------------------------------------------------------------------- |
| 1   | Items               | `components/inventory/items/ItemForm.tsx` (unchanged)               |
| 2   | Item Types          | `components/inventory/item-types/ItemTypePanel.tsx`                 |
| 3   | Tax Codes           | `components/inventory/tax-codes/TaxCodePanel.tsx`                   |
| 4   | Distributors        | `components/inventory/distributors/DistributorPanel.tsx`            |
| 5   | **Reorder**         | `components/manager/reorder/ReorderDashboard.tsx` (moved)           |
| 6   | **Purchase Orders** | `components/manager/purchase-orders/PurchaseOrderPanel.tsx` (moved) |

### Manager modal (F6) — remaining tabs

| #   | Tab           |
| --- | ------------- |
| 1   | Cashiers      |
| 2   | Registers     |
| 3   | Merchant Info |
| 4   | Data History  |

Manager modal becomes a pure people-and-infrastructure surface. Reorder / PO are gone from it.

### Keyboard + gating

- F2 (Inventory) — admin-only, unchanged. Reorder and PO tabs inherit this gate; no extra auth check needed.
- F6 (Manager) — admin-only, unchanged. Tabs it loses do not affect remaining tabs.
- The existing `manager-modal-last-tab` localStorage key is replaced by `inventory-modal-last-tab` for Inventory's tab memory. Stale Manager values for `reorder` or `purchase-orders` migrate to `items` silently on first load.

---

## Architecture Changes

### File moves (physical relocation, not just imports)

```
src/renderer/src/components/manager/reorder/           ->  src/renderer/src/components/inventory/reorder/
src/renderer/src/components/manager/purchase-orders/   ->  src/renderer/src/components/inventory/purchase-orders/
```

Keep the existing file names (`ReorderDashboard.tsx`, `PurchaseOrderPanel.tsx`, etc.) and their CSS partners. Update every import path across the repo. No API/IPC changes — every `window.api.*` reorder/PO channel stays as-is.

### InventoryModal.tsx changes

1. `src/renderer/src/components/inventory/tabs.ts` — extend the union:
   ```ts
   export const INVENTORY_TABS = [
     'items',
     'item-types',
     'tax-codes',
     'distributors',
     'reorder',
     'purchase-orders'
   ] as const
   ```
2. Add two new `<TabsContent>` blocks in `InventoryModal.tsx` rendering `ReorderDashboard` and `PurchaseOrderPanel`.
3. Lift the reorder → PO prefill handoff out of `ManagerModal.tsx`. The same `prefillItems` / `prefillDistributor` / `prefillUnitThreshold` state pattern moves verbatim into `InventoryModal.tsx` — rename the helper `handleCreateOrder` locally if needed.
4. The inventory search bar + filter chips are already tab-aware. Add branches so Reorder + PO tabs render the existing inner toolbars (reorder filters, PO status filter) inside their own panels instead of the inventory search bar — the two moved panels already ship their own headers, so this is mostly a "do not render the items search bar when `activeTab === 'reorder' | 'purchase-orders'`" change.
5. Adjust the AppModalHeader title mapping so it renders the correct breadcrumb for the two new tabs (e.g. `Reorder Dashboard`, `Purchase Orders`).

### ManagerModal.tsx changes

1. Drop `reorder` and `purchase-orders` from `MANAGER_TABS`.
2. Remove the `prefillItems` / `prefillDistributor` / `prefillUnitThreshold` state — it goes with the migration.
3. Remove `ReorderDashboard` / `PurchaseOrderPanel` imports.
4. Manager modal becomes slightly narrower; optionally reduce `width: min(1400px, 98vw)` to something tighter (follow-up visual tweak, not required).

### Imports to update

A repo-wide rename covers these:

- `@renderer/components/manager/reorder/*` → `@renderer/components/inventory/reorder/*`
- `@renderer/components/manager/purchase-orders/*` → `@renderer/components/inventory/purchase-orders/*`
- Any relative imports inside the two panels (e.g. `../../../hooks/useDebounce`) shift one directory — mostly the `../../../../../shared/types` style relative paths need to stay correct after the move.

### IPC / backend

No changes. All the following channels continue to work as-is:

- `inventory:reorder-products`, `inventory:reorder-distributors`, `inventory:set-discontinued`
- `purchase-orders:list`, `purchase-orders:detail`, `purchase-orders:create`, `purchase-orders:update`, `purchase-orders:receive-item`, `purchase-orders:add-item`, `purchase-orders:remove-item`, `purchase-orders:delete`

### Tests to update

| File                                                                       | Change                                                                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/manager/ManagerModal.test.tsx`                                 | Remove tab assertions for "Reorder Dashboard" and "Purchase Orders"; drop the mocks for reorder/PO APIs; keep the 4 remaining tabs covered.              |
| `components/manager/reorder/ReorderDashboard.test.tsx`                     | Move under `components/inventory/reorder/` and update the import path. No assertion changes.                                                             |
| `components/manager/purchase-orders/PurchaseOrderPanel.test.tsx`           | Same — move + update import.                                                                                                                             |
| `components/inventory/InventoryModal.test.tsx`                             | Add tab-switching coverage for Reorder + Purchase Orders; add one smoke test for the reorder → PO prefill handoff that previously lived in ManagerModal. |
| E2E specs that traverse `Manager → Reorder` or `Manager → Purchase Orders` | Re-route through Inventory modal tab clicks instead. Update selectors / labels in `tests/e2e/`.                                                          |

---

## Completed

- Reorder Dashboard and Purchase Orders moved from `components/manager/` to `components/inventory/`.
- Inventory modal now owns the procurement tabs and the reorder → purchase-order prefill handoff.
- Manager modal now shows only Cashiers, Registers, Merchant Info, and Data History.
- Unit and E2E tests were rerouted from Manager (F6) to Inventory (F2) for procurement flows.

## Migration Steps (execution order)

1. **File move (first).** `git mv` the two directories into `components/inventory/`. Do not change code. Type check will break loudly on import paths — that's the checklist.
2. **Fix imports repo-wide** until typecheck passes. Keep behavior identical at this stage.
3. **Wire Inventory tabs.** Extend `INVENTORY_TABS`, add `<TabsContent>` blocks, lift the prefill state. Verify tab switching visually.
4. **Trim Manager modal.** Remove tab triggers, content blocks, and unused state. Make sure the Manager modal test file still passes.
5. **Search bar / toolbar rules.** Hide the items search bar when the active tab is Reorder or Purchase Orders. Confirm the relocated panels still render their own filters cleanly inside the Inventory shell.
6. **Tests.** Move the two panel test files; update the Manager test to drop the removed tabs; add Inventory tab-switching coverage.
7. **Docs.** Update `docs/features/manager-modal.md`, `docs/features/reorder-dashboard-v2.md`, `docs/features/inventory-v2.md`, and `docs/ai/inventory-map.md` + `docs/ai/repo-map.md` with the new locations. Add a row to this plan's "Completed" section when the work ships.
8. **E2E sweep.** Run `npm run test:e2e`. Fix any selector that still navigates via Manager.

---

## Risk + Rollback

- Low-risk move. No schema, IPC, or business-logic changes.
- Highest breakage surface is import paths — the type checker guards this.
- Second highest: E2E selectors that click through Manager. Grep for `role: 'tab', name: /Reorder|Purchase/` in `tests/e2e/`.
- Rollback: `git revert` the single refactor commit. Nothing downstream persists state keyed to the old location (localStorage tab memory is per-modal and harmless if stale).

---

## Verification

1. `npx prettier --write .`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:coverage` — must stay ≥ 80%.
5. `npm run test:e2e`.
6. Manual:
   - F2 → Items tab loads by default.
   - F2 → Reorder tab → distributor picker works → `Create Order` hands off to Purchase Orders tab with the items pre-filled and the distributor locked.
   - F2 → Purchase Orders tab → existing PO flows (create / submit / receive / cancel) all pass.
   - F6 → shows only the 4 remaining tabs; no lingering reorder/PO triggers.
   - Reload the app, re-open F2 on Reorder tab, close, re-open — last tab preference persists.
   - Reload the app, re-open F6 — if the saved Manager tab was `reorder` or `purchase-orders`, it falls back to `cashiers` without throwing.

---

## Open Follow-Ups (not part of this move)

- Consider renaming the Inventory modal's breadcrumb label from `Inventory` to `Inventory & Procurement` once Reorder / PO land.
- Consider an Inventory-scoped sub-navigation (Items / Taxonomy / Procurement) if the tab count becomes unwieldy.
- Merge the "Needs pricing" chip filter with a future "Needs reorder" chip once reorder lives in the same modal.
