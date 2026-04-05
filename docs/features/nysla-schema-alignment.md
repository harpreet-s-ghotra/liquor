# NYSLA Schema Alignment

> Inventory schema and UI aligned with NYSLA Price Postings fields to support future import.

## Overview

The [NYSLA Price Postings](https://www.nyslapricepostings.com) database is the source for imported product data. This alignment ensures LiquorPOS inventory fields map cleanly to NYSLA fields so imports can be added in a later phase without schema changes.

## Field Mapping

| NYSLA Field | LiquorPOS Field    | Change                                                 |
| ----------- | ------------------ | ------------------------------------------------------ |
| TTB#        | `sku`              | None                                                   |
| Brand Name  | `distributor_name` | None (via `distributor_number`)                        |
| Type        | `item_type`        | Now persisted to DB (was UI-only)                      |
| Item        | `item_name`        | Label renamed "Description" → "Item"                   |
| Size        | `size`             | New column + dropdown                                  |
| Per Bottle  | `cost`             | Label renamed "Cost" → "Per Bottle Cost"               |
| Per Case    | `case_cost`        | New column + General Info field                        |
| Bot/Case    | `bottles_per_case` | Moved to General Info, label renamed "Bottle Per Case" |
| Discounts   | `nysla_discounts`  | New column, JSON string, read-only display             |

## New Database Columns

Added via `ensureColumn` migrations in `src/main/database/schema.ts`:

| Column            | Type | Description                                              |
| ----------------- | ---- | -------------------------------------------------------- |
| `item_type`       | TEXT | Product type (e.g. "Table Red and Rose Wine")            |
| `size`            | TEXT | Bottle size (e.g. "750ML", "1.5L")                       |
| `case_cost`       | REAL | Wholesale per-case cost from distributor                 |
| `nysla_discounts` | TEXT | JSON discount tiers, e.g. `[{"amount":8,"min_cases":3}]` |

## General Info Layout

The General Info grid was reorganized into 4 rows (4-column grid):

```
Row 1: Department | Item Type | SKU | Size
Row 2: Item (×2)             | Per Bottle Cost | Per Case
Row 3: Bottle Per Case | Price You Charge | # In Stock | Tax Profile
Row 4: Final w/ Tax | Profit Margin (×2) | Discounts (read-only)
```

`Bottles Per Case` was moved from the Case & Quantity tab to Row 3 of General Info.

## Discounts Display

The `nysla_discounts` field stores a JSON array of discount tiers. The General Info panel parses and renders each tier as:

```
$8.00 on 3 Case
$24.00 on 5 Case
```

The field is read-only in the UI — populated from NYSLA import only.

## Size Options

The Size dropdown offers these standard bottle sizes:

50ML, 187ML, 200ML, 500ML, 750ML, 1L, 1.5L, 2L, 4L

## Files Changed

| File                                                        | Change                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/database/schema.ts`                               | 4 new `ensureColumn` migrations                                                                                                        |
| `src/shared/types/index.ts`                                 | `item_type`, `size`, `case_cost`, `nysla_discounts` added to `InventoryProduct` and `SaveInventoryItemInput`; new `NyslaDiscount` type |
| `src/renderer/src/types/pos.ts`                             | Re-exports `NyslaDiscount`                                                                                                             |
| `src/main/database/products.repo.ts`                        | New fields added to all SELECT queries, INSERT, and UPDATE                                                                             |
| `src/renderer/src/components/inventory/items/ItemForm.tsx`  | Form state, layout, labels, save logic updated                                                                                         |
| `src/renderer/src/components/inventory/items/item-form.css` | Styles for discounts display                                                                                                           |
| `src/main/database/products.repo.test.ts`                   | Tests for new NYSLA fields                                                                                                             |
