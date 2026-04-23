# Reorder Dashboard Component Tests

**File:** `src/renderer/src/components/manager/reorder/ReorderDashboard.test.tsx`

## Overview

Focused renderer-unit coverage for the reorder dashboard. The current tests verify distributor selection defaults, refetch behavior for every filter, summary/header rendering, row severity classes, the create-order handoff, empty-state handling, and expanded-row metric details.

## Test Setup

The suite stubs `localStorage` and mocks `window.api` with:

- `getReorderDistributors()` — Returns distributor rows, including an unassigned bucket
- `getReorderProducts()` — Returns reorder products with cost, bottles-per-case, and projection data
- `searchInventoryProducts()` — Returns an empty list for the embedded search dependency

## Test Suites

### Loading and filter refetch (5 tests)

- **loads reorder distributors and defaults to the first alphabetical choice** — Sorts distributor options and fetches products for distributor `1` with default threshold/window values.
- **refetches when distributor changes** — Calls `getReorderProducts()` again with distributor `2` after selection changes.
- **supports the unassigned bucket** — Sends `distributor: 'unassigned'` when the unassigned option is chosen.
- **refetches when unit threshold changes** — Requeries with `unit_threshold: 20`.
- **refetches when time window changes** — Requeries with `window_days: 90`.

### Rendering and row state (5 tests)

- **renders column headers and summary cards** — Confirms `Days Supply`, `Est. at 30d`, projected values, and summary-card labels render.
- **assigns row classes at each threshold boundary** — Applies `--out`, `--below-reorder`, and `--below-threshold` row classes to the expected products.
- **shows empty state instead of hanging when no reorderable distributors exist** — Displays the no-distributors message when the distributor query returns an empty array.
- **velocity is shown in expanded body, not in collapsed row** — Hides the per-day velocity until the row is expanded.
- **shows zero-velocity fallback in expanded body** — Displays the no-sales fallback message for items with zero velocity.

### Order handoff (2 tests)

- **passes all products to onCreateOrder when none are selected** — Clicking `Create Order` forwards the full product list with distributor `1` and threshold `10`.
- **disables create order for the unassigned bucket** — Prevents order creation when the selected distributor is the unassigned bucket.

## Mock Data

- **Distributors** — `Alpha Wine`, `Beta Spirits`, and an unassigned bucket
- **Products** — One out-of-stock projection, one below-reorder product, and one zero-velocity product

## Coverage

The suite currently covers 12 user-visible behaviors in the reorder dashboard, including filter-driven IPC calls, CSS row-state thresholds, and the purchase-order creation handoff used by the Manager modal.

## Related Tests

- `PurchaseOrderPanel.test.tsx` — Covers the create view that receives reorder-prefilled items
- `manager-modal.spec.ts` — Covers the distributor-scoped reorder flow in Playwright
