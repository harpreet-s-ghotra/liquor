# Manager Modal (F6)

> Admin-only Manager modal with 4 tabs: Cashiers, Registers, Merchant Info, Data History.

## Overview

The Manager modal is accessed via **F6** from the POS screen (admin-only). It provides CRUD management for cashiers, cloud register management, read-only Finix merchant status, and a Data History tab that surfaces local transaction coverage plus a manual cloud backfill control.

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

### 4. Data History

Shows how far back local sales records reach and lets the operator pull more history from the cloud.

- **Stat cards:** local transaction count, earliest recorded timestamp (with relative age), most recent recorded timestamp.
- **Background pull status:** live state of the transaction backfill worker (`idle | running | done | failed`) with applied / skipped / error counters and the last-run error message.
- **Manual pull form:** integer "days to pull" input. Default 365. Kicks off `history:trigger-backfill`.
- **Safety gate:** requests beyond 365 days open a `ConfirmDialog` warning that the pull is heavy on the database. Main-process logs a `backfill` warn line when a larger pull dispatches.
- **Background behavior:** initial app startup kicks off a 365-day backfill fire-and-forget so the operator reaches the POS screen immediately even on a brand-new device. Reports render from local SQLite, so coverage expands as the backfill lands rows.

**IPC:** `history:get-stats`, `history:get-backfill-status`, `history:trigger-backfill`, `history:backfill-status-changed` (push event).

## Files

### New files

| File                                                                   | Purpose                  |
| ---------------------------------------------------------------------- | ------------------------ |
| `src/renderer/src/components/manager/ManagerModal.tsx`                 | Modal shell + tabs       |
| `src/renderer/src/components/manager/manager-modal.css`                | Modal BEM styles         |
| `src/renderer/src/components/manager/cashiers/CashierPanel.tsx`        | Cashier CRUD             |
| `src/renderer/src/components/manager/cashiers/cashier-panel.css`       | Cashier styles           |
| `src/renderer/src/components/manager/registers/RegisterPanel.tsx`      | Register management      |
| `src/renderer/src/components/manager/registers/register-panel.css`     | Register styles          |
| `src/renderer/src/components/manager/merchant/MerchantInfoPanel.tsx`   | Merchant info            |
| `src/renderer/src/components/manager/merchant/merchant-info-panel.css` | Merchant styles          |
| `src/renderer/src/components/manager/history/DataHistoryPanel.tsx`     | Data History tab content |
| `src/renderer/src/components/manager/history/data-history-panel.css`   | Data History styles      |
| `src/main/services/register-management.ts`                             | Supabase register CRUD   |
| `src/main/database/purchase-orders.repo.ts`                            | PO SQLite repository     |

### Modified files

| File                                                       | Change                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `src/renderer/src/pages/POSScreen.tsx`                     | Added F6 handler + `ManagerModal` render                |
| `src/renderer/src/components/layout/BottomShortcutBar.tsx` | Added `onManagerClick` prop, F6 action                  |
| `src/main/index.ts`                                        | 6 new IPC handlers                                      |
| `src/preload/index.ts`                                     | 6 new API methods                                       |
| `src/preload/index.d.ts`                                   | Type declarations                                       |
| `src/shared/types/index.ts`                                | `Register`, `MerchantStatus` types                      |
| `src/main/database/products.repo.ts`                       | Reorder projection queries and discontinue flag         |
| `src/main/database/index.ts`                               | Export reorder and purchase-order repo functions        |
| `src/main/database/schema.ts`                              | `reorder_point`, `is_discontinued`, PO tables + indexes |

## IPC Channels

| Channel                 | Direction       | Payload         | Response         |
| ----------------------- | --------------- | --------------- | ---------------- |
| `registers:list`        | renderer → main | —               | `Register[]`     |
| `registers:rename`      | renderer → main | `(id, newName)` | `void`           |
| `registers:delete`      | renderer → main | `(id)`          | `void`           |
| `finix:merchant-status` | renderer → main | —               | `MerchantStatus` |

## Future Work

- Cloud sync for purchase orders across registers
- Export PO as PDF for printing/emailing to distributors
- PO reporting (spending by distributor, order frequency)
