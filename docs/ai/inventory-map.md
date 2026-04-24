# Inventory Map

> All files involved in the inventory feature. Read before any inventory work.

## UI Component Tree

```
InventoryModal (modal shell, 6 outer tabs)
├── Items tab
│   ├── ItemForm (product CRUD, 4 inner tabs)
│   │   ├── General Info (default)
│   │   ├── Case & Quantity
│   │   ├── Additional SKUs
│   │   ├── Special Pricing
│   │   └── Sales History
│   └── FooterActionBar (search + New/Save/Delete/Discard)
├── Item Types tab → DepartmentPanel (useCrudPanel, backed by departments repo)
├── Tax Codes tab → TaxCodePanel (useCrudPanel)
├── Distributors tab → DistributorPanel (useCrudPanel + inline sales reps)
├── Reorder tab → ReorderDashboard (projected reorder + create-order handoff)
└── Purchase Orders tab → PurchaseOrderPanel (PO CRUD, case-aware receiving, mark-received, post-submit edits)
```

## File Inventory

### Renderer Components — `src/renderer/src/components/inventory/`

| File                                     | Purpose                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `InventoryModal.tsx` + `.css`            | Modal shell, tab switching, search state                                      |
| `FooterActionBar.tsx` + `.css`           | Search input, action buttons, search dropdown                                 |
| `common/SearchDropdown.tsx` + `.css`     | Shared keyboard-navigable combobox/listbox wrapper for inventory search flows |
| `tabs.ts`                                | Tab enum/constants                                                            |
| `items/ItemForm.tsx` + `.css`            | Product form with 4 inner tabs                                                |
| `departments/DepartmentPanel.tsx`        | Item type CRUD via `useCrudPanel` (compatibility layer)                       |
| `tax-codes/TaxCodePanel.tsx`             | Tax code CRUD via `useCrudPanel`                                              |
| `distributors/DistributorPanel.tsx`      | Distributor CRUD via `useCrudPanel` + inline sales reps                       |
| `reorder/ReorderDashboard.tsx`           | Reorder projections + PO handoff                                              |
| `purchase-orders/PurchaseOrderPanel.tsx` | Purchase order CRUD, case-aware receiving, and post-submit edit flow          |

### Common components used by ItemForm

| Component              | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `common/ErrorModal`    | Save/delete errors — strips Electron IPC prefix from messages |
| `common/SuccessModal`  | Save/delete success — auto-dismisses after 5 seconds          |
| `common/ConfirmDialog` | Delete confirmation                                           |

### Backend — `src/main/database/`

| File                      | Key functions                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products.repo.ts`        | `getInventoryProducts`, `searchInventoryProducts`, `getInventoryProductDetail`, `saveInventoryItem`, `deleteInventoryItem`, `getInventoryItemTypes`, `getInventoryTaxCodes`, `getDistinctSizes` |
| `departments.repo.ts`     | `getItemTypes`, `createItemType`, `updateItemType`, `deleteItemType` plus legacy department aliases                                                                                             |
| `tax-codes.repo.ts`       | CRUD for tax codes                                                                                                                                                                              |
| `distributors.repo.ts`    | CRUD for distributors                                                                                                                                                                           |
| `sales-reps.repo.ts`      | CRUD for sales reps (per distributor)                                                                                                                                                           |
| `purchase-orders.repo.ts` | Purchase order CRUD, submitted/received corrections, mark-fully-received, and FIFO-aware receiving updates                                                                                      |

### IPC Channels

- `inventory:products:search`, `inventory:products:detail`, `inventory:products:save`, `inventory:products:delete`
- `inventory:item-types:list`, `inventory:tax-codes:list`
- `inventory:list-sizes-in-use` (plus legacy `inventory:distinct-sizes` for Search Modal filters)
- `item-types:list/create/update/delete`
- Legacy compatibility: `inventory:departments:list`, `departments:list/create/update/delete`
- `tax-codes:list/create/update/delete`
- `distributors:list/create/update/delete`
- `sales-reps:list-by-distributor/create/update/delete`
- `purchase-orders:list`, `purchase-orders:detail`, `purchase-orders:create`, `purchase-orders:update`, `purchase-orders:receive-item`, `purchase-orders:update-items`, `purchase-orders:mark-received`, `purchase-orders:add-item`, `purchase-orders:remove-item`, `purchase-orders:delete`

### Shared Types — `src/shared/types/index.ts`

| Type                                                 | Used by                                      |
| ---------------------------------------------------- | -------------------------------------------- |
| `InventoryProduct`                                   | Search results, FooterActionBar dropdown     |
| `InventoryProductDetail`                             | ItemForm (full product with relations)       |
| `SaveInventoryItemInput`                             | Save payload from ItemForm                   |
| `PurchaseOrderItem`, `UpdatePurchaseOrderItemsInput` | Purchase order detail rows and edit payloads |
| `ItemType`, `TaxCode`, `Distributor`, `SalesRep`     | CRUD panels                                  |

### Shared Utilities / Hooks

- `src/shared/utils/size.ts` — canonical size suggestions + `normalizeSize()` for renderer/main parity
- `src/renderer/src/hooks/useSearchDropdown.ts` — shared keyboard combobox state for FooterActionBar, ReorderDashboard, and PurchaseOrderPanel

### Tests

| Test file                                     | Covers                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `InventoryModal.test.tsx`                     | Tab switching, search, breadcrumbs, reorder→PO handoff                                    |
| `FooterActionBar.test.tsx`                    | Search input, action buttons, dropdown                                                    |
| `hooks/useSearchDropdown.test.tsx`            | Shared keyboard highlight/select/reset behavior                                           |
| `common/SearchDropdown.test.tsx`              | Shared combobox ARIA and mouse/keyboard selection                                         |
| `items/ItemForm.test.tsx`                     | Form fields, tab switching, save/delete                                                   |
| `departments/DepartmentPanel.test.tsx`        | Item type CRUD                                                                            |
| `tax-codes/TaxCodePanel.test.tsx`             | Tax code CRUD                                                                             |
| `distributors/DistributorPanel.test.tsx`      | Distributor CRUD + sales rep CRUD                                                         |
| `reorder/ReorderDashboard.test.tsx`           | Reorder distributor filters + PO handoff                                                  |
| `purchase-orders/PurchaseOrderPanel.test.tsx` | PO list/create/detail flows, mark-received, case-cost interlock, submitted/received edits |
| `products.repo.test.ts`                       | Backend inventory queries                                                                 |
| `schema.test.ts`                              | Size backfill migration idempotency                                                       |
| `src/shared/utils/size.test.ts`               | Shared size normalization                                                                 |
| `tests/e2e/inventory.spec.ts`                 | Item CRUD E2E                                                                             |
| `tests/e2e/inventory-management.spec.ts`      | Dept/Tax/Distributor CRUD E2E                                                             |
| `tests/e2e/reorder-dashboard.spec.ts`         | Inventory-scoped reorder → PO flow                                                        |
| `tests/e2e/purchase-orders.spec.ts`           | Purchase-order mark-received, edit corrections, and create price interlock                |

### Docs

| Doc                                                   | Content                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| `docs/features/inventory-v1.md`                       | Original spec (v1)                               |
| `docs/features/inventory-v2.md`                       | Active redesign plan                             |
| `docs/features/purchase-order-receive-and-edit.md`    | Purchase-order receive/edit workflow             |
| `docs/features/keyboard-navigable-search-dropdown.md` | Shared keyboard search dropdown                  |
| `docs/features/inventory-size-field-fix.md`           | Size field display + free-form normalization fix |

## Key Hooks

- `useCrudPanel<T>` — generic CRUD state for Item Type/Tax/Distributor panels (loading, editing, errors, success messages)
- `useDebounce<T>` — search input debouncing
- `useSearchDropdown<T>` — keyboard listbox navigation for search-driven dropdowns

## Currency Handling

Always use `currency.ts` utilities: `normalizeCurrencyForInput()` for input, `formatCurrency()` for display, `parseCurrencyDigitsToDollars()` for conversion.
