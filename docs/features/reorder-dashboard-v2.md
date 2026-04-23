# Reorder Dashboard V2

## Overview

The Reorder Dashboard now uses distributor-scoped projected stock instead of a global low-stock threshold. It excludes catalog imports that still have `price = 0`, allows merchants to mark products as discontinued, and projects stock depletion from the last 365 days of completed sales.

## Rules

- Reorder suggestions only include products where `is_active = 1`
- Reorder suggestions exclude products where `is_discontinued = 1`
- Reorder suggestions exclude products where `price <= 0`
- Reorder suggestions are filtered by a selected distributor or the `Unassigned` bucket
- A product is flagged when `projected_stock < unit_threshold`
- `projected_stock = in_stock - velocity_per_day * window_days`
- `velocity_per_day = units sold in the last 365 days / 365`

## Controls

- Distributor dropdown: defaults to the first alphabetical distributor with reorderable products
- Unit Threshold dropdown: `5`, `10`, `20`, `50`, `100`
- Time Window dropdown: `7`, `14`, `30`, `60`, `90` days
- Create Order button: forwards the current `ReorderProduct[]` set plus selected distributor into the purchase-order workflow

## Data Contract

### Query

```ts
type DistributorFilter = number | 'unassigned'

type ReorderQuery = {
  distributor: DistributorFilter
  unit_threshold: number
  window_days: number
}
```

### Rows

```ts
type ReorderProduct = {
  id: number
  sku: string
  name: string
  item_type: string | null
  in_stock: number
  reorder_point: number
  distributor_number: number | null
  distributor_name: string | null
  cost: number
  bottles_per_case: number
  price: number
  velocity_per_day: number
  days_of_supply: number | null
  projected_stock: number
}
```

## Backend

- Schema adds `products.is_discontinued INTEGER DEFAULT 0`
- `getReorderProducts(query)` computes projected stock and returns only flagged rows
- `getDistributorsWithReorderable()` returns only distributors with at least one reorderable item plus an `Unassigned` bucket when needed
- `setProductDiscontinued(id, discontinued)` toggles the discontinued flag without removing the product from inventory

## IPC

- `inventory:reorder-products`
- `inventory:reorder-distributors`
- `inventory:set-discontinued`

## UI Behavior

- The reorder tab shows summary cards for projected out-of-stock, projected below reorder point, and total flagged items
- Products render as accordion rows instead of a flat table; collapsed rows focus on reorder signals and expanded rows show category, velocity, reorder point, and price
- Row styling is driven by projected stock:
  - red when `projected_stock <= 0`
  - orange when `projected_stock < reorder_point`
  - yellow when `projected_stock < unit_threshold`
- The table includes velocity, days of supply, and projected stock columns
- `days_of_supply` renders `--` when velocity is zero
- When Create Order is clicked, the Purchase Orders tab opens with the distributor preselected
- Create Order is disabled for the `Unassigned` bucket so products without a distributor cannot be turned into a mixed PO
- Prefilled PO line costs use product `cost` and remain editable before submit
- PO create mode orders by cases; item units are derived from `quantity_cases * bottles_per_case`
- Prefilled case counts are based on the larger of `reorder_point` and the selected unit threshold, minus projected stock over the selected window
- PO create mode includes explicit headers: SKU, Product, Unit Cost, Cases, Items, Line Total

## Inventory Integration

- The inventory item form includes a `Discontinued - exclude from reorder suggestions` checkbox
- Saving an inventory item persists `is_discontinued`
- Discontinued products remain editable in inventory but disappear from reorder suggestions

## Tests

- Backend repo tests cover distributor filtering, projected stock math, zero-velocity fallback, stale transaction exclusion, and discontinued behavior
- Renderer tests cover default distributor selection, refetch behavior, row-class boundaries, and create-order forwarding
- Playwright coverage lives in `tests/e2e/reorder-dashboard.spec.ts`

## Verification

- `npm run test:node -- src/main/database/products.repo.test.ts`
- focused renderer Vitest for `ReorderDashboard.test.tsx`
- `tests/e2e/reorder-dashboard.spec.ts`
