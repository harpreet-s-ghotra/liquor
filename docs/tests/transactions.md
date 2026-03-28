# Transactions

**Spec file:** `tests/e2e/transactions.spec.ts`
**Suites:** `Simple Transactions`, `Payment Modal`

Tests cart operations (adding items, price change, discount, SKU search, quantity change) and the full payment modal workflow (cash, credit, debit, split payments, tender denominations).

**Mock data:** 15 products across 5 categories (Wine, Beer, Spirits, Coolers, Mixers), `chargeTerminal` and `chargeWithCard` mocks (300ms latency), in-memory transaction store

---

## 1. Payment buttons become enabled after adding an item

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, click first product tile | Item added to cart |
| 2 | -- | Cash, Credit, Debit, and Pay Now buttons are all enabled |

---

## 2. Delete removes currently selected item

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All" category | -- |
| 2 | Click product A, then product B | B is the active ticket line |
| 3 | Click Delete | B is removed; A is now the active line |
| 4 | -- | Only 1 ticket line remains |

---

## 3. Price change updates selected cart line price only

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All", add first product ($19.99) | Item in cart |
| 2 | Click Price Change | Edit modal opens showing "Original Price: $19.99" |
| 3 | Press 1, 2, 5, 0 on keypad, click Save | Line price updates to $12.50 |
| 4 | -- | Product grid tile still shows $19.99 (catalog unaffected) |

---

## 4. Discount supports selected item and entire transaction modes

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All", add product A and product B | 2 items in cart |
| 2 | Select line A, click Discount | Modal shows "Original Discount: 0.00%" |
| 3 | Press 1, 0 on keypad, click Save (10% item discount) | Line A shows "DISCOUNT 10.00%" and "New $17.99 (was $19.99)" |
| 4 | -- | Line A has `discounted` CSS class |
| 5 | -- | Totals box shows discount of -$2.00 |
| 6 | -- | Grand total decreased from original |
| 7 | Click Discount again, select "Entire Transaction" | Transaction discount modal opens showing "Original Discount: 0.00%" |
| 8 | Press 5, click Save (5% transaction discount) | A "5% Discount" line appears with qty 1 and amount -$1.57 |
| 9 | -- | Grand total decreased further |
| 10 | Select the discount line | Qty Change button is disabled |
| 11 | Click Delete on discount line | Discount line is removed |

---

## 5. Search by SKU finds product across all categories and adds to cart

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in (Favorites category active) | "Vodka Soda" tile is not visible |
| 2 | Type "COOLER-001" in the search input | "Vodka Soda" tile appears in product grid |
| 3 | Click the Vodka Soda tile | Ticket shows "Vodka Soda" at $4.25 |
| 4 | Clear the search input | "Vodka Soda" tile disappears (back to Favorites filter) |

---

## 6. Partial SKU search narrows product grid results

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, type "MIXER" in the search input | 3 mixer products visible (Tonic Water, Club Soda, Ginger Ale) |
| 2 | -- | Non-mixer products (e.g. Cabernet) are not visible |

---

## 7. Quantity change updates selected item quantity with keypad

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All", add first product | Ticket line shows qty 1 |
| 2 | Click Qty Change | Modal shows "Original Qty: 1" |
| 3 | Press 5, click Save | Line qty updates to 5; line price shows $99.95 |

---

## 8. Typing a SKU and pressing Enter adds the item to the cart

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, type "COOLER-001" in search input, press Enter | "Vodka Soda" added to ticket |
| 2 | -- | Search input is cleared |

---

## 9. Pressing Enter with a non-existent SKU does not add to cart

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, type "INVALID-999" in search input, press Enter | No ticket lines |
| 2 | -- | Search input is cleared |
| 3 | -- | Error modal shows 'Item "INVALID-999" not found' |
| 4 | Click OK on error modal | Error modal disappears |

---

## 10. Search input is auto-focused on page load

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in | Search input has focus |

---

## 11. Enter adds item with current quantity and resets to 1

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, set Qty input to 3 | -- |
| 2 | Type "BEER-001" in search, press Enter | "Craft IPA" added to ticket with qty 3 |
| 3 | -- | Qty input resets to 1 |

---

## 12. Saved transaction includes discounted prices when item discount is applied

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All", add Cabernet ($19.99) | -- |
| 2 | Select the line, click Discount, press 1-0, click Save (10%) | "DISCOUNT 10.00%" visible on line |
| 3 | Click Pay Now, click Cash (Exact), click OK | Transaction completes, modal closes |
| 4 | Call `getRecentTransactions` via page.evaluate | 1 saved transaction returned |
| 5 | -- | `unit_price` is approximately $17.99 |
| 6 | -- | `total_price` is approximately $17.99 |

---

## 13. Pay button opens the payment modal

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | Payment modal visible |
| 2 | -- | Modal shows "Payment" heading and "Transaction Total" |
| 3 | -- | Cash (Exact), Credit, and Debit buttons are visible |
| 4 | -- | Shows "No payments yet" |

---

## 14. Pay button does nothing when cart is empty

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in (empty cart) | Pay Now button is disabled |
| 2 | -- | Payment modal does not exist in DOM |

---

## 15. Cash (Exact) completes payment and clears transaction

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | Modal total matches grand total |
| 2 | Click Cash (Exact) | "Payment complete" shown with OK button |
| 3 | Click OK | Modal closes and cart is empty |
| 4 | -- | Search input is re-focused |

---

## 16. Credit card shows processing then completes

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | -- |
| 2 | Click Credit | Processing state visible, "Processing test card..." shown |
| 3 | -- | Cancel button is disabled during processing |
| 4 | -- (300ms mock delay) | Payment complete screen appears with OK button |
| 5 | Click OK | Modal closes; cart is empty |

---

## 17. Debit card payment works like credit

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | -- |
| 2 | Click Debit | Processing state shown, then payment complete |
| 3 | Click OK | Modal closes |

---

## 18. Tender denomination buttons accumulate and show change

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add Cabernet (total $22.59), click Pay Now | -- |
| 2 | Click $10 | "$10.00 Cash" appears in paid list; remaining amount visible |
| 3 | Click $10 again | 2 paid entries in list |
| 4 | Click $5 | Total tendered = $25; payment complete shows "Change: $2.41" |
| 5 | Click OK | Modal closes |

---

## 19. Split payment: partial cash then card completes

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add Cabernet (total $22.59), click Pay Now | -- |
| 2 | Click $10 | "$10.00 Cash" in paid list |
| 3 | -- | Remaining shows $12.59 |
| 4 | Click Credit | Processing shown, then payment complete |
| 5 | Click OK | Modal closes; cart is empty |

---

## 20. Cancel closes modal without clearing transaction

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | Modal visible |
| 2 | Click Cancel | Modal closes |
| 3 | -- | Cart still has 1 item |
| 4 | -- | Search input is focused |

---

## 21. All seven tender denomination buttons are rendered

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now | -- |
| 2 | -- | $1, $2, $5, $10, $20, $50, $100 buttons are all visible |

---

## 22. Cash/Credit/Debit buttons in action panel open payment modal

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product | -- |
| 2 | Click Cash (action panel) | Modal opens and auto-completes cash payment; click OK to close |
| 3 | Add product again, click Credit (action panel) | Modal opens; terminal processes; payment complete; click OK |
| 4 | Add product again, click Debit (action panel) | Modal opens; terminal processes; payment complete |

---

## 23. Focus returns to search bar after adding item via product grid

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, select "All", click a product tile | Item added to cart |
| 2 | -- | Search input is focused |

---

## 24. Scanning a new item while payment-complete dismisses modal and adds item

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now, click Cash (Exact) | Payment complete screen showing |
| 2 | Type "BEER-001" in search input, press Enter | Payment modal dismissed |
| 3 | -- | Previous cart cleared; "Craft IPA" is the only item in cart |

---

## 25. Print Receipt button shown alongside OK when alwaysPrint is off

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now, click Cash (Exact) | Payment complete screen visible |
| 2 | -- | Print Receipt button (`payment-print-btn`) is visible |
| 3 | -- | OK button (`payment-ok-btn`) is visible |

---

## 26. Clicking Print Receipt closes modal and clears cart

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, add product, click Pay Now, click Cash (Exact) | Payment complete screen visible; Print Receipt button visible |
| 2 | Click Print Receipt button | Payment modal is removed from the DOM |
| 3 | -- | Cart has no ticket lines |
| 4 | -- | Search input is focused |
