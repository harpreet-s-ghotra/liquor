# Reorder Dashboard

**Spec file:** `tests/e2e/reorder-dashboard.spec.ts`
**Suite:** `Reorder -> Purchase Order Flow`

Tests the Inventory modal reorder-to-purchase-order handoff, including distributor preselection, prefilled costs, and case-based quantity math.

**Mock data:** 2 distributors (Alpha Wine, Beta Spirits), 2 reorder products (cost + bottles-per-case), and in-memory purchase-order create stub

---

## 1. Create order switches to Purchase Orders with distributor preselected

| #   | Step                 | Assertion                                    |
| --- | -------------------- | -------------------------------------------- |
| 1   | Log in with PIN 1234 | POS screen loads                             |
| 2   | Click "F2 Inventory" | Inventory modal opens                        |
| 3   | Click Reorder tab    | Reorder dashboard loads                      |
| 4   | Click Create Order   | Purchase Orders tab becomes selected         |
| 5   | --                   | New Purchase Order heading is visible        |
| 6   | --                   | Distributor select value is prefilled with 1 |

---

## 2. Prefilled cost comes from product and is editable

| #   | Step                                                      | Assertion                              |
| --- | --------------------------------------------------------- | -------------------------------------- |
| 1   | Open Inventory, switch to Reorder, and click Create Order | Purchase order create view is visible  |
| 2   | Locate Unit cost for Cabernet Sauvignon 750ml             | Unit cost input defaults to 11.5       |
| 3   | Fill Unit cost with 13.25                                 | Unit cost input value updates to 13.25 |

---

## 3. Purchase create view shows headers and case-based item math

| #   | Step                                                      | Assertion                             |
| --- | --------------------------------------------------------- | ------------------------------------- |
| 1   | Open Inventory, switch to Reorder, and click Create Order | Purchase order create view is visible |
| 2   | --                                                        | Item header includes Cases            |
| 3   | --                                                        | Item header includes Items            |
| 4   | Locate Cases for Cabernet Sauvignon 750ml                 | Cases input defaults to 3             |
| 5   | Fill Cases with 2                                         | First item units value updates to 24  |
