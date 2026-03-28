# Inventory Management -- Full Workflow

**Spec file:** `tests/e2e/inventory-management.spec.ts`
**Suite:** `Inventory Management - Full Workflow`

End-to-end CRUD tests for departments, tax codes, distributors, and items. Uses in-memory stores so creates, edits, and deletes can be verified in a single test run.

**Mock data:** In-memory CRUD stores (departments, tax codes, distributors, inventory items), 1 pre-seeded POS product

---

## 1. Creates department, tax code, distributor, saves item, then verifies on POS screen

Full round-trip: create supporting entities, create an item, close modal, verify on POS.

| #   | Step                                                                           | Assertion                                          |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | Log in, open inventory modal                                                   | Dialog visible                                     |
| 2   | Switch to Departments tab                                                      | --                                                 |
| 3   | Fill name "Wine", click Add                                                    | "Department created" toast; "Wine" in table        |
| 4   | Switch to Tax Codes tab                                                        | --                                                 |
| 5   | Fill code "HST", rate "13", click Add                                          | "Tax code created" toast; "HST" and "13%" in table |
| 6   | Switch to Distributors tab                                                     | --                                                 |
| 7   | Fill distributor name "Premium Wines Inc", click Add                           | "Distributor created" toast; distributor in table  |
| 8   | Switch to Items tab                                                            | --                                                 |
| 9   | Fill SKU, name "Test Merlot 750ml", dept "Wine", cost, price, stock, tax "HST" | --                                                 |
| 10  | Click Save                                                                     | "Item saved" toast                                 |
| 11  | Click Close                                                                    | Inventory modal closes                             |
| 12  | Switch POS category to "All"                                                   | "Test Merlot 750ml" visible in product grid        |
| 13  | Search by SKU                                                                  | Item found                                         |

---

## 2. Edits and deletes a department

| #   | Step                                    | Assertion                                        |
| --- | --------------------------------------- | ------------------------------------------------ |
| 1   | Open inventory, go to Departments tab   | --                                               |
| 2   | Create department "Beer"                | "Department created"; "Beer" in table            |
| 3   | Click the "Beer" row to select it       | Edit form appears                                |
| 4   | Change name to "Craft Beer", click Save | "Department saved"; "Craft Beer" in table        |
| 5   | Click Delete, confirm "Yes, Delete"     | "Department deleted"; "No departments yet" shown |

---

## 3. Saves department with description, margin, and tax rate

| #   | Step                                                                    | Assertion                                                                     |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Open inventory, create tax code "HST" (13%)                             | Tax code created                                                              |
| 2   | Switch to Departments, create "Spirits"                                 | Department created                                                            |
| 3   | Select "Spirits" row                                                    | Edit form appears                                                             |
| 4   | Set name "Premium Spirits", description, margin 40%, tax rate HST (13%) | --                                                                            |
| 5   | Click Save                                                              | "Department saved"                                                            |
| 6   | --                                                                      | Table shows: "Premium Spirits", "Whiskey, vodka, and rum", "40%", "HST (13%)" |

---

## 4. Validates required fields on CRUD panels

| #   | Step                                               | Assertion                              |
| --- | -------------------------------------------------- | -------------------------------------- |
| 1   | Open inventory, Departments tab, click Add (empty) | "Name is required"                     |
| 2   | Switch to Tax Codes tab, click Add (empty)         | "Code is required", "Rate is required" |
| 3   | Switch to Distributors tab, click Add (empty)      | "Distributor name is required"         |

---

## 5. Edits and deletes a tax code

| #   | Step                              | Assertion                              |
| --- | --------------------------------- | -------------------------------------- |
| 1   | Open inventory, Tax Codes tab     | --                                     |
| 2   | Create tax code "GST" at 5%       | "Tax code created"; "GST" in table     |
| 3   | Click the "GST" row               | Edit panel appears                     |
| 4   | Change to "PST" at 8%, click Save | "Tax code updated"; "PST" in table     |
| 5   | Click Delete, confirm             | "Tax code deleted"; "No tax codes yet" |

---

## 6. Edits and deletes a distributor

| #   | Step                                          | Assertion                                        |
| --- | --------------------------------------------- | ------------------------------------------------ |
| 1   | Open inventory, Distributors tab              | --                                               |
| 2   | Create distributor "ABC Dist"                 | "Distributor created"; "ABC Dist" in table       |
| 3   | Click the "ABC Dist" row                      | Edit panel appears                               |
| 4   | Change name to "XYZ Distributors", click Save | "Distributor saved"; "XYZ Distributors" in table |
| 5   | Click Delete, confirm                         | "Distributor deleted"; "No distributors yet"     |

---

## 7. Items tab defaults to Case & Quantity sub-tab

| #   | Step                            | Assertion                                                  |
| --- | ------------------------------- | ---------------------------------------------------------- |
| 1   | Open inventory, go to Items tab | --                                                         |
| 2   | --                              | "Case & Quantity" sub-tab is selected (aria-selected=true) |
| 3   | --                              | "Bottles Per Case" input visible                           |
| 4   | --                              | Percent mode toggle is active (aria-checked=true)          |

---

## 8. Case discount supports percent and dollar toggle

| #   | Step                           | Assertion                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------ |
| 1   | Open inventory, Items tab      | "Case Discount Percent" input visible                              |
| 2   | Click "Switch to dollar mode"  | "Case Discount Price" input appears; dollar toggle is checked      |
| 3   | Click "Switch to percent mode" | "Case Discount Percent" input reappears; percent toggle is checked |

---

## 9. Editing item with tax code does not show validation error

Regression test: re-saving a loaded item should not trigger a spurious tax code validation error.

| #   | Step                                                            | Assertion                                                  |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Open inventory, create tax code "HST" (13%), create dept "Wine" | --                                                         |
| 2   | Switch to Items, fill all fields + select HST tax code          | --                                                         |
| 3   | Click Save                                                      | "Item saved"                                               |
| 4   | Search for the item by SKU                                      | Item loads into form                                       |
| 5   | Click Save again (no changes)                                   | "Item saved" (no validation error)                         |
| 6   | --                                                              | "At least one tax code must be selected..." is NOT visible |
