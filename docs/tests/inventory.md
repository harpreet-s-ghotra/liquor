# Inventory (Basics)

**Spec file:** `tests/e2e/inventory.spec.ts`
**Suite:** `Inventory Management`

Basic inventory modal tests: opening, validation, and saving an item with additional SKUs and special pricing.

**Mock data:** 1 pre-seeded item (SKU-001), in-memory inventory store with search and save support

---

## 1. Opens inventory popup from F2 button

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, click "F2 Inventory" button | Inventory Management dialog opens |
| 2 | -- | Search Inventory input is visible |

---

## 2. Validates required fields before saving

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, open inventory modal | -- |
| 2 | Click Save with all fields empty | Validation errors shown: |
| 3 | -- | "SKU is required" |
| 4 | -- | "Name is required" |
| 5 | -- | "Cost is required" |
| 6 | -- | "Price is required" |
| 7 | -- | "In stock is required" |

---

## 3. Saves a new inventory item and finds it by search

Tests the full create flow including sub-tabs (Additional SKUs, Special Pricing).

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, open inventory modal | -- |
| 2 | Fill SKU (unique), Name, Department (Dept 11), Cost ($9.99), Price ($15.99), In Stock (8) | -- |
| 3 | Select tax code containing "13" | -- |
| 4 | Navigate to "Additional SKUs" tab | -- |
| 5 | Enter an additional SKU, click "Add Additional SKU" | -- |
| 6 | Navigate to "Special Pricing" tab | -- |
| 7 | Click "Add Rule", fill qty=2, price=1399, duration=20 | -- |
| 8 | Click Save | "Item saved" toast visible |
| 9 | Search for the item by SKU | SKU field populated with the saved SKU |
