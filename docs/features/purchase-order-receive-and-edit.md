# Purchase Order Receiving + Editing Improvements

**Status:** Complete
**Date:** 2026-04-23
**Scope:** Add explicit receive confirmation, post-create edits, case-aware receiving, and unit/case price interlock to the Purchase Orders tab inside the Inventory modal (F2).

---

## Why

Today the PO detail view has gaps that force operators around the workflow:

1. **No explicit "received" action.** A submitted PO only flips to `received` when every line's `quantity_received` matches `quantity_ordered`. There is no one-click "we got the whole shipment" button — operators have to tab through every row.
2. **No way to correct mistakes.** `receivePurchaseOrderItem` in `purchase-orders.repo.ts:236` throws `"Received quantity cannot be reduced once recorded"`. A typo on receive is permanent.
3. **No case-level receive.** Orders are created in cases (`quantity_cases × bottles_per_case`), but the detail view only exposes units. Operator has to mentally multiply "we got 5 cases" → "type 60 units."
4. **Price editing is one-directional.** Create flow only edits unit cost; case cost is invisible. After submit, neither is editable. If the invoice price differs from what was entered, there is no fix path.

---

## Target Behaviour

### 1. Detail view — receive controls

Add to a `submitted` PO detail header:

- **`Mark Fully Received`** button (variant `success`) — fills every line's `quantity_received` to its `quantity_ordered`, auto-flips PO to `received`. Confirms with `ConfirmDialog`.
- **`Edit`** button (variant `neutral`) — toggles an "edit mode" on the detail view (see §3).

Per-line on a `submitted` PO, replace the bare `<input>` at `PurchaseOrderPanel.tsx:702` with a row containing:

| Column                    | Behaviour                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cases ordered`           | Display only. `quantity_ordered / bottles_per_case`.                                                                                                                  |
| `Receive full case order` | Checkbox. When checked, `quantity_received := quantity_ordered`. When unchecked, reverts to last manually entered value (or 0 if none).                               |
| `Cases received`          | Editable number, capped at `cases ordered` for the typical case but allowed to overflow to handle "vendor sent extra" (see §5). Linked two-way with `Units received`. |
| `Units received`          | Editable number, capped at `quantity_ordered + tolerance`. Linked two-way with `Cases received`. Manual edit unchecks the case checkbox.                              |
| `Line Total`              | Display only.                                                                                                                                                         |

Auto-receive behaviour stays — when every line hits `quantity_ordered`, PO auto-flips to `received`. The existing inventory-delta + cost-layer side effects (`purchase-orders.repo.ts:247-288`) stay untouched for incremental receives.

### 2. Detail view — `received` PO

Today a `received` PO is read-only and shows nothing actionable. Add an **`Edit`** button that toggles edit mode (see §3). This is the "I entered the wrong quantity yesterday" path.

### 3. Edit mode

Edit mode is a UI affordance that re-opens line items for change on a PO that is `submitted` **or** `received`. While in edit mode:

- Status badge shows `editing` (visual only — DB status unchanged until exit).
- Each line exposes `unit_cost`, `case_cost`, `quantity_ordered`, `quantity_received` as editable.
- Footer buttons: `Save Changes` and `Cancel`.

`Save Changes` emits a single `updatePurchaseOrderLines` IPC with the diff of changed fields per line. The repo:

- Re-validates each line.
- For `quantity_received` deltas (positive **or negative**):
  - Compute `delta = newReceived - previousReceived`.
  - If `delta != 0`: adjust `products.in_stock`/`quantity` by `delta`, write a balancing `inventory_delta` (`reason='receiving_correction'`, `reference_id='po-item-<id>-correction-<ts>'`), and write a balancing cost layer (positive `delta` → new layer; negative `delta` → consume from the original `po-item-<id>` layer using FIFO consume helpers in `product-cost-layers.repo.ts`).
- For `unit_cost` changes on lines with `quantity_received > 0`: rewrite the matching cost layer's `cost_per_unit` (no quantity change). Document this as the trade-off — historic FIFO cost basis on already-sold units does not retroactively change.
- Recalculate PO totals via existing `recalcTotals`.
- If status was `received` and any line now has `quantity_received < quantity_ordered`, drop status back to `submitted`. If status was `submitted` and every line now matches, flip to `received` (existing logic).

Permission: edit mode is admin-gated (same gate as the rest of F2 — no extra check needed). Add a confirm dialog before saving when the edit reduces inventory ("This will reduce on-hand stock by N units. Continue?").

### 4. Create + edit forms — unit/case price interlock

Currently the create form (`PurchaseOrderPanel.tsx:553-598`) only shows `Unit Cost`, `Cases`, `Items`, `Line Total`. Replace with:

| Column     | Behaviour                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit Cost  | Editable. Editing recomputes `case_cost = unit_cost × bottles_per_case`.                                                                               |
| Case Cost  | Editable. Editing recomputes `unit_cost = case_cost / bottles_per_case`. Round to 4 decimals to avoid loss; persist `unit_cost` rounded to 4 decimals. |
| Cases      | Existing.                                                                                                                                              |
| Items      | Existing display (`cases × bottles_per_case`).                                                                                                         |
| Line Total | `unit_cost × items`.                                                                                                                                   |

Implementation: split `handleCreateItemCostChange` into two handlers (`handleUnitCostChange`, `handleCaseCostChange`) that both update `unit_cost` in state — `case_cost` is purely derived from `unit_cost × bottles_per_case` for display. Storing only `unit_cost` keeps DB schema unchanged and keeps a single source of truth.

Edge case: `bottles_per_case <= 0`. Treat as 1 (matches `normalizePositiveInt` fallback). In this case Case Cost field is disabled and shows `--`.

The same two-field pair is the editor in §3 edit mode.

---

## Architecture Changes

### Types (`src/shared/types/index.ts`)

Add to `PurchaseOrderItem`:

```ts
export type PurchaseOrderItem = {
  // existing...
  bottles_per_case: number // copied from products.bottles_per_case at create
}
```

New input type:

```ts
export type UpdatePurchaseOrderItemsInput = {
  po_id: number
  lines: Array<{
    id: number
    unit_cost?: number
    quantity_ordered?: number
    quantity_received?: number
  }>
}
```

New input for the "fully received" shortcut (optional — could be a thin wrapper around the bulk update):

```ts
export type MarkPurchaseOrderReceivedInput = {
  id: number
}
```

### Schema (`src/main/database/schema.ts`)

Add column `purchase_order_items.bottles_per_case INTEGER NOT NULL DEFAULT 1`. One-time migration block: backfill from `products.bottles_per_case` for existing rows where `purchase_order_items.bottles_per_case = 1`.

### Repo (`src/main/database/purchase-orders.repo.ts`)

1. `createPurchaseOrder` — copy `products.bottles_per_case` into the insert.
2. New `updatePurchaseOrderItems(input: UpdatePurchaseOrderItemsInput)`:
   - Wrap in `db.transaction`.
   - Per-line: load current row, apply diffs, run validation.
   - For `quantity_received` deltas: emit balancing inventory_delta (`reason='receiving_correction'`) and FIFO cost-layer adjustment (consume on negative, create on positive).
   - For `unit_cost` updates on lines with prior receipts: update the matching cost layer in place and emit a `inventory_delta` with `delta=0` and a `cost_correction` reason for audit (or skip if delta-table semantics don't allow zero — then write a separate `audit_log` row; decide during implementation).
   - Recalc totals. Reconcile PO status (drop to `submitted` if no longer fully received; promote to `received` if now fully received).
3. New `markPurchaseOrderFullyReceived(id)`:
   - Calls `updatePurchaseOrderItems` internally with `quantity_received := quantity_ordered` for every outstanding line.
   - Returns the refreshed `PurchaseOrderDetail`.
4. Remove the hard rejection at `purchase-orders.repo.ts:236`. The "no reductions on the per-item receive endpoint" guard moves into a softer rule: `receivePurchaseOrderItem` (the per-row save during normal receiving) keeps the no-reduce rule; corrections must go through `updatePurchaseOrderItems`.

### IPC (`src/main/index.ts` + preload)

New channels:

- `purchase-orders:update-items` → `updatePurchaseOrderItems`
- `purchase-orders:mark-received` → `markPurchaseOrderFullyReceived`

Expose via `contextBridge` and add types to `src/preload/index.d.ts`.

### Sync

`receivePurchaseOrderItem` already enqueues an `inventory_delta` sync event. The new correction path must enqueue the same way for negative and positive corrections — reuse `enqueueSyncItem` per delta inside the transaction. No new sync entity types needed; `inventory_delta` already covers it.

### UI (`PurchaseOrderPanel.tsx`)

- Add `editMode: boolean` state to the detail view.
- New `EditableLineRow` and `ReceiveLineRow` subcomponents to keep the detail table readable. Both share a `LineEditor` hook that owns the unit/case interlock math.
- `Mark Fully Received` button — `ConfirmDialog` → `api.markPurchaseOrderReceived(id)` → reload detail.
- `Edit` button — toggles `editMode`. Save calls `api.updatePurchaseOrderItems`. Cancel discards local state.
- Reuse existing `formatCurrency` and `normalizePositiveInt` helpers — do not introduce new currency formatting.

### Component reuse

Per `CLAUDE.md` "Component Reuse Rules": all new buttons use `AppButton`, all new inputs use `InventoryInput`/`InventorySelect`, line-level checkboxes use `Checkbox` from `ui/checkbox`. Confirmation prompts use `ConfirmDialog`. Errors use `ErrorModal` only when blocking; inline `po-panel__msg--error` is fine for transient feedback (matches existing pattern).

---

## Tests

### Backend (`purchase-orders.repo.test.ts`)

- `updatePurchaseOrderItems` — increases received qty, decreases received qty, both at once across lines, status drops back to `submitted` when reducing below ordered, status promotes to `received` when raising to ordered, rejects negative quantities, rejects edits on `cancelled` orders.
- `updatePurchaseOrderItems` — unit_cost rewrite updates the matching cost layer's `cost_per_unit`.
- `updatePurchaseOrderItems` — emits balancing `inventory_delta` rows with `reason='receiving_correction'`.
- `markPurchaseOrderFullyReceived` — flips status, fills all lines, idempotent on already-received PO.

### Renderer (`PurchaseOrderPanel.test.tsx`)

- Detail view renders new `Mark Fully Received` button only on submitted POs.
- Detail view renders `Edit` button on submitted + received POs.
- Receive row: checking "Receive full case order" pre-fills units to `quantity_ordered`; unchecking reverts.
- Edit mode: editing case cost updates unit cost (and vice versa) with `bottles_per_case` math.
- Edit mode: saving with reduced `quantity_received` triggers the confirm dialog.
- Edit mode: save calls `api.updatePurchaseOrderItems` with only the changed lines.

### E2E (`tests/e2e/purchase-orders.spec.ts` — likely needs creating, or extend existing inventory spec)

- Open F2 → Purchase Orders → submitted PO → click `Mark Fully Received` → confirm → status badge shows `received`.
- Open a received PO → `Edit` → reduce a line by 5 units → save → confirm dialog → status drops to `submitted`.
- New PO → enter case cost on a line → unit cost auto-fills → submit → detail view shows derived line total.

---

## Out of Scope

- Vendor invoice reconciliation (matching invoice PDF totals to PO).
- Multi-step approval workflow.
- Receiving against multiple POs at once.
- Sync of corrections to other registers via Realtime — already covered by the `inventory_delta` flow and needs no new logic.

---

## Risks

- **FIFO cost-layer rewrites are subtle.** A negative correction on a line whose units have already been _sold_ leaves the historic cost basis on those sales unchanged — that is correct accounting behaviour, but call it out in the confirm dialog so operators understand the limit.
- **Concurrent receivers.** Two operators on two registers receiving the same PO simultaneously: the cloud sync will reconcile via `inventory_delta` events, but PO status flips happen locally. Acceptable for v1; revisit if it causes drift.
- **Schema migration.** Adding `bottles_per_case` to `purchase_order_items` is additive with a default — safe rollback. Existing rows backfill from products in the same migration.

---

## Verification

1. `npx prettier --write .`
2. `npm run lint`
3. `npx stylelint "src/**/*.css"`
4. `npm run typecheck`
5. `npm run test:coverage` — must stay ≥ 80%.
6. `npm run test:e2e`.
7. Manual:
   - Submitted PO → click `Mark Fully Received` → status goes `received`, on-hand stock for each line increases by the outstanding qty.
   - Submitted PO → check "Receive full case order" on one line → units field auto-fills to ordered qty → save → row turns received, line auto-blurs.
   - Received PO → `Edit` → reduce one line's received qty by 6 → save → confirm dialog → status drops to `submitted`, products.in_stock decreases by 6, a `receiving_correction` inventory_delta is recorded.
   - New PO draft → enter `Case Cost = 120.00` on a 12-bottle line → `Unit Cost` updates to `10.0000` → enter `Unit Cost = 11.50` → `Case Cost` updates to `138.00` → submit → detail shows correct line total.
   - Inventory map (`docs/ai/inventory-map.md`) and PO doc here both reflect the new flow.

---

## Documentation Touches

- This file is the spec — keep status in sync as work lands.
- Add a row to `docs/README.md` index.
- Update `docs/ai/inventory-map.md` to reference the new IPC channels (`purchase-orders:update-items`, `purchase-orders:mark-received`) and the new fields on `PurchaseOrderItem`.
- Update `CLAUDE.md` Documentation table once this ships.
