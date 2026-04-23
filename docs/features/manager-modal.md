# Manager Modal (F6)

> Admin-only Manager modal with 6 tabs: Cashiers, Registers, Merchant Info, Reorder Dashboard, Purchase Orders, Data History.

## Overview

The Manager modal is accessed via **F6** from the POS screen (admin-only). It provides CRUD management for cashiers, cloud register management, read-only Finix merchant status, a distributor-scoped reorder dashboard, full purchase order management, and a Data History tab that surfaces local transaction coverage plus a manual cloud backfill control.

## Access

- **Shortcut:** F6 (keyboard) or F6 button in bottom shortcut bar
- **Gating:** Admin-only (same as Inventory, Reports, Sales History)
- **Component:** `ManagerModal` rendered in `POSScreen`

## Tabs

### 1. Cashiers

Full CRUD for cashier management using `useCrudPanel<Cashier>`.

- **Add form:** Name + 4-digit PIN + Role (admin/cashier) + Add button
- **List table:** Name, Role (badge), Status (active/inactive badge), Created date, Delete button
- **Edit section:** On row click — edit name, change PIN, toggle role, toggle active status
- **Delete:** Confirmation dialog via `ConfirmDialog`

Uses existing IPC: `getCashiers`, `createCashier`, `updateCashier`, `deleteCashier`.

### 2. Registers

Multi-register management via Supabase `registers` table.

- **List table:** Device Name, Fingerprint (truncated), Last Seen, Created
- **Current device:** Highlighted with blue background and "Current" badge
- **Rename:** Inline rename (click Rename → edit input → Save/Cancel)
- **Delete:** Confirmation dialog (cannot delete current device)

**IPC:** `registers:list`, `registers:rename`, `registers:delete`

### 3. Merchant Info

Read-only display of Finix merchant status.

- **Cards:** Store Name, Finix Merchant ID (monospace), Processing Status (Enabled/Disabled badge), Activated Date
- **Refresh Status** button to re-fetch from Finix API
- Hint text: "To update banking details, visit the Finix dashboard."

**IPC:** `finix:merchant-status` (calls `verifyMerchant()`)

### 4. Reorder Dashboard

Projected reorder view using the rules in `docs/features/reorder-dashboard-v2.md`.

- **Distributor selector:** Alphabetical dropdown of distributors with reorderable products, plus `Unassigned` when orphaned products exist
- **Threshold selector:** Dropdown (5, 10, 20, 50, 100 units)
- **Time window selector:** Dropdown (7, 14, 30, 60, 90 days)
- **Summary cards:** Out of stock at window end, Below reorder point at window end, Total flagged
- **Accordion rows:** Collapsed rows show Product, In Stock, Days of Supply, Projected stock, and status; expanded rows show Category, Velocity/day, Reorder Point, and Price
- **Filters:** Excludes `price = 0`, inactive products, and discontinued products
- **Inventory integration:** Item form exposes a discontinued checkbox that removes the product from reorder suggestions without deleting it from inventory
- **Purchase-order handoff:** `Create Order` is disabled for the `Unassigned` bucket so orphaned items cannot flow into a PO

**IPC:** `inventory:reorder-products`, `inventory:reorder-distributors`, `inventory:set-discontinued`
**Schema:** `reorder_point INTEGER DEFAULT 0`, `is_discontinued INTEGER DEFAULT 0` on `products`

### 5. Purchase Orders

Full CRUD for purchase orders with status workflow and item receiving.

- **List view:** Filter by status (All / Draft / Submitted / Received / Cancelled), clickable table rows, delete draft/cancelled orders
- **Create view:** Distributor dropdown, notes textarea, items list with quantity inputs, running total
- **Detail view:** PO metadata cards (Created, Items, Total, Received date), items table with receive inputs for submitted orders, status transition buttons
- **Prefill from Reorder Dashboard:** `Create Order` passes the current reorder results to pre-populate a new PO, locks the distributor, and sizes the first case suggestion from projected stock rather than current stock alone
- **Backend validation:** PO creation rejects any product whose `distributor_number` does not match the PO header distributor

**Status workflow:** `draft → submitted → received` or `draft/submitted → cancelled`. Auto-marks as `received` when all items are fully received.

**PO number format:** Sequential `PO-YYYY-MM-NNNN` (e.g., PO-2026-04-0001)

**IPC:** `purchase-orders:list`, `purchase-orders:detail`, `purchase-orders:create`, `purchase-orders:update`, `purchase-orders:receive-item`, `purchase-orders:add-item`, `purchase-orders:remove-item`, `purchase-orders:delete`

### 6. Data History

Shows how far back local sales records reach and lets the operator pull more history from the cloud.

- **Stat cards:** local transaction count, earliest recorded timestamp (with relative age), most recent recorded timestamp.
- **Background pull status:** live state of the transaction backfill worker (`idle | running | done | failed`) with applied / skipped / error counters and the last-run error message.
- **Manual pull form:** integer "days to pull" input. Default 365. Kicks off `history:trigger-backfill`.
- **Safety gate:** requests beyond 365 days open a `ConfirmDialog` warning that the pull is heavy on the database. Main-process logs a `backfill` warn line when a larger pull dispatches.
- **Background behavior:** initial app startup kicks off a 365-day backfill fire-and-forget so the operator reaches the POS screen immediately even on a brand-new device. Reports render from local SQLite, so coverage expands as the backfill lands rows.

**IPC:** `history:get-stats`, `history:get-backfill-status`, `history:trigger-backfill`, `history:backfill-status-changed` (push event).

## Files

### New files

| File                                                                           | Purpose                     |
| ------------------------------------------------------------------------------ | --------------------------- |
| `src/renderer/src/components/manager/ManagerModal.tsx`                         | Modal shell + tabs          |
| `src/renderer/src/components/manager/manager-modal.css`                        | Modal BEM styles            |
| `src/renderer/src/components/manager/cashiers/CashierPanel.tsx`                | Cashier CRUD                |
| `src/renderer/src/components/manager/cashiers/cashier-panel.css`               | Cashier styles              |
| `src/renderer/src/components/manager/registers/RegisterPanel.tsx`              | Register management         |
| `src/renderer/src/components/manager/registers/register-panel.css`             | Register styles             |
| `src/renderer/src/components/manager/merchant/MerchantInfoPanel.tsx`           | Merchant info               |
| `src/renderer/src/components/manager/merchant/merchant-info-panel.css`         | Merchant styles             |
| `src/renderer/src/components/manager/history/DataHistoryPanel.tsx`             | Data History tab content    |
| `src/renderer/src/components/manager/history/data-history-panel.css`           | Data History styles         |
| `src/renderer/src/components/manager/reorder/ReorderDashboard.tsx`             | Projected reorder dashboard |
| `src/renderer/src/components/manager/reorder/reorder-dashboard.css`            | Reorder styles              |
| `src/main/services/register-management.ts`                                     | Supabase register CRUD      |
| `src/renderer/src/components/manager/purchase-orders/PurchaseOrderPanel.tsx`   | PO CRUD UI                  |
| `src/renderer/src/components/manager/purchase-orders/purchase-order-panel.css` | PO styles                   |
| `src/main/database/purchase-orders.repo.ts`                                    | PO SQLite repository        |

### Modified files

| File                                                       | Change                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `src/renderer/src/pages/POSScreen.tsx`                     | Added F6 handler + `ManagerModal` render                |
| `src/renderer/src/components/layout/BottomShortcutBar.tsx` | Added `onManagerClick` prop, F6 action                  |
| `src/main/index.ts`                                        | 6 new IPC handlers                                      |
| `src/preload/index.ts`                                     | 6 new API methods                                       |
| `src/preload/index.d.ts`                                   | Type declarations                                       |
| `src/shared/types/index.ts`                                | `Register`, `ReorderProduct`, `MerchantStatus` types    |
| `src/main/database/products.repo.ts`                       | Reorder projection queries and discontinue flag         |
| `src/main/database/index.ts`                               | Export reorder and purchase-order repo functions        |
| `src/main/database/schema.ts`                              | `reorder_point`, `is_discontinued`, PO tables + indexes |

## IPC Channels

| Channel                          | Direction       | Payload                         | Response                  |
| -------------------------------- | --------------- | ------------------------------- | ------------------------- |
| `registers:list`                 | renderer → main | —                               | `Register[]`              |
| `registers:rename`               | renderer → main | `(id, newName)`                 | `void`                    |
| `registers:delete`               | renderer → main | `(id)`                          | `void`                    |
| `inventory:reorder-products`     | renderer → main | `ReorderQuery`                  | `ReorderProduct[]`        |
| `inventory:reorder-distributors` | renderer → main | —                               | `ReorderDistributorRow[]` |
| `inventory:set-discontinued`     | renderer → main | `(id, discontinued)`            | `void`                    |
| `finix:merchant-status`          | renderer → main | —                               | `MerchantStatus`          |
| `purchase-orders:list`           | renderer → main | —                               | `PurchaseOrder[]`         |
| `purchase-orders:detail`         | renderer → main | `(poId)`                        | `PurchaseOrderDetail`     |
| `purchase-orders:create`         | renderer → main | `CreatePurchaseOrderInput`      | `PurchaseOrderDetail`     |
| `purchase-orders:update`         | renderer → main | `UpdatePurchaseOrderInput`      | `PurchaseOrder`           |
| `purchase-orders:receive-item`   | renderer → main | `ReceivePurchaseOrderItemInput` | `PurchaseOrderItem`       |
| `purchase-orders:add-item`       | renderer → main | `(poId, productId, qty)`        | `PurchaseOrderDetail`     |
| `purchase-orders:remove-item`    | renderer → main | `(poId, itemId)`                | `void`                    |
| `purchase-orders:delete`         | renderer → main | `(poId)`                        | `void`                    |

## Future Work

- Cloud sync for purchase orders across registers
- Export PO as PDF for printing/emailing to distributors
- PO reporting (spending by distributor, order frequency)
