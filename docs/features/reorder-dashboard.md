# Reorder Dashboard Redesign

## Context

The current Reorder Dashboard (`src/renderer/src/components/manager/reorder/ReorderDashboard.tsx`) lists every active product with `in_stock <= threshold`. Because distributor-catalog onboarding imports products at `price=0, in_stock=0`, the list is polluted with items the merchant has never intended to sell. The tab is currently noisy and not usable for placing real orders.

## Goals

1. Exclude unused imported items by hiding products still at `price=0`.
2. Add a `discontinued` flag so a merchant can mark an item as discontinued in the inventory modal. The item stays visible there but is excluded from reorder suggestions.
3. Scope by distributor with a distributor dropdown. Default to the first distributor alphabetically and add an `Unassigned` entry for products without `distributor_number`.
4. Use time-based projection instead of a pure unit threshold. Flag items when `in_stock - (velocity_per_day * window_days) < unit_threshold`. Velocity is `units sold in the last 365 days / 365`, independent of the selected window.

## Data Model

### Schema Migration

File: `src/main/database/schema.ts`

Add this through the existing `ensureColumn` helper used for additive migrations:

```ts
ensureColumn('products', 'is_discontinued', 'is_discontinued INTEGER DEFAULT 0')
```

No other schema changes are required. `products.distributor_number`, `products.reorder_point`, `products.price`, `products.is_active`, `transactions`, and `transaction_items` already exist.

### Shared Types

File: `src/shared/types/index.ts`

Add:

```ts
export type DistributorFilter = number | 'unassigned'

export interface ReorderQuery {
  distributor: DistributorFilter
  unit_threshold: number
  window_days: number
}

export interface ReorderProduct {
  id: number
  sku: string
  name: string
  item_type: string | null
  in_stock: number
  reorder_point: number
  distributor_number: number | null
  distributor_name: string | null
  price: number
  velocity_per_day: number
  days_of_supply: number | null
  projected_stock: number
}
```

Notes:

- `days_of_supply` is `null` when `velocity_per_day = 0`.
- `projected_stock` is `in_stock - velocity * window_days` and is not clamped.
- Add `is_discontinued: boolean` to the existing `Product` type.

## Backend

### Products Repository

File: `src/main/database/products.repo.ts`

Replace:

```ts
getLowStockProducts(threshold: number)
```

with:

```ts
export function getReorderProducts(query: ReorderQuery): ReorderProduct[]
```

Implementation outline:

- Compute velocity via a CTE or subquery: `SUM(ti.quantity) / 365.0` per `product_id`.
- Join transactions with `t.status = 'completed'` and `t.created_at >= date('now', '-365 days')`.
- Use a `LEFT JOIN` so products with no sales get `velocity = 0`.
- Select products where:
  - `p.is_active = 1`
  - `COALESCE(p.is_discontinued, 0) = 0`
  - `p.price > 0`
  - `p.distributor_number = :n`, or `p.distributor_number IS NULL` when `query.distributor === 'unassigned'`
- Post-filter in SQL or JS after fetch so only rows where `in_stock - velocity * window_days < unit_threshold` remain.
- Derive `days_of_supply = velocity > 0 ? in_stock / velocity : null`.
- Derive `projected_stock = in_stock - velocity * window_days`.
- Order by `projected_stock ASC`.

Add:

```ts
export function setProductDiscontinued(id: number, discontinued: boolean): void
```

Also add the dropdown helper:

```ts
export function getDistributorsWithReorderable(): Array<{
  distributor_number: number | null
  distributor_name: string | null
  product_count: number
}>
```

This helper should reuse the same base filter rules (`is_active = 1`, `is_discontinued = 0`, `price > 0`) and return only distributors with at least one reorderable item, plus an `Unassigned` bucket when orphaned products exist.

### IPC Handlers

File: `src/main/index.ts`

- Replace `inventory:low-stock` with `inventory:reorder-products`, taking `ReorderQuery` and returning `ReorderProduct[]`.
- Add `inventory:reorder-distributors`, mapped to `getDistributorsWithReorderable()`.
- Add `inventory:set-discontinued`, mapped to `setProductDiscontinued(id, discontinued)`.
- Leave `purchase-orders:*` channels unchanged.

### Preload

Files:

- `src/preload/index.ts`
- `src/preload/index.d.ts`

Expose:

```ts
getReorderProducts(query: ReorderQuery): Promise<ReorderProduct[]>
getReorderDistributors(): Promise<ReorderDistributorRow[]>
setProductDiscontinued(id: number, discontinued: boolean): Promise<void>
```

Remove the old `getLowStockProducts` binding.

## Frontend

### ReorderDashboard.tsx

Redesign `src/renderer/src/components/manager/reorder/ReorderDashboard.tsx`.

State:

- `distributors: ReorderDistributorRow[]`
- `distributor: DistributorFilter | null` where `null` means not loaded yet
- `unitThreshold: number` with default `10` and options `5 / 10 / 20 / 50 / 100`
- `windowDays: number` with default `30` and options `7 / 14 / 30 / 60 / 90`
- `products: ReorderProduct[]`
- `loading`
- `error`

Mount sequence:

1. Call `getReorderDistributors()`.
2. Sort by `distributor_name`, with nulls last as `Unassigned`, and select the first entry by default.
3. On `[distributor, unitThreshold, windowDays]` changes, call `getReorderProducts({...})`.

Controls row above the table:

- Distributor dropdown sorted alphabetically, with `Unassigned` at the end when present. Use `InventorySelect` from `common/InventoryInput`.
- Unit threshold dropdown with the same options as today.
- Time window dropdown with `7 / 14 / 30 / 60 / 90` days.
- Keep the existing `AppButton` labeled `Create Order`, still calling `onCreateOrder(products)`.

Table columns:

- `SKU`
- `Name`
- `Category`
- `In Stock`
- `Reorder Pt`
- `Velocity/day`
- `Days of Supply`
- `Projected (@ window)`
- `Distributor`

Row color classes from `getRowClass`:

- Red when `projected_stock <= 0`
- Orange when `projected_stock < reorder_point`
- Yellow when `projected_stock < unit_threshold`

Summary cards:

- Out of stock at window end (`projected_stock <= 0`)
- Below reorder point at window end
- Total flagged

Formatting:

- Use the existing `formatCurrency` and a small `formatDays` helper.
- `formatDays` should render one decimal place and `--` when null.

### Reorder Dashboard CSS

File: `src/renderer/src/components/manager/reorder/reorder-dashboard.css`

Add the new control row and column styles. Keep CSS concentric-ordered and use tokens from `styles/tokens.css`.

### Inventory Modal Discontinue Toggle

File: `src/renderer/src/components/inventory/ItemForm.tsx`

Add a `Checkbox` from `ui/checkbox` labeled:

```text
Discontinued - exclude from reorder suggestions
```

Place it in the General Info tab alongside the other flags.

Persistence:

- Prefer folding `is_discontinued` into the existing product update path if the current repo update function already supports column-level updates.
- Otherwise use the new `setProductDiscontinued` IPC.

Also add `is_discontinued` to the form's initial state mapper.

## Tests

### Backend

File: `src/main/database/products.repo.test.ts`

Add `describe('getReorderProducts')` using the existing `createTestDb()` helper. Seed distributors, products, and transactions.

Required cases:

- Excludes `price = 0`
- Excludes `is_discontinued = 1`
- Excludes `is_active = 0`
- Filters by `distributor_number`
- `'unassigned'` returns only products with `distributor_number IS NULL`
- Velocity math: `365` units sold over `365` days gives `velocity_per_day = 1`; with `window_days = 30`, `in_stock = 40`, `threshold = 10`, projected stock is `10` and is not flagged because `10 !< 10`
- With `in_stock = 39` under the same parameters, projected stock is `9` and is flagged
- Zero sales gives `velocity = 0`, `projected = in_stock`, and the row is flagged only when `in_stock < unit_threshold`
- Ignores transactions where `status != 'completed'`
- Ignores transactions older than `365` days

Add `describe('setProductDiscontinued')`:

- Toggles the column and the result is reflected on the next `getReorderProducts` call

Add `describe('getDistributorsWithReorderable')`:

- Returns only distributors with at least one reorderable product
- Includes the `Unassigned` bucket when orphaned products exist

### Renderer

File: `src/renderer/src/components/manager/reorder/ReorderDashboard.test.tsx`

Update the existing test file to cover:

- Mocking `window.api.getReorderDistributors` and `window.api.getReorderProducts`
- Distributor dropdown rendering with first alphabetical selection as default
- Refetch on distributor, threshold, or window change with correct IPC payloads
- Table rendering for the new columns, including velocity and days of supply
- Row color class assignment at each boundary

### E2E

File: `tests/e2e/reorder-dashboard.spec.ts`

Create a new Playwright suite. Extend `attachPosApiMock` or the manager-modal mock helper with:

- `getReorderDistributors`
- `getReorderProducts`
- `setProductDiscontinued`

Use the existing `loginWithPin` helper to get past login.

Test cases:

1. Default distributor is first alphabetical. Mock `Alpha Wine`, `Beta Spirits`, and `Coastal Liquor`. Open Manager -> Reorder. Assert the dropdown defaults to `Alpha Wine` and `getReorderProducts` is called with that distributor.
2. Changing distributor refetches. Select `Beta Spirits`. Assert `getReorderProducts` is called again with Beta's distributor number and the table rerenders with Beta's products.
3. `Unassigned` bucket works. Mock a fourth entry with `distributor_number: null`. Select `Unassigned`. Assert the payload uses `distributor === 'unassigned'` and only orphan products render.
4. Unit threshold dropdown refetches. Change from `10` to `20` and assert `unit_threshold: 20`.
5. Time window dropdown refetches. Change from `30d` to `90d` and assert `window_days: 90`.
6. Projected stock column rendering. Mock a product with `in_stock = 109`, `velocity_per_day = 3.33`, `window_days = 30`, `projected_stock = 9`, and `unit_threshold = 10`. Assert the row is visible, the projected column shows `9`, velocity shows `3.33/day`, days of supply shows about `33`, and the row has the yellow modifier class.
7. Zero-velocity fallback. Mock a product with `velocity_per_day = 0`. Assert the days-of-supply cell renders `--` and the row still appears when `in_stock < unit_threshold`.
8. Price-zero items are absent from the fixture. Backend filtering is covered in unit tests; in E2E, assert the table matches the mock payload exactly and that the renderer does not apply client-side filtering.
9. Discontinue toggle end to end. Open Inventory for a product visible in reorder, toggle `Discontinued`, save, reopen Reorder Dashboard, and assert the product is no longer listed. The inventory mock should update the same in-memory fixture used by the reorder mock.
10. Create Order button preserves behavior. With products visible, click `Create Order` and assert `onCreateOrder` receives the full `ReorderProduct[]`.

After E2E changes, run the `update-test-docs` agent to refresh `docs/tests/`.

## Files To Modify

- `src/main/database/schema.ts`
- `src/main/database/products.repo.ts`
- `src/main/database/products.repo.test.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/shared/types/index.ts`
- `src/renderer/src/components/manager/reorder/ReorderDashboard.tsx`
- `src/renderer/src/components/manager/reorder/reorder-dashboard.css`
- `src/renderer/src/components/manager/reorder/ReorderDashboard.test.tsx`
- `src/renderer/src/components/inventory/ItemForm.tsx`
- `docs/features/reorder-dashboard-v2.md`
- `docs/features/manager-modal.md`
- `docs/ai/repo-map.md`
- `tests/e2e/reorder-dashboard.spec.ts`

Documentation updates required:

- Create `docs/features/reorder-dashboard-v2.md` with this plan content.
- Register it in `docs/README.md`.
- Add it to the Documentation table in `CLAUDE.md`.
- Update `docs/features/manager-modal.md` so the Reorder Dashboard section points to `reorder-dashboard-v2.md` and describes the new distributor, time-window, and discontinued filters.

## Verification

### Quality Gate

Run:

```bash
npx prettier --write .
npm run lint
npx stylelint "src/**/*.css"
npm run typecheck
npm run test:coverage
npm run test:e2e
```

`test:coverage` must keep renderer and backend coverage at or above 80%.

### Manual Checks

Run `npm run dev` and verify:

1. Open Manager modal (F6) and go to the Reorder tab. Confirm the distributor dropdown populates and defaults to the first alphabetical entry.
2. Import catalog items that arrive at `price=0` and confirm they do not appear in reorder.
3. Set a price on one and drop its `in_stock` below threshold. Confirm it appears.
4. Toggle `Discontinued` in the inventory modal for that item and confirm it disappears from reorder while remaining in inventory.
5. Record sales for a priced item through POS and confirm velocity, days of supply, and projected stock update.
6. Change the window from `7d` to `90d` and confirm the list grows as expected.
7. Select `Unassigned` in the distributor dropdown and confirm only products with `distributor_number = null` are shown.
