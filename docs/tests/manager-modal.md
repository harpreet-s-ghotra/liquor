# Manager Modal

**Spec file:** `tests/e2e/manager-modal.spec.ts`
**Suite:** `Manager Modal (F6)`

Tests manager modal open/close behavior, manager-tab navigation, and distributor-scoped reorder views.

**Mock data:** 2 cashiers, 2 registers, merchant info, and 2 low-stock products split across 2 distributors

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

| #   | Step                             | Assertion                               |
| --- | -------------------------------- | --------------------------------------- |
| 1   | Open manager F6, click Registers | Front Counter is visible                |
| 2   | Click Merchant Info              | Test Liquor Store is visible            |
| 3   | Click Reorder Dashboard          | Distributor select defaults to value 10 |
| 4   | --                               | Craft IPA 6-Pack is visible             |

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

## 6. Displays reorder dashboard with distributor-scoped products

| #   | Step                                     | Assertion                                     |
| --- | ---------------------------------------- | --------------------------------------------- |
| 1   | Open manager F6, click Reorder Dashboard | Distributor select defaults to value 10       |
| 2   | --                                       | Checked distributor option is North Breweries |
| 3   | --                                       | Craft IPA 6-Pack row is visible               |
| 4   | --                                       | Craft IPA first cell shows 5                  |
| 5   | Switch distributor to 20                 | Checked distributor option is Premium Imports |
| 6   | --                                       | Craft IPA 6-Pack row disappears               |
| 7   | --                                       | Premium Vodka 1L row is visible               |
| 8   | --                                       | Premium Vodka first cell shows 2              |

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
