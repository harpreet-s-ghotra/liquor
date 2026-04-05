# Inventory Management

**Spec file:** `tests/e2e/inventory-management.spec.ts`
**Suite:** `Inventory Management – Full Workflow`

End-to-end CRUD coverage for item types, tax codes, distributors, and items, plus item tab defaults and a tax-code regression check.

**Mock data:** In-memory item type, tax code, distributor, sales rep, and inventory item stores, plus 1 seeded POS product

---

## 1. Creates item type, tax code, distributor, saves item, then verifies on POS screen

| #   | Step                                                             | Assertion                                                  |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Log in and open inventory modal                                  | Inventory Management dialog is visible                     |
| 2   | Open Item Types and add item type "Wine"                         | "Item type created" is visible and Wine is listed          |
| 3   | Open Tax Codes and add tax code "HST" with rate 13               | "Tax code created" is visible and HST 13% is listed        |
| 4   | Open Distributors and add distributor "Premium Wines Inc"        | "Distributor created" is visible and distributor is listed |
| 5   | Open Items and fill SKU and Name for a new item                  | --                                                         |
| 6   | Select Item Type "Wine"                                          | --                                                         |
| 7   | Fill Per Bottle Cost 12.50, Price Charged 24.99, and In Stock 30 | --                                                         |
| 8   | Select the HST tax code option                                   | --                                                         |
| 9   | Click Save                                                       | "Item saved" is visible                                    |
| 10  | Click Close                                                      | Inventory modal closes                                     |
| 11  | Switch the POS category filter to "All"                          | New item is visible in the product grid                    |
| 12  | Search for the item SKU from the POS search bar                  | New item remains visible in the results                    |

---

## 2. Edits and deletes an item type

| #   | Step                                           | Assertion                                                   |
| --- | ---------------------------------------------- | ----------------------------------------------------------- |
| 1   | Open inventory and switch to Item Types        | --                                                          |
| 2   | Create item type "Beer"                        | "Item type created" is visible and Beer is listed           |
| 3   | Select the Beer row                            | Edit item type form appears                                 |
| 4   | Change the name to "Craft Beer" and click Save | "Item type saved" is visible and Craft Beer is listed       |
| 5   | Click Delete and confirm with "Yes, Delete"    | "Item type deleted" is visible and the empty state is shown |

---

## 3. Saves item type with description, margin, and tax rate

| #   | Step                                                                      | Assertion                                                          |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Open inventory, switch to Tax Codes, and add tax code "HST" with rate 13  | "Tax code created" is visible                                      |
| 2   | Switch to Item Types and add item type "Spirits"                          | "Item type created" is visible and Spirits is listed               |
| 3   | Select the Spirits row                                                    | Edit item type form appears                                        |
| 4   | Edit name, description, default profit margin 40, and default tax rate 13 | --                                                                 |
| 5   | Click Save                                                                | "Item type saved" is visible                                       |
| 6   | --                                                                        | Table shows Premium Spirits, Whiskey, vodka, and rum, 40%, and 13% |

---

## 4. Validates required fields on CRUD panels

| #   | Step                                                | Assertion                                             |
| --- | --------------------------------------------------- | ----------------------------------------------------- |
| 1   | Open inventory, switch to Item Types, and click Add | "Name is required" is visible                         |
| 2   | Switch to Tax Codes and click Add                   | "Code is required" and "Rate is required" are visible |
| 3   | Switch to Distributors and click Add                | "Distributor name is required" is visible             |

---

## 5. Edits and deletes a tax code

| #   | Step                                                  | Assertion                                                  |
| --- | ----------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Open inventory and switch to Tax Codes                | --                                                         |
| 2   | Create tax code "GST" with rate 5                     | "Tax code created" is visible and GST is listed            |
| 3   | Select the GST row                                    | Edit tax code form appears                                 |
| 4   | Change the code to "PST" and the rate to 8, then save | "Tax code updated" is visible and PST is listed            |
| 5   | Click Delete and confirm with "Yes, Delete"           | "Tax code deleted" is visible and the empty state is shown |

---

## 6. Edits and deletes a distributor

| #   | Step                                                 | Assertion                                                     |
| --- | ---------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Open inventory and switch to Distributors            | --                                                            |
| 2   | Create distributor "ABC Dist"                        | "Distributor created" is visible and ABC Dist is listed       |
| 3   | Select the ABC Dist row                              | Edit distributor form appears                                 |
| 4   | Change the name to "XYZ Distributors" and click Save | "Distributor saved" is visible and XYZ Distributors is listed |
| 5   | Click Delete and confirm with "Yes, Delete"          | "Distributor deleted" is visible and the empty state is shown |

---

## 7. Items tab defaults to Case & Quantity sub-tab

| #   | Step                               | Assertion                                  |
| --- | ---------------------------------- | ------------------------------------------ |
| 1   | Open inventory and switch to Items | Items tab is active                        |
| 2   | --                                 | "Case & Quantity" tab is selected          |
| 3   | --                                 | "Bottles Per Case" input is visible        |
| 4   | --                                 | "Switch to percent mode" toggle is checked |

---

## 8. Case discount supports percent and dollar toggle

| #   | Step                               | Assertion                                                            |
| --- | ---------------------------------- | -------------------------------------------------------------------- |
| 1   | Open inventory and switch to Items | "Case Discount Percent" input is visible                             |
| 2   | Click "Switch to dollar mode"      | "Case Discount Price" input is visible and dollar mode is checked    |
| 3   | Click "Switch to percent mode"     | "Case Discount Percent" input is visible and percent mode is checked |

---

## 9. Editing item with tax code does not show validation error

| #   | Step                                                                       | Assertion                                                                   |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Open inventory, add tax code "HST" with rate 13, then add item type "Wine" | Tax code and item type are created                                          |
| 2   | Switch to Items and fill SKU "TAX-TEST", Name, cost, price, and stock      | --                                                                          |
| 3   | Select Item Type "Wine" and the HST tax code                               | --                                                                          |
| 4   | Click Save                                                                 | "Item saved" is visible                                                     |
| 5   | Search for SKU "TAX-TEST" and click Search                                 | Saved item loads into the form                                              |
| 6   | Click Save again without changes                                           | "Item saved" is visible again                                               |
| 7   | --                                                                         | "At least one tax code must be selected from backend values" is not visible |
