# Reorder Dashboard Tests — Updates

**File:** `src/renderer/src/components/manager/reorder/ReorderDashboard.test.tsx`

## Updates for onCreateOrder Prop

Added 5 new tests to verify the "Create Order" button integration with the Manager Modal.

### New Tests

#### onCreateOrder Integration (5 tests)

- **shows "Create Order" button when onCreateOrder prop is provided and products exist**
  - Verifies button renders when callback provided AND products present
  - Tests conditional rendering logic

- **does not show "Create Order" button when onCreateOrder prop is not provided**
  - Button hidden when `onCreateOrder` is undefined
  - Confirms backward compatibility (existing usage without prop)

- **does not show "Create Order" button when no products exist**
  - Button hidden even with callback when empty product list
  - Prevents creating orders from empty dashboard

- **calls onCreateOrder with products when "Create Order" button is clicked**
  - Clicking button invokes callback with full product array
  - Callback receives all current products (after threshold filter)

- **passes all low stock products to onCreateOrder**
  - Tests with filtered product subset (2 of 4)
  - Verifies callback receives correct array of products
  - Confirms callback called exactly once

## Component Integration

The "Create Order" button connects ReorderDashboard to PurchaseOrderPanel:

1. User clicks "Create Order" in ReorderDashboard
2. `onCreateOrder(lowStockProducts)` callback fires
3. Parent component (Manager Modal) receives selected products
4. Passes products to PurchaseOrderPanel via `prefillItems` prop
5. PurchaseOrderPanel opens create view with items pre-populated

## Mock Data

Uses existing `mockProducts` array (4 products with varying stock levels).

## Coverage Impact

- 5 new test cases (total 28 tests in file)
- Tests cover the complete button interaction flow
- Validates conditional rendering (with/without prop)
- Confirms callback integration

## Related Tests

- `PurchaseOrderPanel.test.tsx` — Tests receiving `prefillItems` from this callback
- See `purchase-order-panel.md` for prefill integration tests

## Backward Compatibility

The optional `onCreateOrder?: (items: LowStockProduct[]) => void` prop ensures:

- ReorderDashboard works standalone without button
- Can be used in other contexts without Manager Modal
- Existing tests pass without prop (button hidden)
