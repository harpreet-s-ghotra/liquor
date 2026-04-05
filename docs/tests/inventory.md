# Inventory

**Spec file:** `tests/e2e/inventory.spec.ts`
**Suite:** `Inventory Management`

Covers opening the inventory modal, required-field validation, item save/search, and duplicate additional-SKU validation.

**Mock data:** 2 seeded inventory items (SKU-001 with additional SKU SKU-001-ALT, SKU-002), 2 POS products, item types (Wine, Spirits), backend tax rate options, in-memory save and search behavior

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
| 6   | Open the Additional SKUs tab                                   | Additional SKUs tab is active       |
| 7   | Enter an additional SKU and click "Add Additional SKU"         | --                                  |
| 8   | Open the Special Pricing tab                                   | Special Pricing tab is active       |
| 9   | Click "Add Rule" and fill quantity 2, price 1399, duration 20  | --                                  |
| 10  | Click Save                                                     | "Item saved" is visible             |
| 11  | Search for the saved SKU and click Search                      | Saved item loads back into the form |
| 12  | --                                                             | SKU field matches the saved SKU     |

---

## 4. Rejects additional SKU that duplicates another product primary SKU

| #   | Step                                                                  | Assertion                                                                                |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Log in and open inventory modal                                       | --                                                                                       |
| 2   | Fill SKU, Name, Item Type, Cost, Price, and In Stock for a new item   | --                                                                                       |
| 3   | Select the tax code option containing "13"                            | --                                                                                       |
| 4   | Open Additional SKUs, enter "SKU-001", and click "Add Additional SKU" | --                                                                                       |
| 5   | Click Save                                                            | "Additional SKU \"SKU-001\" is already the primary SKU of \"Inventory Item\"" is visible |

---

## 5. Rejects additional SKU that duplicates another product alt SKU

| #   | Step                                                                      | Assertion                                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Log in and open inventory modal                                           | --                                                                                |
| 2   | Fill SKU, Name, Item Type, Cost, Price, and In Stock for a new item       | --                                                                                |
| 3   | Select the tax code option containing "13"                                | --                                                                                |
| 4   | Open Additional SKUs, enter "SKU-001-ALT", and click "Add Additional SKU" | --                                                                                |
| 5   | Click Save                                                                | "Additional SKU \"SKU-001-ALT\" is already used by \"Inventory Item\"" is visible |
