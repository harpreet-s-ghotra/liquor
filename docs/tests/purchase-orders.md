# Purchase Orders

**Spec file:** `tests/e2e/purchase-orders.spec.ts`
**Suite:** `Purchase Orders`

Tests the Inventory modal purchase-order workflows for full receiving, editing a received order back to submitted, and deriving unit cost from case cost during order creation.

**Mock data:** 1 distributor (Alpha Wine), 2 catalog products with bottles-per-case values, 2 in-memory purchase orders (submitted and received), and purchase-order CRUD/status stubs

---

## 1. Marks a submitted purchase order fully received

| #   | Step                        | Assertion                             |
| --- | --------------------------- | ------------------------------------- |
| 1   | Log in with PIN 1234        | POS screen loads                      |
| 2   | Click `F2 Inventory`        | Inventory modal opens                 |
| 3   | Click `Purchase Orders` tab | Purchase Orders panel loads           |
| 4   | Click `PO-2026-04-0001`     | Submitted purchase order detail opens |
| 5   | Click `Mark Fully Received` | Mark received confirmation opens      |
| 6   | Click `Mark Received`       | Purchase order is marked received     |
| 7   | --                          | Status badge shows `received`         |
| 8   | --                          | Item receipt progress shows `12 / 12` |

---

## 2. Editing a received purchase order can reduce received units back to submitted

| #   | Step                                                  | Assertion                                           |
| --- | ----------------------------------------------------- | --------------------------------------------------- |
| 1   | Log in, open Inventory, and switch to Purchase Orders | Purchase Orders panel loads                         |
| 2   | Click `PO-2026-04-0002`                               | Received purchase order detail opens                |
| 3   | Click `Edit`                                          | Editable purchase-order form opens                  |
| 4   | Fill `Quantity received for Merlot Reserve` with `6`  | Updated received quantity is entered                |
| 5   | Click `Save Changes`                                  | Stock reduction confirmation message appears        |
| 6   | Click the confirmation `Save Changes` button          | Received quantity change is saved                   |
| 7   | --                                                    | Status badge shows `submitted`                      |
| 8   | --                                                    | `Units received for Merlot Reserve` input shows `6` |

---

## 3. New orders derive unit cost from case cost and preserve totals

| #   | Step                                                     | Assertion                                |
| --- | -------------------------------------------------------- | ---------------------------------------- |
| 1   | Log in, open Inventory, and switch to Purchase Orders    | Purchase Orders panel loads              |
| 2   | Click `New Order`                                        | Create-order view opens                  |
| 3   | Select distributor `1`                                   | Distributor is assigned to the new order |
| 4   | Fill `Search products to add` with `Cabernet`            | Matching product option is shown         |
| 5   | Select `Cabernet Sauvignon 750ml`                        | Product is added to the order form       |
| 6   | Fill `Case cost for Cabernet Sauvignon 750ml` with `120` | Derived unit cost recalculates to `10`   |
| 7   | Click `Create Order`                                     | Draft purchase order is created          |
| 8   | --                                                       | Status badge shows `draft`               |
| 9   | --                                                       | Order total shows `Total: $120.00`       |
