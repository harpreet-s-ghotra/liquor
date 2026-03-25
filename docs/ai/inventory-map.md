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
├── Departments tab → DepartmentPanel (useCrudPanel)
├── Tax Codes tab → TaxCodePanel (useCrudPanel)
└── Vendors tab → VendorPanel (useCrudPanel)
```

## File Inventory

### Renderer Components — `src/renderer/src/components/inventory/`

| File | Purpose |
|------|---------|
| `InventoryModal.tsx` + `.css` | Modal shell, tab switching, search state |
| `FooterActionBar.tsx` + `.css` | Search input, action buttons, search dropdown |
| `tabs.ts` | Tab enum/constants |
| `items/ItemForm.tsx` + `.css` | Product form with 4 inner tabs |
| `departments/DepartmentPanel.tsx` | Department CRUD via `useCrudPanel` |
| `tax-codes/TaxCodePanel.tsx` | Tax code CRUD via `useCrudPanel` |
| `vendors/VendorPanel.tsx` | Vendor CRUD via `useCrudPanel` |

### Common components used by ItemForm

| Component | Purpose |
|-----------|---------|
| `common/ErrorModal` | Save/delete errors — strips Electron IPC prefix from messages |
| `common/SuccessModal` | Save/delete success — auto-dismisses after 5 seconds |
| `common/ConfirmDialog` | Delete confirmation |

### Backend — `src/main/database/`

| File | Key functions |
|------|--------------|
| `products.repo.ts` | `getInventoryProducts`, `searchInventoryProducts`, `getInventoryProductDetail`, `saveInventoryItem`, `deleteInventoryItem`, `getInventoryDepartments`, `getInventoryTaxCodes` |
| `departments.repo.ts` | `getDepartments`, `createDepartment`, `updateDepartment`, `deleteDepartment` |
| `tax-codes.repo.ts` | CRUD for tax codes |
| `vendors.repo.ts` | CRUD for vendors |

### IPC Channels

- `inventory:products:search`, `inventory:products:detail`, `inventory:products:save`, `inventory:products:delete`
- `inventory:departments:list`, `inventory:tax-codes:list`
- `departments:list/create/update/delete`
- `tax-codes:list/create/update/delete`
- `vendors:list/create/update/delete`

### Shared Types — `src/shared/types/index.ts`

| Type | Used by |
|------|---------|
| `InventoryProduct` | Search results, FooterActionBar dropdown |
| `InventoryProductDetail` | ItemForm (full product with relations) |
| `SaveInventoryItemInput` | Save payload from ItemForm |
| `Department`, `TaxCode`, `Vendor` | CRUD panels |

### Tests

| Test file | Covers |
|-----------|--------|
| `InventoryModal.test.tsx` | Tab switching, search, breadcrumbs |
| `FooterActionBar.test.tsx` | Search input, action buttons, dropdown |
| `items/ItemForm.test.tsx` | Form fields, tab switching, save/delete |
| `departments/DepartmentPanel.test.tsx` | Department CRUD |
| `tax-codes/TaxCodePanel.test.tsx` | Tax code CRUD |
| `vendors/VendorPanel.test.tsx` | Vendor CRUD |
| `products.repo.test.ts` | Backend inventory queries |
| `tests/e2e/inventory.spec.ts` | Item CRUD E2E |
| `tests/e2e/inventory-management.spec.ts` | Dept/Tax/Vendor CRUD E2E |

### Docs

| Doc | Content |
|-----|---------|
| `docs/inventory-management-v1.md` | Original spec (v1) |
| `docs/inventory-modal-v2-plan.md` | Active redesign plan |

## Key Hooks

- `useCrudPanel<T>` — generic CRUD state for Dept/Tax/Vendor panels (loading, editing, errors, success messages)
- `useDebounce<T>` — search input debouncing

## Currency Handling

Always use `currency.ts` utilities: `normalizeCurrencyForInput()` for input, `formatCurrency()` for display, `parseCurrencyDigitsToDollars()` for conversion.
