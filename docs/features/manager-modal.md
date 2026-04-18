# Manager Modal (F6)

> Admin-only Manager modal with 5 tabs: Cashiers, Registers, Merchant Info, Reorder Dashboard, Purchase Orders.

## Overview

The Manager modal is accessed via **F6** from the POS screen (admin-only). It provides CRUD management for cashiers, cloud register management, read-only Finix merchant status, a low-stock reorder dashboard, and full purchase order management.

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

Low-stock product overview (Phase 1 — read-only).

- **Threshold selector:** Dropdown (5, 10, 20, 50, 100 units)
- **Summary cards:** Out of stock count, Below reorder point count, Total low stock
- **Table:** SKU, Name, Category, In Stock, Reorder Point, Distributor
- **Row highlighting:** Red (zero stock), Orange (below reorder point), Yellow (at threshold)

**IPC:** `inventory:low-stock`
**Schema:** `reorder_point INTEGER DEFAULT 0` column added to `products` table

### 5. Purchase Orders

Full CRUD for purchase orders with status workflow and item receiving.

- **List view:** Filter by status (All / Draft / Submitted / Received / Cancelled), clickable table rows, delete draft/cancelled orders
- **Create view:** Distributor dropdown, notes textarea, items list with quantity inputs, running total
- **Detail view:** PO metadata cards (Created, Items, Total, Received date), items table with receive inputs for submitted orders, status transition buttons
- **Prefill from Reorder Dashboard:** "Create Order" button in Reorder Dashboard passes selected low-stock items to pre-populate a new PO

**Status workflow:** `draft → submitted → received` or `draft/submitted → cancelled`. Auto-marks as `received` when all items are fully received.

**PO number format:** Sequential `PO-YYYY-MM-NNNN` (e.g., PO-2026-04-0001)

**IPC:** `purchase-orders:list`, `purchase-orders:detail`, `purchase-orders:create`, `purchase-orders:update`, `purchase-orders:receive-item`, `purchase-orders:add-item`, `purchase-orders:remove-item`, `purchase-orders:delete`

## Files

### New files

| File                                                                           | Purpose                |
| ------------------------------------------------------------------------------ | ---------------------- |
| `src/renderer/src/components/manager/ManagerModal.tsx`                         | Modal shell + tabs     |
| `src/renderer/src/components/manager/manager-modal.css`                        | Modal BEM styles       |
| `src/renderer/src/components/manager/cashiers/CashierPanel.tsx`                | Cashier CRUD           |
| `src/renderer/src/components/manager/cashiers/cashier-panel.css`               | Cashier styles         |
| `src/renderer/src/components/manager/registers/RegisterPanel.tsx`              | Register management    |
| `src/renderer/src/components/manager/registers/register-panel.css`             | Register styles        |
| `src/renderer/src/components/manager/merchant/MerchantInfoPanel.tsx`           | Merchant info          |
| `src/renderer/src/components/manager/merchant/merchant-info-panel.css`         | Merchant styles        |
| `src/renderer/src/components/manager/reorder/ReorderDashboard.tsx`             | Low-stock dashboard    |
| `src/renderer/src/components/manager/reorder/reorder-dashboard.css`            | Reorder styles         |
| `src/main/services/register-management.ts`                                     | Supabase register CRUD |
| `src/renderer/src/components/manager/purchase-orders/PurchaseOrderPanel.tsx`   | PO CRUD UI             |
| `src/renderer/src/components/manager/purchase-orders/purchase-order-panel.css` | PO styles              |
| `src/main/database/purchase-orders.repo.ts`                                    | PO SQLite repository   |

### Modified files

| File                                                       | Change                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `src/renderer/src/pages/POSScreen.tsx`                     | Added F6 handler + `ManagerModal` render              |
| `src/renderer/src/components/layout/BottomShortcutBar.tsx` | Added `onManagerClick` prop, F6 action                |
| `src/main/index.ts`                                        | 6 new IPC handlers                                    |
| `src/preload/index.ts`                                     | 6 new API methods                                     |
| `src/preload/index.d.ts`                                   | Type declarations                                     |
| `src/shared/types/index.ts`                                | `Register`, `LowStockProduct`, `MerchantStatus` types |
| `src/main/database/products.repo.ts`                       | `getLowStockProducts()` function                      |
| `src/main/database/index.ts`                               | Export `getLowStockProducts`, PO repo functions       |
| `src/main/database/schema.ts`                              | `reorder_point` column, PO tables + indexes           |

## IPC Channels

| Channel                        | Direction       | Payload                         | Response              |
| ------------------------------ | --------------- | ------------------------------- | --------------------- |
| `registers:list`               | renderer → main | —                               | `Register[]`          |
| `registers:rename`             | renderer → main | `(id, newName)`                 | `void`                |
| `registers:delete`             | renderer → main | `(id)`                          | `void`                |
| `inventory:low-stock`          | renderer → main | `(threshold)`                   | `LowStockProduct[]`   |
| `finix:merchant-status`        | renderer → main | —                               | `MerchantStatus`      |
| `purchase-orders:list`         | renderer → main | —                               | `PurchaseOrder[]`     |
| `purchase-orders:detail`       | renderer → main | `(poId)`                        | `PurchaseOrderDetail` |
| `purchase-orders:create`       | renderer → main | `CreatePurchaseOrderInput`      | `PurchaseOrderDetail` |
| `purchase-orders:update`       | renderer → main | `UpdatePurchaseOrderInput`      | `PurchaseOrder`       |
| `purchase-orders:receive-item` | renderer → main | `ReceivePurchaseOrderItemInput` | `PurchaseOrderItem`   |
| `purchase-orders:add-item`     | renderer → main | `(poId, productId, qty)`        | `PurchaseOrderDetail` |
| `purchase-orders:remove-item`  | renderer → main | `(poId, itemId)`                | `void`                |
| `purchase-orders:delete`       | renderer → main | `(poId)`                        | `void`                |

## Future Work

- Cloud sync for purchase orders across registers
- Export PO as PDF for printing/emailing to distributors
- PO reporting (spending by distributor, order frequency)
