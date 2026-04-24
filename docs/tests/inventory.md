# Inventory

**Spec file:** `tests/e2e/inventory.spec.ts`
**Suite:** `Inventory Management`

Covers opening the inventory modal, required-field validation, item save/search, tab trigger wiring, display name persistence, and footer search keyboard and placement behavior.

**Mock data:** 2 seeded inventory items (SKU-001, SKU-002), 2 POS products, item types (Wine, Spirits), inventory tax options, size options, and in-memory save plus footer search dropdown behavior

---

## 1. Opens inventory popup from F2 button

| #   | Step                            | Assertion                         |
| --- | ------------------------------- | --------------------------------- |
| 1   | Log in and click "F2 Inventory" | Inventory Management dialog opens |
| 2   | --                              | Search Inventory input is visible |

---

## 2. Validates required fields before saving

| #   | Step                             | Assertion              |
| --- | -------------------------------- | ---------------------- |
| 1   | Log in and open inventory modal  | --                     |
| 2   | Click Save with all fields empty | "SKU is required"      |
| 3   | --                               | "Name is required"     |
| 4   | --                               | "Cost is required"     |
| 5   | --                               | "Price is required"    |
| 6   | --                               | "In stock is required" |

---

## 3. Saves a new inventory item and finds it by search

| #   | Step                                                           | Assertion                           |
| --- | -------------------------------------------------------------- | ----------------------------------- |
| 1   | Log in and open inventory modal                                | --                                  |
| 2   | Fill SKU and Name for a new item                               | --                                  |
| 3   | Select Item Type "Wine"                                        | --                                  |
| 4   | Fill Per Bottle Cost 9.99, Price Charged 15.99, and In Stock 8 | --                                  |
| 5   | Select the tax code option containing "13"                     | --                                  |
| 6   | Click Save                                                     | "Item saved" is visible             |
| 7   | Search for the saved SKU and click Search                      | Saved item loads back into the form |
| 8   | --                                                             | SKU field matches the saved SKU     |

---

## 4. Renders Additional SKUs tab trigger

| #   | Step                            | Assertion                              |
| --- | ------------------------------- | -------------------------------------- |
| 1   | Log in and open inventory modal | Additional SKUs tab trigger is visible |

---

## 5. Renders Additional Info tab trigger

| #   | Step                            | Assertion                              |
| --- | ------------------------------- | -------------------------------------- |
| 1   | Log in and open inventory modal | Additional Info tab trigger is visible |

---

## 6. Additional Info tab is wired to a panel

| #   | Step                                   | Assertion                                     |
| --- | -------------------------------------- | --------------------------------------------- |
| 1   | Log in and open inventory modal        | Form is visible                               |
| 2   | Fill SKU and Name                      | Required context for tab wiring check is set  |
| 3   | Inspect Additional Info tab attributes | aria-controls points to additional-info panel |

---

## 7. Additional SKUs tab is wired to a panel

| #   | Step                                   | Assertion                                     |
| --- | -------------------------------------- | --------------------------------------------- |
| 1   | Log in and open inventory modal        | Form is visible                               |
| 2   | Inspect Additional SKUs tab attributes | aria-controls points to additional-skus panel |

---

## 8. Display name field appears in General Info and saves correctly

| #   | Step                                                               | Assertion                             |
| --- | ------------------------------------------------------------------ | ------------------------------------- |
| 1   | Log in and open inventory modal                                    | Display Name field is visible         |
| 2   | Fill SKU, Name, Display Name, Item Type, Cost, Price, and In Stock | --                                    |
| 3   | Select the tax code option containing "13"                         | --                                    |
| 4   | Click Save                                                         | "Item saved" is visible               |
| 5   | Search for the saved SKU and click Search                          | Saved item loads back into the form   |
| 6   | --                                                                 | Display Name field shows "Short Name" |

---

## 9. Supports keyboard selection from the inventory footer search dropdown

| #   | Step                                    | Assertion                      |
| --- | --------------------------------------- | ------------------------------ |
| 1   | Log in and open inventory modal         | --                             |
| 2   | Type "SKU" into Search Inventory        | Matching result is visible     |
| 3   | Press ArrowDown twice, then press Enter | SKU field shows "SKU-002"      |
| 4   | --                                      | Name field shows "Second Item" |

---

## 10. Positions footer search results above the search input

| #   | Step                             | Assertion                               |
| --- | -------------------------------- | --------------------------------------- |
| 1   | Log in and open inventory modal  | --                                      |
| 2   | Type "SKU" into Search Inventory | Search results list is visible          |
| 3   | --                               | Results list ends at or above the input |
