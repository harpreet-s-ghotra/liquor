# Manager Modal

**Spec file:** `tests/e2e/manager-modal.spec.ts`
**Suite:** `Manager Modal (F6)`

Tests manager modal open/close behavior, manager-tab navigation, cashier/register admin views, merchant info, and data history.

**Mock data:** 2 cashiers, 2 registers, merchant info, local/backfill history stats, and standard POS products

---

## 1. Opens manager modal with F6 key

| #   | Step                 | Assertion                    |
| --- | -------------------- | ---------------------------- |
| 1   | Log in with PIN 1234 | POS screen loads             |
| 2   | Press F6             | Manager dialog is visible    |
| 3   | --                   | Header label shows "Manager" |

---

## 2. Displays cashiers tab by default

| #   | Step            | Assertion                  |
| --- | --------------- | -------------------------- |
| 1   | Open manager F6 | Cashiers tab is selected   |
| 2   | --              | Alice Admin row is visible |
| 3   | --              | Bob Cashier row is visible |

---

## 3. Navigates through all manager tabs

| #   | Step                             | Assertion                    |
| --- | -------------------------------- | ---------------------------- |
| 1   | Open manager F6, click Registers | Front Counter is visible     |
| 2   | Click Merchant Info              | Test Liquor Store is visible |
| 3   | Click Data History               | Data History tab is selected |

---

## 4. Creates a new cashier in manager modal

| #   | Step                                       | Assertion                     |
| --- | ------------------------------------------ | ----------------------------- |
| 1   | Open manager F6                            | Cashiers tab is visible       |
| 2   | Click add/new cashier button if it appears | Tab remains stable and usable |

---

## 5. Renames a register in manager modal

| #   | Step                                                           | Assertion                     |
| --- | -------------------------------------------------------------- | ----------------------------- |
| 1   | Open manager F6 and click Registers                            | Registers tab is visible      |
| 2   | Click first rename/edit button if available                    | Rename flow is accessible     |
| 3   | Update Front Counter to Main Counter if input appears and save | Registers tab remains visible |

---

## 6. Displays data history stats

| #   | Step                                | Assertion                         |
| --- | ----------------------------------- | --------------------------------- |
| 1   | Open manager F6, click Data History | Local transactions card shows 120 |
| 2   | --                                  | Last pull complete is visible     |

---

## 7. Displays merchant info with payment processor status

| #   | Step                                 | Assertion                                  |
| --- | ------------------------------------ | ------------------------------------------ |
| 1   | Open manager F6, click Merchant Info | Test Liquor Store is visible               |
| 2   | --                                   | Merchant ID MU-test-merchant-id is visible |
| 3   | --                                   | Enabled status badge is visible            |

---

## 8. Closes manager modal with close button

| #   | Step            | Assertion                     |
| --- | --------------- | ----------------------------- |
| 1   | Open manager F6 | Manager dialog is visible     |
| 2   | Click Close     | Manager dialog is not visible |

---

## 9. Closes manager modal with Escape key

| #   | Step            | Assertion                     |
| --- | --------------- | ----------------------------- |
| 1   | Open manager F6 | Manager dialog is visible     |
| 2   | Press Escape    | Manager dialog is not visible |

---

## 10. Returns to POS after closing manager modal

| #   | Step                                   | Assertion                    |
| --- | -------------------------------------- | ---------------------------- |
| 1   | Confirm ticket panel is visible on POS | POS shell is visible         |
| 2   | Open manager F6 and close with Escape  | Ticket panel remains visible |
