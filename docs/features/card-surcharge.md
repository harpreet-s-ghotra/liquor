# Card Surcharge

**Status:** Complete
**Owner:** Manager modal → Merchant Info tab
**Tracking:** Per-merchant config; applies to credit + debit at the POS payment modal

---

## Goal

Cash prices are the base. When a customer pays by credit or debit, an optional
configurable percent is added to cover the merchant's processing fees. Cash
remains at the base price, never surcharged.

## Configuration

The setting lives on the Manager modal → **Merchant Info** tab in a "Card Surcharge"
section:

- **Apply surcharge on credit/debit** (checkbox)
- **Percent** (decimal, 0–10%)
- **Save** button — surfaces success or validation errors inline

The setting is persisted in `merchant_config.settings_extras_json` under the key
`card_surcharge`:

```json
{ "card_surcharge": { "enabled": true, "percent": 3.5 } }
```

It rides the existing `merchant_business_settings` cloud-sync path
(`enqueueSettingsSync`), so all registers under the same merchant pick up the
new value on their next reconcile.

The repo helpers `getCardSurcharge()` / `setCardSurcharge()` enforce a 0–10%
range and reject negative values. They preserve any other keys present in
`settings_extras_json` so the surcharge update never clobbers unrelated future
settings.

## POS behavior

`POSScreen` loads the surcharge on mount (and re-loads when the manager modal
closes) and forwards it to `PaymentModal` as `cardSurcharge={{ enabled, percent }}`.

Inside `PaymentModal`:

- Before any method is chosen, the total bar shows the base transaction total
  with a small inline hint _"Credit/debit add 3% surcharge."_.
- The moment the cashier clicks **Credit** or **Debit**, the total bar swaps to
  the surcharged amount with a subline _"Includes 3% card fee · $3.00"_ and
  shifts to the accent-blue card style. The Finix charge dispatched to the
  terminal uses the surcharged amount.
- **Cash** (Cash Exact button + tender denominations) charges the **base** total
  with no surcharge.
- **Credit / Debit** charges `remaining * (1 + percent/100)`, rounded to two
  decimals. The payment row label shows the inclusive fee:
  `$103.00 Credit (incl. $3.00 fee) (visa ****4242)`. Each card payment entry
  also stores a `surcharge_amount` field so completion math can subtract the
  fee back out (a card payment of $103.00 covers $100.00 of base + $3.00 of fee).
- For split payments, only the card legs are surcharged; the cash legs stay at
  base. The "fully paid" check is computed against **base coverage** with a
  half-cent tolerance, so a partial cash + partial card split settles correctly
  and the surcharge is never mistaken for a cash overpayment / change-due.
- Refunds (`isRefund`) **never** apply surcharge — refund amounts are a passthrough
  of the original charge.

## Customer-facing display

When the cashier window is mounted, the main process opens a second
`BrowserWindow` pointed at the same renderer bundle with `?display=customer`
in the URL. `src/renderer/src/main.tsx` branches on that param and mounts
`<CustomerDisplay />` instead of the cashier `<App />`.

`POSScreen` pushes a `CustomerDisplaySnapshot` to that window via
`window.api.pushCustomerSnapshot(...)` whenever the cart, totals, payment
method, or payment status changes. The snapshot includes:

- `cart`: line items (name, quantity, unit price, line total)
- `subtotal` / `tax` / `total` (cart total before surcharge)
- `cardSurchargePercent` when active
- `paymentMethod`, `paymentStatus`, `cardChargeAmount`, `surchargeAmount`

`CustomerDisplay` deliberately reuses the cashier-side classes
(`ticket-panel__lines / __line / __line-num / __line-desc / __line-qty /
__line-price` and `action-panel__totals / __totals-row / __grand-total`) so
the second monitor mirrors the main POS UI exactly: a scrollable line-item
table on top (auto-scrolled to the latest item) and a sticky totals box
below. When the cashier picks Credit / Debit inside the payment modal, both
the customer display and the cashier's own ActionPanel totals box render a
"Card processing fee" row and inflate the grand total to the surcharged
amount in real time, driven by `PaymentModal`'s `onActiveMethodChange`
callback.

The window picks a non-primary monitor when one is connected (fullscreen
there); otherwise it falls back to a windowed display on the primary monitor
so single-monitor development still works.

## Storage in transactions

The local `transactions` table now has a dedicated `surcharge_amount REAL NOT
NULL DEFAULT 0` column (added by `ensureColumn`, also baked into the `CREATE
TABLE` for fresh DBs). Cash-only sales and refunds always store `0`. Card
sales store the inclusive fee component, so:

```
total = subtotal + tax_amount + surcharge_amount
```

`SaveTransactionInput`, `SavedTransaction`, `TransactionDetail`, and
`PrintReceiptInput` all carry the field. POS computes
`surcharge_amount = sum(payments.surcharge_amount ?? 0)` after the modal
completes and passes both the inflated `total` and the surcharge component
to `saveTransaction`. The receipt template renders a `Card processing fee`
line above the bold TOTAL when the field is greater than zero.

## Refunds and recalls

Recalled transactions carry the original `surcharge_amount`. The store's
`returnTotals` selector now computes a proportional `returnSurcharge`:

```
returnSurcharge = (returnSubtotal / originalItemsTotal) * vt.surcharge_amount
```

`returnTotal = returnSubtotal + returnTax + returnSurcharge` — so partial
refunds give the customer back a fair slice of the fee they paid, and full
refunds zero out the original surcharge.

`SaveRefundInput.surcharge_amount` is signed (negative on refund), and the
refund row stores the negative value. This lets reports compute net fee
revenue with one query:

```sql
SELECT COALESCE(SUM(surcharge_amount), 0) AS net_card_fees
FROM transactions
WHERE status IN ('completed', 'refund')
```

The Finix refund call uses `Math.abs(returnTotal)` (already includes the
proportional surcharge), so the customer is reimbursed the full amount they
were charged on the original card. Cash refunds simply hand back the same
inclusive amount from the drawer.

The refund receipt renders a `Card processing fee: -$X.XX` line above the
bold TOTAL when the surcharge slice is non-zero.

### Reports plan

For v1 the local schema captures the surcharge but the sales summary still
sums `total` directly (which already includes surcharge). Follow-ups (planned,
not yet implemented):

1. **Sales summary** — add a "Card surcharge" subtotal alongside subtotal +
   tax, computed as `SUM(surcharge_amount) WHERE status='completed'`. This
   makes net product revenue (`SUM(total) - SUM(surcharge_amount)`) visible.
2. **Tax report** — unchanged. Surcharge is a fee, not a taxable line.
3. **Cloud sync** — done. Migration
   `20260426162504_add_merchant_transactions_surcharge_amount.sql` adds the
   column to `merchant_transactions`, `CloudTransactionPayload` /
   `TransactionSyncPayload` carry it, `uploadTransaction` writes it on upsert,
   and both the realtime apply path in `sync-worker.ts` and the
   `transaction-backfill.ts` INSERT pull it back into local SQLite. Cash and
   pre-surcharge rows store 0; refunds store the negative slice.
4. **Transaction detail (Sales History modal)** — render a "Card fee" line in
   the expanded receipt-style view so cashiers can confirm the breakdown
   matches what was charged.

These are tracked as a follow-up and are intentionally scoped out of the
initial card-surcharge ship to keep the reporting changes reviewable as a
single PR.

## Validation

- Percent must be a finite number ≥ 0.
- Percent must be ≤ 10%. The 10% cap is a safety guard; most processors fall
  in the 1.5–4% range.
- The save is rejected if no `merchant_config` row exists yet (the dashboard
  cannot be opened in that state, so this is a defensive guard).

## Tests

| Suite                                           | Coverage                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `merchant-config.repo.test.ts`                  | Default disabled value, round-trip, range validation, extras preservation |
| `MerchantInfoPanel.test.tsx` → `Card Surcharge` | Loads + renders saved values, save flow, > 10% validation                 |
| `PaymentModal.test.tsx` → `Card surcharge`      | Note shown when active, Finix charge uses bumped total, cash unchanged    |

## Out of scope (future)

- Per-method (credit vs debit) different rates — US debit surcharge laws vary
  by state. Today both use the same percent.
- Receipt line breakout for the surcharge.
- A dedicated `surcharge_amount` column on `transactions` for reporting splits.
- Customer-facing prompt before card swipe (legally required disclosure varies
  by state). Today the merchant communicates the surcharge verbally.
