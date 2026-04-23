# Purchase Orders Repo Tests

**File:** `src/main/database/purchase-orders.repo.test.ts`

## Overview

Comprehensive backend tests for the Purchase Orders repository functions using Vitest and SQLite in-memory databases. Tests cover CRUD operations, status transitions, distributor/product validation, receiving cost-layer creation, unit-cost overrides, and deletion rules for purchase orders.

## Test Setup

- **Test Database:** In-memory SQLite with foreign key constraints enabled
- **Schema:** Applied via `applySchema(db)` before each test
- **Test Data:** Includes a test distributor and two test products seeded before each test suite

## Test Suites

### getPurchaseOrders (3 tests)

- **returns empty array initially** — Verifies empty state on startup
- **returns created purchase orders** — Confirms orders appear in list after creation
- **returns orders sorted by created_at DESC** — Validates ordering by creation timestamp

### createPurchaseOrder (8 tests)

- **creates and returns PurchaseOrderDetail with items** — Core creation with items and totals
- **throws if distributor not found** — Validates distributor existence check
- **throws if items array is empty** — Prevents zero-item orders
- **generates sequential PO numbers** — Validates PO-YYYY-MM-NNNN format incrementing
- **throws if product not found** — Validates product existence for each item
- **throws if a product belongs to a different distributor** — Rejects cross-distributor order items
- **calculates correct line totals with null cost** — Handles null product costs (defaults to 0)
- **uses unit_cost from create input when provided** — Prefers create-form overrides over the product's stored cost

### getPurchaseOrderDetail (2 tests)

- **returns null for non-existent ID** — Verifies null handling for missing orders
- **returns PO with items for valid ID** — Confirms order and items are retrieved together

### updatePurchaseOrder (8 tests)

- **transitions draft to submitted** — Validates draft→submitted transition
- **transitions submitted to received** — Validates submitted→received with received_at timestamp
- **throws for invalid transition draft to received** — Prevents direct draft→received
- **throws when modifying a received PO** — Blocks updates on finalized orders
- **throws when modifying a cancelled PO** — Blocks updates on cancelled orders
- **updates notes on draft PO** — Allows note updates without status change
- **transitions draft to cancelled** — Validates draft→cancelled
- **transitions submitted to cancelled** — Validates submitted→cancelled

### receivePurchaseOrderItem (8 tests)

- **sets quantity_received on submitted PO item** — Updates item receipt quantity
- **increments stock and creates a receiving cost layer for newly received quantity** — Adds inventory and an open FIFO receiving layer with the item cost
- **throws for draft PO items** — Requires PO to be submitted first
- **auto-marks PO as received when all items fully received** — Completes PO when all items received
- **throws if qty > quantity_ordered** — Prevents over-receiving
- **throws if qty is negative** — Validates non-negative quantities
- **allows zero quantity received** — Permits receiving 0 items on a line
- **does not allow decreasing previously received quantity** — Prevents lowering a previously recorded receipt amount

### addPurchaseOrderItem (5 tests)

- **adds item to draft PO** — Appends new product to order
- **throws for submitted PO** — Prevents adding items to submitted orders
- **throws if product not found** — Validates product existence
- **throws if quantity <= 0** — Requires positive quantities
- **updates totals after adding item** — Recalculates subtotal/total correctly

### removePurchaseOrderItem (3 tests)

- **removes item from draft PO** — Deletes line item from order
- **throws for submitted PO** — Prevents removing items from submitted orders
- **updates totals after removing item** — Recalculates subtotal/total correctly

### deletePurchaseOrder (5 tests)

- **deletes draft PO** — Removes draft orders
- **throws for submitted PO** — Prevents deleting submitted orders
- **throws for received PO** — Prevents deleting received orders
- **deletes cancelled PO** — Allows deletion of cancelled orders
- **throws for non-existent PO** — Validates order existence

## Key Edge Cases Covered

- Null product costs (treated as 0)
- Create-time unit cost overrides
- Sequential PO number generation by month
- Products assigned to the wrong distributor
- Status transition validation (state machine)
- Receiving creates FIFO inventory cost layers
- Auto-completion when all items received
- Item quantity bounds checking (0 ≤ qty ≤ ordered)
- Received quantity cannot be reduced after recording
- Transaction atomicity (multi-item orders created together)

## Coverage

**Target:** ≥80% statement, branch, function, and line coverage

Tests cover:

- All public export functions
- Happy path operations
- Error conditions and validation
- State transitions and constraints
- Edge cases (null values, empty collections)

## Related Types

- `PurchaseOrder` — Master record
- `PurchaseOrderItem` — Line item
- `PurchaseOrderDetail` — Order with items
- `CreatePurchaseOrderInput` — Input for order creation
- `UpdatePurchaseOrderInput` — Input for order updates
- `ReceivePurchaseOrderItemInput` — Input for item receipt
