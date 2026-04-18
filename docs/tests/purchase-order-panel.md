# Purchase Order Panel Component Tests

**File:** `src/renderer/src/components/manager/purchase-orders/PurchaseOrderPanel.test.tsx`

## Overview

Comprehensive tests for the `PurchaseOrderPanel` React component using React Testing Library and Vitest. Tests cover list/detail/create views, status transitions, CRUD operations, error handling, and accessibility.

## Component Props

- `prefillItems: LowStockProduct[] | null` — Optional items from ReorderDashboard
- `onPrefillConsumed: () => void` — Callback when prefill is processed

## Test Setup

All tests mock `window.api` with the following methods:

- `getPurchaseOrders()` — Returns array of orders
- `getPurchaseOrderDetail(id)` — Returns order with items
- `createPurchaseOrder(input)` — Creates and returns order detail
- `updatePurchaseOrder(input)` — Updates order, returns updated order
- `receivePurchaseOrderItem(input)` — Receives items, returns item
- `deletePurchaseOrder(id)` — Deletes order
- `removePurchaseOrderItem(poId, itemId)` — Removes item
- `getDistributors()` — Returns distributor list

## Test Suites

### List View (7 tests)

- **renders list view with orders** — Displays table with PO numbers and distributor names
- **shows empty state when no orders** — Displays "No purchase orders found" message
- **shows loading state initially** — Displays loading indicator on mount
- **filters by status** — Status select filters table rows (all/draft/submitted/received/cancelled)
- **displays status badges** — Shows status text in table
- **opens detail view on row click** — Clicking row calls `getPurchaseOrderDetail()`
- **shows "New Order" button** — Button present to create new orders

### Detail View (3 tests)

- **displays PO info and items when opened** — Shows PO number, distributor, and all items
- **back button returns to list** — Back button switches view and clears detail state
- **shows status transitions for draft order** — Displays Submit button for draft orders

### Create View (2 tests)

- **opens create view with "New Order" button** — Calls `getDistributors()` when clicked
- **submits new order with selected distributor and items** — Creates PO with valid input (tested structure only)
- **shows prefilled items from ReorderDashboard** — Loads items when `prefillItems` prop provided

### Order Actions (6 tests)

- **deletes draft order with confirmation** — Shows confirmation dialog, calls `deletePurchaseOrder()`
- **submits draft order** — Calls `updatePurchaseOrder({id, status: 'submitted'})`
- **handles API errors gracefully** — Displays error message on API failure
- **shows error when creating without selecting distributor** — Validates distributor selection
- **displays success message after creating order** — Shows success feedback
- **receives items on submitted orders** — Item receipt flow for submitted POs

### Status Badge Styling (1 test)

- **shows correct badge for each status** — All status values render (draft/submitted/received/cancelled)

### Item Reception (1 test)

- **allows receiving items on submitted orders** — Demonstrates item reception UI for submitted orders

### Prefill from ReorderDashboard (2 tests)

- **opens create view with prefilled items** — Converts low-stock items to order items
- **calls onPrefillConsumed after processing prefill** — Callback invoked to clear prefill state

### Error Handling (4 tests)

- **shows error when fetching orders fails** — Displays error message on `getPurchaseOrders()` failure
- **shows error when opening detail fails** — Displays error when detail fetch fails
- **shows error when creating order fails** — Displays error on creation failure
- **shows error when deleting order fails** — Displays error on deletion failure

### Accessibility (3 tests)

- **has proper heading structure** — Page title is present and accessible
- **buttons have accessible labels** — All buttons have meaningful labels
- **filter select has proper labeling** — Status filter select is accessible

## Mock Data

### mockDistributors

- Distributor 1: "Test Distributor"
- Distributor 2: "Another Distributor"

### mockOrders

- PO 1: draft, 2 items, $50 total
- PO 2: submitted, 1 item, $100 total
- PO 3: received, 3 items, $75 total

### mockOrderDetail

- Extends mockOrders[0] with 2 line items (SKU001 and SKU002)

## User Interactions Tested

- Click table row to view detail
- Click "New Order" button to create
- Click "Create Order" from ReorderDashboard (prefill)
- Select status filter option
- Click delete button and confirm
- Click submit to change status
- Input quantity received
- Add/remove line items in create view

## Coverage

**Target:** ≥80% coverage for new component

Tests cover:

- All three views (list/create/detail)
- All user interactions
- All API calls
- Error states
- Optional prop handling (prefillItems, onPrefillConsumed)
- Status transitions
- Empty/error states

## Limitations

- Create view item selection and quantity input not fully tested (requires more component structure details)
- Payment/tax calculation in detail view not tested
- PDF export or printing not tested
- Multi-select/bulk operations not tested

## Related Components

- `ReorderDashboard` — Feeds `prefillItems` prop
- `AppButton` — Action buttons
- `ConfirmDialog` — Delete confirmation
- `formatCurrency` — Number formatting utility
