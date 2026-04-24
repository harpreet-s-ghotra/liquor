# Inventory Resize And Pricing

**Spec file:** `tests/e2e/inventory-resize-and-pricing.spec.ts`
**Suite:** `Inventory Modal — Resizable Split`, `Inventory Modal — Special Pricing without Duration`

Tests the inventory modal resize handle behavior, persisted split height, and special-pricing rules after the duration field removal.

**Mock data:** 1 inventory product with existing special-pricing rules, inventory tax codes, item types, and in-memory save payload capture

---

## 1. Renders the resize handle as a horizontal separator

| #   | Step                                                          | Assertion                               |
| --- | ------------------------------------------------------------- | --------------------------------------- |
| 1   | Log in, open Inventory, search `SKU-PROMO`, and select result | Inventory Management dialog loads item  |
| 2   | --                                                            | Resize handle is visible                |
| 3   | --                                                            | Handle role is `separator`              |
| 4   | --                                                            | Handle aria-orientation is `horizontal` |

---

## 2. Keyboard ArrowUp shrinks, then ArrowDown grows the top section

| #   | Step                                            | Assertion                                       |
| --- | ----------------------------------------------- | ----------------------------------------------- |
| 1   | Open the loaded inventory item and focus handle | Resize handle is ready for keyboard input       |
| 2   | Press ArrowUp three times                       | Top section height shrinks to a smaller value   |
| 3   | Press ArrowDown twice                           | Top section height grows above the ArrowUp size |

---

## 3. Persists the height to localStorage and restores it after reload

| #   | Step                                                        | Assertion                                             |
| --- | ----------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Open the loaded inventory item and focus handle             | Resize handle is ready for keyboard input             |
| 2   | Press ArrowUp twice                                         | `inventory-form-top-height` is stored in localStorage |
| 3   | Reload, log back in, reopen Inventory, and load `SKU-PROMO` | SKU field restores `SKU-PROMO`                        |
| 4   | --                                                          | Stored height value matches the pre-reload value      |
| 5   | --                                                          | Top section inline style uses the stored pixel height |

---

## 4. Double-click on the handle clears the persisted override

| #   | Step                                            | Assertion                                            |
| --- | ----------------------------------------------- | ---------------------------------------------------- |
| 1   | Open the loaded inventory item and focus handle | Resize handle is ready for keyboard input            |
| 2   | Press ArrowUp twice                             | `inventory-form-top-height` exists in storage        |
| 3   | Double-click the handle                         | Stored height override is removed                    |
| 4   | --                                              | Top section still renders with a reset inline height |

---

## 5. Special pricing table has no Duration column

| #   | Step                                       | Assertion                                                      |
| --- | ------------------------------------------ | -------------------------------------------------------------- |
| 1   | Open loaded item and click Special Pricing | Special Pricing Rules table is visible                         |
| 2   | --                                         | Table headers are `Quantity`, `Price`, and blank action column |
| 3   | --                                         | `Rule 1 Duration` input is absent                              |

---

## 6. Adds a new rule and saves without a duration field

| #   | Step                                                    | Assertion                                                    |
| --- | ------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Open loaded item and click Special Pricing              | Special Pricing Rules table is visible                       |
| 2   | Click Add Rule                                          | New rule row is added                                        |
| 3   | Fill the last rule with quantity `12` and price `12000` | Rule inputs accept the new values                            |
| 4   | Click Save                                              | `Item saved` confirmation is visible                         |
| 5   | --                                                      | Saved payload rules contain only `price` and `quantity` keys |
| 6   | --                                                      | Saved payload includes `{ quantity: 12, price: 120 }`        |
