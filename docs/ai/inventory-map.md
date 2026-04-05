# Inventory Map

> All files involved in the inventory feature. Read before any inventory work.

## UI Component Tree

```
InventoryModal (modal shell, 4 outer tabs)
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
└── Distributors tab → DistributorPanel (useCrudPanel + inline sales reps)
```

## File Inventory

### Renderer Components — `src/renderer/src/components/inventory/`

| File                                | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `InventoryModal.tsx` + `.css`       | Modal shell, tab switching, search state                |
| `FooterActionBar.tsx` + `.css`      | Search input, action buttons, search dropdown           |
| `tabs.ts`                           | Tab enum/constants                                      |
| `items/ItemForm.tsx` + `.css`       | Product form with 4 inner tabs                          |
| `departments/DepartmentPanel.tsx`   | Item type CRUD via `useCrudPanel` (compatibility layer) |
| `tax-codes/TaxCodePanel.tsx`        | Tax code CRUD via `useCrudPanel`                        |
| `distributors/DistributorPanel.tsx` | Distributor CRUD via `useCrudPanel` + inline sales reps |

### Common components used by ItemForm

| Component              | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `common/ErrorModal`    | Save/delete errors — strips Electron IPC prefix from messages |
| `common/SuccessModal`  | Save/delete success — auto-dismisses after 5 seconds          |
| `common/ConfirmDialog` | Delete confirmation                                           |

### Backend — `src/main/database/`

| File                   | Key functions                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products.repo.ts`     | `getInventoryProducts`, `searchInventoryProducts`, `getInventoryProductDetail`, `saveInventoryItem`, `deleteInventoryItem`, `getInventoryItemTypes`, `getInventoryTaxCodes` |
| `departments.repo.ts`  | `getItemTypes`, `createItemType`, `updateItemType`, `deleteItemType` plus legacy department aliases                                                                         |
| `tax-codes.repo.ts`    | CRUD for tax codes                                                                                                                                                          |
| `distributors.repo.ts` | CRUD for distributors                                                                                                                                                       |
| `sales-reps.repo.ts`   | CRUD for sales reps (per distributor)                                                                                                                                       |

### IPC Channels

- `inventory:products:search`, `inventory:products:detail`, `inventory:products:save`, `inventory:products:delete`
- `inventory:item-types:list`, `inventory:tax-codes:list`
- `item-types:list/create/update/delete`
- Legacy compatibility: `inventory:departments:list`, `departments:list/create/update/delete`
- `tax-codes:list/create/update/delete`
- `distributors:list/create/update/delete`
- `sales-reps:list-by-distributor/create/update/delete`

### Shared Types — `src/shared/types/index.ts`

| Type                                             | Used by                                  |
| ------------------------------------------------ | ---------------------------------------- |
| `InventoryProduct`                               | Search results, FooterActionBar dropdown |
| `InventoryProductDetail`                         | ItemForm (full product with relations)   |
| `SaveInventoryItemInput`                         | Save payload from ItemForm               |
| `ItemType`, `TaxCode`, `Distributor`, `SalesRep` | CRUD panels                              |

### Tests

| Test file                                | Covers                                  |
| ---------------------------------------- | --------------------------------------- |
| `InventoryModal.test.tsx`                | Tab switching, search, breadcrumbs      |
| `FooterActionBar.test.tsx`               | Search input, action buttons, dropdown  |
| `items/ItemForm.test.tsx`                | Form fields, tab switching, save/delete |
| `departments/DepartmentPanel.test.tsx`   | Item type CRUD                          |
| `tax-codes/TaxCodePanel.test.tsx`        | Tax code CRUD                           |
| `distributors/DistributorPanel.test.tsx` | Distributor CRUD + sales rep CRUD       |
| `products.repo.test.ts`                  | Backend inventory queries               |
| `tests/e2e/inventory.spec.ts`            | Item CRUD E2E                           |
| `tests/e2e/inventory-management.spec.ts` | Dept/Tax/Distributor CRUD E2E           |

### Docs

| Doc                             | Content              |
| ------------------------------- | -------------------- |
| `docs/features/inventory-v1.md` | Original spec (v1)   |
| `docs/features/inventory-v2.md` | Active redesign plan |

## Key Hooks

- `useCrudPanel<T>` — generic CRUD state for Item Type/Tax/Distributor panels (loading, editing, errors, success messages)
- `useDebounce<T>` — search input debouncing

## Currency Handling

Always use `currency.ts` utilities: `normalizeCurrencyForInput()` for input, `formatCurrency()` for display, `parseCurrencyDigitsToDollars()` for conversion.
