# Returns, Refunds & Sales History

This document covers the complete return/refund workflow, the Sales History modal, and error handling requirements for LiquorPOS.

---

## Table of Contents

1. [Overview](#overview)
2. [Return Workflow](#return-workflow)
3. [Refund Scenarios](#refund-scenarios)
4. [Inventory Impact](#inventory-impact)
5. [Sales History Modal](#sales-history-modal)
6. [Error Handling](#error-handling)
7. [Edge Cases & Business Rules](#edge-cases--business-rules)
8. [Data Model](#data-model)
9. [Known Issues & Fixes](#known-issues--fixes)

---

## Overview

Returns in LiquorPOS follow a **recall-then-return** pattern:

1. Cashier recalls an existing transaction by its transaction number
2. The original line items populate the cart (read-only)
3. Cashier selects which items to return (full or partial)
4. Cashier processes the refund via cash or card
5. Inventory is incremented and a refund transaction is recorded

Revenue impact: refunds reduce the merchant's transaction volume for Stax residual calculations. Returns should be tracked carefully for loss prevention.

---

## Return Workflow

### Step 1 — Recall a Transaction

- **Trigger:** Cashier enters a transaction number (format `TXN-...`) in the search bar and presses Enter
- **Action:** `recallTransaction(txnNumber)` fetches the full transaction from the database via `window.api.getTransactionByNumber()`
- **Result:** Cart is populated with the original line items. A recall banner appears showing transaction number, date, payment method, and total
- **Constraints:**
  - The search input must match an existing `transaction_number` exactly (case-insensitive)
  - If the transaction is not found, no action is taken (cart stays unchanged)
  - The recalled items are read-only — quantities and prices cannot be modified

### Step 2 — Select Items for Return

- **Full return:** Click "Return All" to mark every item for return
- **Partial return:** Click the checkbox next to individual items
- **Partial quantity:** Select an item, click "Qty Change", and enter the number of units to return (1 to original quantity)
- **Toggle:** Clicking a checked item deselects it from the return
- **Visual:** Selected return items are highlighted; the recall banner turns red and shows "Returning N items"

### Step 3 — Choose Refund Method

- Once items are selected, the payment buttons change to "Cash Refund", "Credit Refund", "Debit Refund"
- Clicking any refund button opens the Payment Modal in refund mode
- The modal shows the refund total as a negative amount with red styling

### Step 4 — Complete the Refund

- **Cash refund:** Completes immediately (no tender collection needed)
- **Card refund:** In production, triggers a Stax refund API call against the original `stax_transaction_id`. For now, completes immediately
- **On success:**
  - A refund transaction is saved to the database with `status = 'refund'`
  - Each returned item's `product_id` is used to INCREMENT the product's `in_stock` and `quantity` fields
  - The `original_transaction_id` links the refund back to the original sale
  - Cart is cleared, search bar is focused

### Step 5 — Dismiss Without Returning

- If the cashier recalls a transaction but does not want to return anything, they can click the dismiss/close button on the recall banner
- This clears the recalled transaction without creating any refund records

---

## Refund Scenarios

### Scenario 1: Full Return (All Items)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recall transaction TXN-123 | Cart shows all 3 original items |
| 2 | Click "Return All" | All 3 items checked, banner shows "Returning 3 items" |
| 3 | Click "Cash Refund" | Payment modal shows negative total |
| 4 | Confirm refund | Refund transaction saved, all 3 products restocked |

### Scenario 2: Partial Return (Some Items)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recall transaction TXN-123 (3 items) | Cart shows all items |
| 2 | Check item #1 and item #3 only | 2 items marked, banner shows "Returning 2 items" |
| 3 | Process refund | Only items #1 and #3 are restocked; item #2 is unaffected |

### Scenario 3: Partial Quantity Return

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recall transaction (item A: qty 5) | Cart shows item A with qty 5 |
| 2 | Check item A, then "Qty Change" to 2 | Return quantity set to 2 |
| 3 | Process refund | Only 2 units of item A are restocked |

### Scenario 4: Return a Previously Returned Transaction

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recall a refund transaction (status = 'refund') | Cart shows refund items |
| 2 | Try to check any item | Nothing happens — return checkboxes are disabled |
| 3 | — | Cannot return a refund (prevents double-refund) |

### Scenario 5: Credit Card Refund (Stax Integration)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Recall a credit card transaction | Banner shows "credit (visa ****1111)" |
| 2 | Select items, click "Credit Refund" | Stax refund API called with original `stax_transaction_id` |
| 3 | Stax confirms refund | Refund transaction saved with new `stax_transaction_id` from refund response |

### Scenario 6: Mixed Payment Return

- Currently not supported. If the original transaction was paid with credit, the refund should go back to credit
- Future enhancement: allow refund to a different method (e.g., original was credit, refund as cash)

---

## Inventory Impact

### On Sale (saveTransaction)

```
in_stock  = MAX(0, COALESCE(in_stock, quantity, 0) - sold_qty)
quantity  = MAX(0, COALESCE(quantity, in_stock, 0) - sold_qty)
```

- Both `in_stock` and `quantity` (legacy) are decremented
- `MAX(0, ...)` prevents negative inventory

### On Return (saveRefundTransaction)

```
in_stock  = COALESCE(in_stock, quantity, 0) + returned_qty
quantity  = COALESCE(quantity, in_stock, 0) + returned_qty
```

- Both fields are incremented by the returned quantity
- No upper cap — inventory can exceed pre-sale levels if items are manually added

### Inventory Verification

After a return, the product's `in_stock` count should reflect:

```
final_stock = pre_sale_stock - sold_qty + returned_qty
```

For a full return: `final_stock = pre_sale_stock` (stock is fully restored)

---

## Display Conventions for Refunds

All refund/return amounts follow standard accounting conventions across the entire UI.

### Negative Quantities

Refund line items always display quantities as negative:

- Sale: `3` (positive)
- Refund: `-3` (negative, red text)

### Parentheses for Negative Amounts

Monetary amounts on refund transactions use `()` parentheses format (standard accounting notation) instead of a minus sign:

- Sale total: `$45.99`
- Refund total: `($45.99)` (red text)

### Visual Highlighting

Refund rows and values are visually distinct across all views:

| Location | Highlighting |
|----------|-------------|
| **TicketPanel** (cart) | Red left border, "RETURN" badge, negative qty in red, amounts in `()` red |
| **ActionPanel** (totals box) | Labels change to "Refund Sub-Total" / "Refund Tax" / "Refund", all amounts red in `()` |
| **PaymentModal** | Red background on total bar, amount shown as `($XX.XX)` |
| **Sales History Modal** (rows) | Red-tinted row background, negative item count, total in `()` red, "Refund" badge |
| **Sales History Modal** (expanded detail) | Negative qty, unit price and total in `()` red, subtotal/tax/total all in `()` red |
| **Inventory Sales History tab** | Red-tinted row background, negative qty, price and total in `()` red, "REFUND" badge |

### Database Storage

Quantities and amounts are stored as **positive values** in the database. The `status = 'refund'` field determines how they are displayed. The UI layer handles all formatting (negation, parentheses, color).

---

## Sales History Modal

### Purpose

A standalone modal accessible from the POS footer bar that displays all past transactions with filtering, search, and drill-down capabilities. This is separate from the per-product Sales History tab in the Inventory modal.

### Access

- **Footer button:** New "Sales History" button (F7 shortcut) added to BottomShortcutBar
- **Keyboard shortcut:** F7

### Layout

```
+-------------------------------------------------------------------+
| SALES HISTORY                                              [Close] |
+-------------------------------------------------------------------+
| Filters:                                                          |
| [Date Range ▼] [Status ▼] [Payment ▼] [Search TXN/Product...]    |
+-------------------------------------------------------------------+
| TXN #         | Date/Time     | Items | Total   | Payment | Status|
|---------------|---------------|-------|---------|---------|-------|
| TXN-1234-AB   | Mar 21, 2:30p |   3   | $45.99  | Cash    | Sale  |
| TXN-1235-CD   | Mar 21, 2:15p |   1   | -$12.50 | Credit  | Refund|
| TXN-1236-EF   | Mar 21, 1:45p |   5   | $89.00  | Debit   | Sale  |
| ...           |               |       |         |         |       |
+-------------------------------------------------------------------+
| Showing 1-50 of 234 transactions          [< Prev] [Next >]      |
+-------------------------------------------------------------------+
```

### Filters

| Filter | Options | Default |
|--------|---------|---------|
| Date Range | Today, Last 7 Days, Last 30 Days, Custom Range | Today |
| Status | All, Sales Only, Refunds Only | All |
| Payment Method | All, Cash, Credit, Debit | All |
| Search | Free text — matches transaction number or product name | Empty |

### Transaction Detail Drill-Down

Clicking a transaction row expands it (or opens an inline detail) showing:

- Full list of line items with product name, SKU, quantity, unit price, total
- Payment details (card type, last 4 digits if card payment)
- For refund transactions: link to original transaction
- For sale transactions: link to any associated refund transactions
- **Action button:** "Recall Transaction" — loads the transaction into the POS for return processing

### Data Requirements

#### New IPC endpoint: `transactions:list`

```typescript
type TransactionListFilter = {
  date_from?: string    // ISO date string
  date_to?: string      // ISO date string
  status?: 'completed' | 'refund' | null  // null = all
  payment_method?: string | null           // null = all
  search?: string                          // matches txn number or product name
  limit?: number                           // default 50
  offset?: number                          // for pagination
}

type TransactionListResult = {
  transactions: TransactionSummary[]
  total_count: number
}

type TransactionSummary = {
  id: number
  transaction_number: string
  subtotal: number
  tax_amount: number
  total: number
  payment_method: string
  card_last_four: string | null
  card_type: string | null
  status: string
  original_transaction_id: number | null
  item_count: number        // COUNT of line items
  created_at: string
}
```

#### SQL Query Pattern

```sql
SELECT
  t.*,
  COUNT(ti.id) AS item_count
FROM transactions t
LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
WHERE 1=1
  AND (t.created_at >= @date_from OR @date_from IS NULL)
  AND (t.created_at <= @date_to OR @date_to IS NULL)
  AND (t.status = @status OR @status IS NULL)
  AND (t.payment_method = @payment_method OR @payment_method IS NULL)
  AND (
    @search IS NULL
    OR t.transaction_number LIKE '%' || @search || '%'
    OR t.id IN (
      SELECT transaction_id FROM transaction_items
      WHERE product_name LIKE '%' || @search || '%'
    )
  )
GROUP BY t.id
ORDER BY t.created_at DESC
LIMIT @limit OFFSET @offset
```

---

## Error Handling

### Current Problem

Errors from `saveRefundTransaction` and `saveTransaction` are caught by `.catch()` and logged to the console only. The user sees no feedback when a transaction fails to save.

### Required: Global Error Alert Component

A reusable error alert that can be triggered from anywhere in the app:

#### Approach: Zustand Error Store

```typescript
// store/useErrorStore.ts
type ErrorAlert = {
  id: string
  message: string
  type: 'error' | 'warning' | 'info'
  timestamp: number
}

type ErrorStore = {
  alerts: ErrorAlert[]
  showError: (message: string) => void
  showWarning: (message: string) => void
  showInfo: (message: string) => void
  dismissAlert: (id: string) => void
}
```

#### UI: Toast-Style Alert Bar

- Fixed position at the top of the POS screen (below header bar)
- Auto-dismisses after 5 seconds (errors) or 3 seconds (info/warning)
- Manual dismiss via close button
- Red background for errors, yellow for warnings, blue for info
- Stacks multiple alerts vertically
- No animations (per project rules)

#### Where to Surface Errors

| Operation | Current Behavior | Required Behavior |
|-----------|-----------------|-------------------|
| Save transaction fails | Console log only | Show error alert: "Failed to save transaction" |
| Save refund fails | Console log only | Show error alert: "Failed to process refund" |
| Recall transaction fails | Console log only | Show error alert: "Failed to recall transaction" |
| Transaction not found | Silent (returns false) | Show warning: "Transaction not found" |
| Stax API call fails | TBD | Show error alert with Stax error message |

---

## Edge Cases & Business Rules

### Preventing Abuse

1. **No double-refund:** Cannot return items from a transaction that is already a refund (`status = 'refund'`)
2. **No over-return:** Return quantity is clamped to `1..original_quantity` per line item
3. **No return of already-returned items:** Future enhancement — track which line items from an original transaction have already been returned across multiple partial refunds, preventing the same item from being returned twice
4. **Manager override:** Future enhancement — require manager PIN for refunds above a configurable threshold

### Partial Return Tracking (Future)

Currently, a customer can recall the same transaction and return items that were already returned in a previous refund. To prevent this:

- Track individual line item return status in a new `transaction_item_returns` table:
  ```sql
  CREATE TABLE transaction_item_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_transaction_item_id INTEGER NOT NULL,
    refund_transaction_id INTEGER NOT NULL,
    quantity_returned INTEGER NOT NULL,
    FOREIGN KEY (original_transaction_item_id) REFERENCES transaction_items(id),
    FOREIGN KEY (refund_transaction_id) REFERENCES transactions(id)
  );
  ```
- When recalling a transaction, compute remaining returnable quantity:
  `returnable_qty = original_qty - SUM(quantity_returned)`
- If `returnable_qty = 0` for all items, disable the return flow entirely

### Tax Calculation on Partial Returns

Current approach uses **proportional tax**:

```
return_tax = (return_subtotal / original_subtotal) * original_tax
```

This is correct for uniform tax rates. If items have different tax rates, a future enhancement should calculate tax per-item:

```
return_tax = SUM(item_return_price * item_tax_rate)
```

### Voided vs. Returned Transactions

| Term | Meaning | When to Use |
|------|---------|-------------|
| **Void** | Cancel a transaction before it is completed | During payment (before final confirmation) |
| **Return/Refund** | Reverse a completed transaction | After the sale is finalized |

Currently, LiquorPOS only supports returns (post-completion). Void functionality (canceling mid-payment) is a future enhancement.

### Cash Drawer Implications

- **Cash refund:** Drawer should open so cashier can hand back cash. The refund amount should be tracked for end-of-day cash reconciliation
- **Card refund:** No drawer action needed. The refund is processed electronically via Stax

### Receipt Generation (Future)

- Return receipts should clearly mark "REFUND" and reference the original transaction number
- Line items should show negative quantities and amounts
- Total should show the refund amount as negative

### End-of-Day Reporting (Future)

Daily reports should include:
- Total sales count and amount
- Total refund count and amount
- Net sales (sales - refunds)
- Refund-to-sales ratio (loss prevention metric)

---

## Data Model

### Transaction Status Values

| Status | Description |
|--------|-------------|
| `completed` | Normal sale transaction |
| `refund` | Return/refund transaction (linked to original via `original_transaction_id`) |

### Key Fields

| Field | Table | Purpose |
|-------|-------|---------|
| `status` | transactions | Distinguishes sales from refunds |
| `original_transaction_id` | transactions | Links refund to its original sale |
| `notes` | transactions | Auto-generated: "Refund for TXN-..." |
| `product_id` | transaction_items | Links line item to product (for inventory updates and sales history) |

### Transaction-to-Product Relationship

```
transactions (1) ──── (N) transaction_items (N) ──── (1) products
                                                          ↕
                                                    in_stock updated
```

---

## Known Issues & Fixes

### BUG: FK Constraint Failure on Refund (Critical)

**Symptom:** `FOREIGN KEY constraint failed` when saving a refund transaction. Inventory not updated, refund not recorded.

**Root Cause:** When a transaction is recalled, cart items get synthetic negative IDs (`-(index + 100)`). The `handleRefundComplete` function uses `cartItem.id` as the `product_id`, passing `-100`, `-101`, etc. to the database. Since no product has a negative ID, the foreign key constraint on `transaction_items.product_id → products.id` fails, and the entire DB transaction rolls back.

**Location:**
- `src/renderer/src/store/usePosScreen.ts:522` — assigns `id: -(index + 100)`
- `src/renderer/src/pages/POSScreen.tsx:190` — uses `product_id: cartItem.id`

**Fix:** In `handleRefundComplete`, resolve the real `product_id` from `viewingTransaction.items` instead of using the synthetic cart item ID. The mapping is: `originalIndex = -(cartItemId) - 100`, so `realProductId = viewingTransaction.items[originalIndex].product_id`.

### BUG: Silent Error on Refund Failure

**Symptom:** No UI feedback when refund save fails. Error only logged to browser console.

**Location:** `src/renderer/src/pages/POSScreen.tsx:218` — `.catch((err) => console.error(...))`

**Fix:** Replace console-only error handling with a user-visible error alert using the global error store.

### BUG: Sales History Tab Missing Refund Entries

**Symptom:** The Sales History tab in the Inventory modal does not show return transactions for a product.

**Root Cause:** Same as the FK constraint bug — since refund `transaction_items` are saved with fake `product_id` values (-100, -101), the sales history query (`WHERE ti.product_id = ?`) never matches them. Once the product_id fix is applied, refund entries will appear in sales history automatically.

---

## Implementation Checklist

- [ ] Fix product_id mapping in `handleRefundComplete` to use real product IDs from `viewingTransaction.items`
- [ ] Add global error alert store (`useErrorStore`) and UI component
- [ ] Surface transaction save errors in the UI
- [ ] Add `transactions:list` IPC endpoint with filtering
- [ ] Build Sales History modal component
- [ ] Add F7 "Sales History" button to BottomShortcutBar
- [ ] Add transaction detail drill-down with recall action
- [ ] Write unit tests for refund flow with correct product IDs
- [ ] Write E2E tests for return workflow
- [ ] Future: Partial return tracking (prevent double-refund of same items)
- [ ] Future: Manager override for high-value refunds
- [ ] Future: Per-item tax calculation on partial returns
- [ ] Future: Void transaction support (cancel mid-payment)
