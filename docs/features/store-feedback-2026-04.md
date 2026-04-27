# Store Feedback Batch — April 2026

**Status:** Planned · single bundled PR
**Source:** Live store test, 2026-04-25
**Owner:** Inventory + Search + POS UX

## Context

Owner tested the POS in a live liquor store and returned with a batch of UX gaps across the inventory modal, the search surfaces, the customer-facing display, hold flow, tax codes, special pricing, and pricing precision. Decisions agreed up front:

- **One bundled PR**, single review, single release.
- **Mix-and-match: plan only** in `docs/features/pricing-engine.md`. No code.
- **Item Number: per-distributor mapping table**. The same product can be ordered from multiple distributors, each with its own catalog number.
- **Brand autocomplete source: distinct from products table** (no separate brands table).

E2E tests required for every user-visible change. Backend repo tests for every schema/SQL change.

---

## 1. Pricing precision (3 decimals on cost)

- **Why**: Per-bottle cost from distributors sometimes has 3dp (e.g. case cost / bottles_per_case rounding).
- **Files**:
  - `src/renderer/src/utils/currency.ts` — add `parseCurrencyDigitsToDollars3dp` (or a `decimals: number` arg). Existing `formatCurrency` already accepts options; add a 3dp-aware formatter for cost cells.
  - `src/renderer/src/components/inventory/items/ItemForm.tsx` (Per Bottle Cost field, ~line 1012) — switch the cost input to a 3dp parser; retail price + tax stay 2dp.
  - DB column `products.cost` is REAL — no migration needed.
- **Tests**: backend repo test (saveInventoryItem with cost 12.345 round-trips); e2e (type 12.345, save, recall, value preserved).

---

## 2. Inventory modal (13 sub-items)

### 2.1 Keep focus on search input after a result is opened
- File: `src/renderer/src/components/inventory/InventoryModal.tsx` `selectSearchResult` (~line 220) — do **not** blur the search input; clear `searchTerm` and re-focus `searchInputRef`.
- E2E: load item via Enter, focus stays on search input, scan a second SKU, second item loads.

### 2.2 Wider search results with price/distributor columns
- File: `src/renderer/src/components/inventory/footer/FooterActionBar.tsx` (results row, ~line 85). Add `price`, `distributor_name`, and `in_stock` columns. Widen the dropdown.
- Backend `searchInventoryProducts` already returns these.
- E2E: search "wine", assert each row shows price + distributor.

### 2.3 Item Number per distributor (Additional Info)
- **Schema (local)**: new table
  ```sql
  CREATE TABLE product_distributor_item_numbers (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    distributor_number INTEGER NOT NULL,
    item_number TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, distributor_number)
  );
  ```
- **Cloud migration**: `supabase/migrations/<ts>_add_merchant_product_distributor_item_numbers.sql` mirroring above with `merchant_id` + RLS.
- **Repo**: `src/main/database/product-distributor-item-numbers.repo.ts` — `list`, `upsert`, `delete`, `findFor(productId, distributorNumber)`.
- **Sync**: extend `ProductSyncPayload` in `src/main/services/sync/types.ts` with `distributor_item_numbers: Array<{distributor_number, item_number}>`. Wire upload in `product-sync.ts`, apply in inbound handler.
- **UI**: Additional Info tab — small editable list (one row per distributor). Add/remove buttons, distributor dropdown reuses existing distributor list.
- **PO autofill**: `src/renderer/src/components/inventory/purchase-orders/PurchaseOrderPanel.tsx` — when adding a line, look up `findFor(product_id, distributor_number)` and prefill the existing item-number column on the PO row. Cashier can override.
- **Tests**: repo tests for the table; e2e (set 2 numbers for one product, create PO, both prefill correctly).

### 2.4 Gross margin + Net margin
- **Formulas** (documented in code comment + this doc):
  - `gross_margin = (price - cost) / price * 100`
  - `net_margin = (price - cost) / (price * (1 + tax_rate)) * 100` — i.e. margin on the customer-paid amount including tax.
- **Files**: `ItemForm.tsx` (replace existing single Profit Margin display, ~line 1119–1148, with two adjacent cells).
- **Tests**: ItemForm.test.tsx asserts both numbers; e2e asserts both labels visible.

### 2.5 Low-margin review tab
- New top-level inventory outer tab **"Low Margin"** mirroring Reorder Dashboard pattern (`ReorderDashboard.tsx`).
- Threshold dropdown (10/15/20/25/30%); margin type toggle (gross/net).
- Backend: new `src/main/database/products.repo.ts` `getLowMarginProducts({threshold, marginType})` — computes margin in SQL, filters, returns inventory rows.
- Click row → opens that item in the Items tab via existing `openItemNumber` flow.
- **Tests**: backend repo test; e2e (set low cost item, verify it appears in Low Margin tab; raise price, verify it leaves).

### 2.6 Open / fuzzy search
- See section 3.1 — same backend change benefits both inventory + POS search.

### 2.7 Duplicate-as-new
- Add `ItemFormHandle.duplicateCurrentAsNew()` in `ItemForm.tsx` (~line 112). Behavior: snapshot current `formState`, clear `sku`, clear `selectedItem` id, leave brand / item_type / cost / price / tax / sizes intact, focus the SKU field.
- Add `Duplicate` button in FooterActionBar (enabled when an item is selected).
- **Tests**: e2e (load item, click Duplicate, fill SKU, save, two items in DB).

### 2.8 Scan unique SKU auto-opens
- File: `InventoryModal.tsx` debounced search effect (~line 152). When the result set length is 1 **and** the lone result's SKU exactly equals the trimmed search term (case-insensitive), call `selectSearchResult(result)` automatically + clear the search to await the next scan.
- **Tests**: e2e (scan SKU "WINE-001", form populates without clicking).

### 2.9 Compact pricing field layout
- Re-flow `ItemForm.tsx` General Info grid (~line 836). Drop `field-span-2` from the price/tax/margin cells so 4 fit per row. Order:
  1. **Row P1**: Per Bottle Cost · Price · Tax Profile · Final w/ Tax
  2. **Row P2**: Gross Margin · Net Margin · Discounts · (empty)
- Brand / Item / Display Name / Item Type / Distributor / SKU / Size / In Stock keep their current positions.
- **Tests**: ItemForm.test.tsx + e2e — cost, price, tax, final price, gross margin, net margin all visible without scrolling at the default modal height.

### 2.10 Unsaved-change guard + tab state
- Track `formDirty` in `ItemForm.tsx` by comparing current `formState` against an `initialFormState` snapshot taken in `selectItem` / `handleNewItem` / `startNewWithSku`.
- On inner-tab change, outer-tab change, modal close, or selecting a different item: if `formDirty`, render existing `ConfirmDialog` with **Save · Discard · Cancel**.
- Inner-tab state already kept in component state; persist last-active inner tab keyed by `selectedItem.item_number` in a Map (in-memory, not localStorage — clears on modal close).
- **Tests**: e2e (edit field, click another tab → dialog appears; Save persists, Discard reverts, Cancel stays).

### 2.11 New Item button in footer
- Add to `FooterActionBar.tsx` next to Save / Delete / Discard. Wire to `itemFormRef.current?.handleNewItem()`.
- **Tests**: e2e.

### 2.12 Sales history shows cost
- Backend: extend `getInventoryProductDetail` `sales_history` projection to include `cost_at_sale` (already on `transaction_items`).
- File: `ItemForm.tsx:1496–1545` — add Cost column (red if > price).
- **Tests**: e2e + backend test.

### 2.13 Brand-name autocomplete
- New IPC `inventory:get-distinct-brands` → backend `SELECT brand_name, COUNT(*) AS uses FROM products WHERE brand_name IS NOT NULL AND brand_name != '' GROUP BY brand_name ORDER BY uses DESC LIMIT 200`.
- Wire `useSearchDropdown` on the Brand input in `ItemForm.tsx:961`, same pattern as the existing Size dropdown.
- **Tests**: backend repo test; e2e (type "stel", suggestion "Stella Rosa" appears; pick it; saved value matches casing).

---

## 3. Search modal + consistency

### 3.1 Token-based fuzzy match (shared, both inventory + POS search)
- **File**: `src/main/database/products.repo.ts`. Refactor `searchProducts` (~line 151) and `searchInventoryProducts` (~line 205) to use a shared helper `buildSearchPredicate(query, fields)` that:
  - Splits the trimmed query on whitespace into tokens.
  - For each token, builds `(normalize_search(name) LIKE ? OR normalize_search(brand_name) LIKE ? OR sku LIKE ?)`.
  - Joins with `AND` so all tokens must match somewhere.
- Result: "Stella Red Apple" matches "Stella Rosa Red Apple" because each token appears.
- **Tests**: products.repo.test.ts — token-AND matching, missing-token fail, SKU passthrough.

### 3.2 Advanced filters in Search modal
- Extend `SearchModal.tsx` filters dropdown:
  - Distributor select adds an explicit **"No distributor"** option (filter `distributor_number IS NULL`).
  - New checkbox **"Unpriced only"** (filter `COALESCE(retail_price, price) = 0`).
- Backend: add `distributorNumber: 'none'` and `unpricedOnly: boolean` to `SearchProductFilters`.
- **Tests**: e2e — apply each filter, results update; backend test for the SQL branches.

### 3.3 Search modal stays open after Open in Inventory
- File: `SearchModal.tsx:215`. Remove the `onClose()` call inside `handleOpenInInventory`. `InventoryModal` opens stacked on top (existing dialog z-index already supports it).
- ESC: closes the inventory modal first; second ESC closes search.
- **Tests**: e2e (open search, click Open in Inventory, search modal still visible behind).

---

## 4. Transaction — cash change due on customer display

- File: `src/renderer/src/pages/POSScreen.tsx` snapshot push (~line 192). When `paymentStatus === 'complete'` AND the latest payment includes any cash leg whose `amount > total - sum(cardLegs)`, compute `changeDue` and add to the snapshot.
- `CustomerDisplaySnapshot.changeDue` already exists; `CustomerDisplay.tsx:138` already renders it.
- **Tests**: e2e (cash $50 on $43 cart, customer screen shows "Change due: $7.00").

---

## 5. Tax codes — delete cascades to default

- File: `src/main/database/tax-codes.repo.ts` `deleteTaxCode` (~line 115). Within the existing transaction:
  1. Read the rate of the code being deleted.
  2. If no default is set → throw `"Set a default tax code before deleting"` (UI catches and shows error).
  3. Update `products SET tax_1 = <defaultRate> WHERE tax_1 = <deletedRate>`.
  4. Delete the tax code row.
  5. Enqueue product sync for affected products (or rely on next reconcile).
- **Tests**: backend repo test (delete tax code with assigned products → all products switch to default rate); e2e in manager modal.

---

## 6. Special pricing — restore duration

- **Schema**:
  - Local: `ensureColumn('special_pricing', 'expires_at', 'expires_at DATETIME')`.
  - Cloud: new migration `<ts>_add_merchant_special_pricing_expires_at.sql` adding `expires_at TIMESTAMPTZ`.
- **Type**: add `expires_at?: string | null` to `ActiveSpecialPricingRule` and the form row.
- **Pricing engine**: `src/renderer/src/utils/pricing-engine.ts:54` — skip rules where `expires_at` is set and in the past.
- **UI**: Special Pricing tab — add **"Expires on"** date input per row, optional, blank = no expiry.
- **Tests**: pricing-engine test (expired rule ignored); e2e (set rule expiring yesterday, verify cart price unchanged).

---

## 7. Mix-and-match special pricing — **plan only**

- File: `docs/features/pricing-engine.md` — extend the existing Phase 2 section with:
  - **Schema**: `mix_match_groups (id, merchant_id, name, qty, group_price)` + `mix_match_items (group_id, product_id)`.
  - **UI mockup**: new "Mix & Match" sub-tab inside the Inventory modal's Special Pricing surface — group name, threshold qty, group price, product picker (multi-select via `SearchDropdown`).
  - **Engine algorithm**: greedy distribution (already drafted in current doc lines 245–262), conflict resolution rules vs per-item special pricing.
  - **Open questions** to resolve before implementation: tax allocation per group line, receipt rendering, refund handling.
- No code in this PR.

---

## 8. No-price items — scan to add with price prompt

- File: `src/renderer/src/store/usePosScreen.ts` `addToCartBySku` (~line 261). If the matched product has `price === 0`, fire a callback (or store state) instead of `addToCart`.
- File: `src/renderer/src/pages/POSScreen.tsx` — render the existing `UnpricedItemPrompt` (`src/renderer/src/components/inventory/items/UnpricedItemPrompt.tsx`) with the matched product. On confirm, `addToCart` with the entered price; product's `tax_rate` (already set from default) applies.
- **Tests**: e2e (scan SKU "1" mapped to a $0 product, prompt appears, enter $5.00, item in cart at $5.00 with default tax).

---

## 9. Hold transactions

### 9.1 Prompt for description on hold
- **Schema**: `ensureColumn('held_transactions', 'description', 'description TEXT')`. Cloud table not synced today — local only.
- **Type**: add `description?: string | null` to `HeldTransaction` + `SaveHeldTransactionInput`.
- **UI**: before calling `holdTransaction`, open a small modal asking for an optional description (e.g. "John's order"). Save flow proceeds whether blank or filled.
- File: `src/renderer/src/pages/POSScreen.tsx` `handleHold` (find current call site).
- **Display**: `HoldLookupModal.tsx` shows the description below the hold number when present.
- **Tests**: e2e (hold with "John", lookup shows "John"; hold without text, no description shown).

### 9.2 Confirm dialogs for Clear All + Delete
- File: `src/renderer/src/components/hold/HoldLookupModal.tsx`. Wrap `onClearAll` and `onDelete` in `ConfirmDialog`.
- Existing e2e at `tests/e2e/hold-transactions.spec.ts:392-440` already exercises Clear All + Delete; extend to assert the confirm dialog appears and Cancel aborts.

---

## 10. Reports

- User left blank — **out of scope** for this PR. Surcharge follow-ups already documented in `docs/features/card-surcharge.md`. No work here.

---

## Files modified (overview)

| Layer | Files |
|-------|-------|
| Shared types | `src/shared/types/index.ts` (margin types, item-number map row, hold description, advanced filter types) |
| Schema | `src/main/database/schema.ts` (3 new `ensureColumn` + 1 new table) |
| Repos | `src/main/database/products.repo.ts`, `tax-codes.repo.ts`, `held-transactions.repo.ts`, `product-distributor-item-numbers.repo.ts` (new) |
| Currency | `src/renderer/src/utils/currency.ts` |
| Pricing engine | `src/renderer/src/utils/pricing-engine.ts` |
| IPC | `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts` |
| Sync | `src/main/services/sync/types.ts`, `product-sync.ts` (item numbers); new migration for `expires_at` and one for `merchant_product_distributor_item_numbers` |
| Renderer | `InventoryModal.tsx`, `ItemForm.tsx`, `FooterActionBar.tsx`, `SearchModal.tsx`, `POSScreen.tsx`, `HoldLookupModal.tsx`, `CustomerDisplay.tsx` (no changes — already supports changeDue), new `LowMarginPanel.tsx` |
| Docs | `docs/features/inventory-v2.md`, `docs/features/pricing-engine.md`, this file |
| Tests | `tests/e2e/inventory.spec.ts`, `search-modal.spec.ts`, `hold-transactions.spec.ts`, `transactions.spec.ts`, new `customer-display.spec.ts`, new `product-distributor-item-numbers.repo.test.ts`, extend `products.repo.test.ts` + `tax-codes.repo.test.ts` + `pricing-engine.test.ts` + `ItemForm.test.tsx` |

## Verification

1. `npm run typecheck` — clean.
2. `npm run test` — renderer + node suites green; new tests must pass.
3. `npx playwright test --project=chromium` — all 162 existing + ~20 new specs green.
4. `npx supabase db push` — apply 2 new cloud migrations (item-number table, special-pricing expires_at).
5. Smoke run `npm run dev`:
   - Scan a known SKU in the inventory modal — item auto-opens, focus returns to search.
   - Edit a field, click another tab — confirm dialog.
   - Click Duplicate, change SKU, save — two items.
   - Set per-distributor item numbers, create a PO — autofill works.
   - Toggle Low Margin tab — items below threshold listed.
   - Search "Stella Red Apple" in POS search — finds "Stella Rosa Red Apple".
   - Pay $50 cash on $43 cart — secondary screen shows change.
   - Delete a tax code with assigned products — products fall back to default.
   - Hold a sale with description — lookup shows it.
   - Set a special-pricing rule expiring yesterday — cart price unchanged.

## Out of scope (deferred)

- Mix-and-match implementation (planned in `pricing-engine.md` only).
- Reports overhaul.
- Multi-distributor item-number bulk import.
- Net-margin formula refinement (current formula documented; revisit after merchant feedback).
