# Hold Transactions

**Spec file:** `tests/e2e/hold-transactions.spec.ts`
**Suite:** `Hold Transactions`

Tests the hold, recall, and TS Lookup workflows for parking transactions mid-sale.

**Mock data:** 3 products (Wine, Beer, Spirits), in-memory hold store with auto-incrementing hold numbers

---

## 1. Hold button is disabled when cart is empty

| #   | Step   | Assertion               |
| --- | ------ | ----------------------- |
| 1   | Log in | Hold button is disabled |

---

## 2. TS Lookup button is always enabled

| #   | Step                | Assertion                   |
| --- | ------------------- | --------------------------- |
| 1   | Log in (empty cart) | TS Lookup button is enabled |

---

## 3. Hold button becomes enabled after adding an item

| #   | Step                        | Assertion              |
| --- | --------------------------- | ---------------------- |
| 1   | Log in, add product to cart | Hold button is enabled |

---

## 4. Hold saves cart and clears it; TS Lookup badge shows 1

| #   | Step                | Assertion                             |
| --- | ------------------- | ------------------------------------- |
| 1   | Log in, add product | Item visible in ticket                |
| 2   | Click Hold          | Cart is cleared, Hold button disabled |
| 3   | --                  | TS Lookup badge shows "1"             |

---

## 5. TS Lookup modal shows "No transactions on hold" when empty

| #   | Step                    | Assertion                             |
| --- | ----------------------- | ------------------------------------- |
| 1   | Log in, click TS Lookup | Empty state visible                   |
| 2   | --                      | Text "No transactions on hold." shown |

---

## 6. Recalling a held transaction restores the cart and closes modal

| #   | Step                            | Assertion                          |
| --- | ------------------------------- | ---------------------------------- |
| 1   | Log in, add product, click Hold | Cart cleared                       |
| 2   | Click TS Lookup                 | "Hold #1" row visible              |
| 3   | Click Hold #1 row               | Modal closes                       |
| 4   | --                              | Cart restored, Hold button enabled |
| 5   | --                              | TS Lookup badge disappears         |

---

## 7. Recalling while cart is non-empty auto-holds current cart

| #   | Step                              | Assertion                                  |
| --- | --------------------------------- | ------------------------------------------ |
| 1   | Log in, add product A, click Hold | Hold #1 created                            |
| 2   | Add product B to cart             | B is in ticket, badge shows "1"            |
| 3   | Click TS Lookup, recall Hold #1   | A restored to cart                         |
| 4   | --                                | B is auto-held as Hold #2, badge shows "1" |

---

## 8. Multiple holds are listed in order with correct hold numbers

| #   | Step                        | Assertion                                 |
| --- | --------------------------- | ----------------------------------------- |
| 1   | Log in, add product A, Hold | Hold #1                                   |
| 2   | Add product B, Hold         | Hold #2                                   |
| 3   | Click TS Lookup             | Both "Hold #1" and "Hold #2" rows visible |

---

## 9. TS Lookup modal closes on Escape

| #   | Step                    | Assertion     |
| --- | ----------------------- | ------------- |
| 1   | Log in, click TS Lookup | Modal visible |
| 2   | Press Escape            | Modal closes  |

---

## 10. Recalled cart shows the original item name in the ticket

| #   | Step                                    | Assertion                      |
| --- | --------------------------------------- | ------------------------------ |
| 1   | Log in, add specific product, note name | --                             |
| 2   | Hold, then recall via TS Lookup         | Product name appears in ticket |

---

## 11. Hold preserves item quantity and total is restored after recall

| #   | Step                              | Assertion                        |
| --- | --------------------------------- | -------------------------------- |
| 1   | Log in, set qty to 3, add product | Note grand total                 |
| 2   | Click Hold                        | Grand total shows $0.00          |
| 3   | Recall via TS Lookup              | Grand total matches the original |

---

## 12. Selective recall: hold A, hold B, recall B, A remains on hold

| #   | Step                            | Assertion                |
| --- | ------------------------------- | ------------------------ |
| 1   | Log in, add product A, Hold     | Hold #1                  |
| 2   | Add product B, Hold             | Hold #2; badge shows "2" |
| 3   | Click TS Lookup, recall Hold #2 | Badge shows "1"          |
| 4   | Click TS Lookup again           | Hold #1 still listed     |

---

## 13. Delete button removes a single held transaction

| #   | Step                        | Assertion                           |
| --- | --------------------------- | ----------------------------------- |
| 1   | Log in, hold 2 transactions | Badge shows "2"                     |
| 2   | Click TS Lookup             | Hold #1 and #2 visible              |
| 3   | Click delete on Hold #1     | Hold #1 gone, Hold #2 still visible |

---

## 14. Clear All button removes all held transactions

| #   | Step                             | Assertion                               |
| --- | -------------------------------- | --------------------------------------- |
| 1   | Log in, hold 2 transactions      | Badge shows "2"                         |
| 2   | Click TS Lookup, click Clear All | Empty state shown                       |
| 3   | --                               | "No transactions on hold." text visible |

---

## 15. Clear All button is not visible when no holds exist

| #   | Step                    | Assertion                       |
| --- | ----------------------- | ------------------------------- |
| 1   | Log in, click TS Lookup | Empty state visible             |
| 2   | --                      | Clear All button is not visible |

---

## 16. Badge disappears after Clear All

| #   | Step                             | Assertion            |
| --- | -------------------------------- | -------------------- |
| 1   | Log in, hold 1 transaction       | Badge shows "1"      |
| 2   | Click TS Lookup, click Clear All | --                   |
| 3   | Press Escape to close modal      | Badge is not visible |
