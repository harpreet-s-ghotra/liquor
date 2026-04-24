# Inventory Modal v2

> Figma reference: `node-id=6:3` in file `99ouO4wLIDF6jwNQIhZUax`

**Status:** Complete

---

## Overview

The inventory modal (`InventoryModal` + `ItemForm`) was redesigned into a more professional, dense, POS-style interface. The changes were primarily visual, and the modal now also owns the inventory-adjacent procurement workflows for Reorder and Purchase Orders.

---

## Current Architecture Summary

Understanding the existing system is essential before making changes.

### Component Hierarchy

```
InventoryModal.tsx              ← Modal shell + tab container
├── ItemForm.tsx                ← Product CRUD (search, create, edit, save)
│   ├── Tab: Case & Quantity    (bottles per case, case discount)
│   ├── Tab: Additional SKUs    (alternate UPC/SKU codes)
│   ├── Tab: Special Pricing    (quantity-based pricing rules table)
│   └── Tab: Sales History      (transaction history for this item)
├── DepartmentPanel.tsx         ← CRUD for item types (uses useCrudPanel hook, backed by departments table)
├── TaxCodePanel.tsx            ← CRUD for tax codes (uses useCrudPanel hook)
├── DistributorPanel.tsx        ← CRUD for distributors (uses useCrudPanel hook)
├── ReorderDashboard.tsx        ← Inventory-scoped reorder projections and PO handoff
└── PurchaseOrderPanel.tsx      ← Inventory-scoped purchase order workflow
```

### Data Flow

```
ItemForm (React state)
  → window.api.searchInventoryProducts()    [debounced 300ms, IPC invoke]
  → window.api.getInventoryProductDetail()  [on item select]
  → window.api.saveInventoryItem()          [on save]
  → window.api.getInventoryItemTypes()      [on mount]
  → window.api.getInventoryTaxCodes()       [on mount]
  → window.api.getDistributors()             [on mount]

IPC bridge (preload/index.ts)
  → ipcMain.handle in src/main/index.ts
  → products.repo.ts / departments.repo.ts (item type compatibility layer) / tax-codes.repo.ts / distributors.repo.ts
  → SQLite via better-sqlite3
```

### Key Types (src/shared/types/index.ts)

```typescript
InventoryProductDetail {
  item_number, sku, item_name, dept_id, vendor_number,
  cost, retail_price, in_stock,
  tax_rates: number[],          // array of rate decimals (e.g. [0.085])
  additional_skus: string[],
  sales_history: TransactionHistoryItem[],
  special_pricing: SpecialPricingRule[],
  bottles_per_case, case_discount_price
}

SaveInventoryItemInput {
  item_number?, sku, item_name, dept_id, vendor_number,
  cost, retail_price, in_stock, tax_rates[],
  special_pricing[], additional_skus[],
  bottles_per_case, case_discount_price
}
```

### State Management in ItemForm

`ItemForm` uses **local React state** (`useState`) for its form — not Zustand. Key state shape:

```typescript
type InventoryFormState = {
  item_number?: number
  sku: string
  item_name: string
  item_type: string
  vendor_number: string
  cost: string
  retail_price: string
  in_stock: string
  tax_rates: string[] // currently multi-select
  special_pricing: SpecialPricingFormRow[]
  additional_skus: string[]
  bottles_per_case: string
  case_discount_price: string
  case_discount_mode: 'percent' | 'dollar'
}
```

### Existing Tests Overview

**Unit / Component tests (Vitest + Testing Library):**

| File                        | What it covers                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `InventoryModal.test.tsx`   | Tab switching between Items / Item Types / Tax Codes / Distributors     |
| `ItemForm.test.tsx`         | Form validation, field errors, currency parsing, save flow, search      |
| `DepartmentPanel.test.tsx`  | CRUD: create, edit, delete, search filter for item types                |
| `TaxCodePanel.test.tsx`     | CRUD: create, edit, delete                                              |
| `DistributorPanel.test.tsx` | CRUD: create, edit, delete, validation                                  |
| `TabBar.test.tsx`           | Tab switching, aria attributes                                          |
| `currency.test.ts`          | formatCurrency, parseCurrencyDigitsToDollars, normalizeCurrencyForInput |
| `pricing-engine.test.ts`    | Group deals, special pricing application, totals                        |
| `POSScreen.test.tsx`        | Inventory modal open/close, product reload on close                     |

**E2E tests (Playwright):**

| File                           | What it covers                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| `inventory.spec.ts`            | Search for a product, select for editing, verify form populates |
| `inventory-management.spec.ts` | Item Type / Tax Code / Distributor CRUD end-to-end              |
| `transactions.spec.ts`         | Full transaction flow (touches cart totals incl. tax)           |

---

## Functional Changes Required

This redesign is **mostly visual**, but the following functional changes are needed:

### 1. Computed Display Fields (read-only, no backend changes)

Two new read-only fields must be **computed in the frontend** and displayed in the General Information section. They are derived from existing form values and update live as the user edits:

| Field                       | Formula                                        | Notes                                                                                     |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Final Price (after tax)** | `retail_price × (1 + sum(tax_rates))`          | Recalculates whenever `retail_price` or `tax_rates` changes                               |
| **Profit Margin %**         | `((retail_price − cost) / retail_price) × 100` | Recalculates whenever `retail_price` or `cost` changes; show as `--` if retail_price is 0 |

These are display-only and are **not saved to the backend**.

### 2. New Persisted Fields (require backend + type changes)

| Field                     | Type                    | Where added                                                                                                        |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `item_type`               | `string`                | `InventoryFormState`, `SaveInventoryItemInput`, schema, products.repo.ts                                           |
| `allow_food_stamps`       | `boolean`               | Same as above                                                                                                      |
| `prompt_for_price_at_pos` | `boolean`               | Same as above                                                                                                      |
| `scale_at_pos`            | `boolean`               | Same as above                                                                                                      |
| `bonus_points_earned`     | `number`                | Same as above                                                                                                      |
| `commission_amount`       | `string`                | Same as above                                                                                                      |
| `commission_mode`         | `'dollar' \| 'percent'` | Same as above                                                                                                      |
| `physical_location`       | `string`                | Same as above                                                                                                      |
| `brand_name`              | `string`                | `InventoryFormState`, `SaveInventoryItemInput`, schema, products.repo.ts                                           |
| `proof`                   | `number \| null`        | Same as above                                                                                                      |
| `alcohol_pct`             | `number \| null`        | Same as above                                                                                                      |
| `vintage`                 | `string`                | Same as above                                                                                                      |
| `ttb_id`                  | `string`                | Same as above — TTB registration ID for NYSLA data matching; preserve the raw value exactly as entered or imported |

### 3. Field Renames / Type Changes

| Field                 | Change                                                                                                                                       | Impact                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `item_name`           | Renamed to `description` in UI label only — keep internal key as `item_name` to avoid breaking IPC contracts                                 | Label only, no type change                                                                    |
| `dept_ids: string[]`  | Replaced in the renderer by canonical `item_type: string`; saves still mirror the value into legacy `dept_id` for compatibility              | `InventoryFormState`, `SaveInventoryItemInput`, products.repo.ts, DepartmentPanel integration |
| `tax_rates: string[]` | Changed to single-select (`tax_profile_id: string`) in UI, but the saved value is still a single-element array to avoid breaking the backend | UI change only; wrap in array on save                                                         |

### 4. Search Bar Relocation

The existing debounced search input (currently inside `ItemForm`) is moved into the new `FooterActionBar` component. The search logic, debounce hook, and results dropdown remain unchanged — only their render location changes.

### 5. Button Relocation

"New Item" and "Save Item" buttons currently live in the `InventoryModal` header area. They move to the `FooterActionBar`. "Delete Item" (currently missing) is added. "Discard" resets the form to its last loaded state.

### 6. No Changes To

- IPC channel names
- `useCrudPanel` hook
- `DepartmentPanel`, `TaxCodePanel`, `DistributorPanel` — visual reskin only (`DepartmentPanel` now presents item types)
- `pricing-engine.ts`
- `currency.ts` utilities
- Auth / payment flows

---

## Section-by-Section Visual Breakdown

### Modal Shell

| Property      | Current            | New                                          |
| ------------- | ------------------ | -------------------------------------------- |
| Max width     | `min(82rem, 100%)` | `1152px`                                     |
| Max height    | `min(96vh, 56rem)` | `~96vh`                                      |
| Border radius | varies             | `rounded-[16px]`                             |
| Background    | CSS var            | `#f7fafc`                                    |
| Border        | CSS var            | `1px solid rgba(194,199,202,0.3)`            |
| Shadow        | none               | `0px 25px 50px -12px rgba(0,0,0,0.25)`       |
| Overlay       | shadcn Dialog      | `rgba(24,28,30,0.4)` + `backdrop-blur-[1px]` |

---

### Modal Header

| Property      | Current                      | New                                                                                       |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| Background    | CSS var surface              | `#f8fafc`                                                                                 |
| Border bottom | CSS var                      | `1px solid rgba(194,199,202,0.3)`                                                         |
| Title         | "Inventory Maintenance"      | "INVENTORY MAINTENANCE" — Work Sans Black, 18px, `#181c1e`, `tracking-[-0.45px]`          |
| Icon          | none                         | Small icon left of title                                                                  |
| Subtitle      | none                         | Vertical divider → "Edit Record: {SKU}" — Inter Bold, 12px, `#73787b`, `tracking-[1.2px]` |
| Buttons       | New Item + Save Item + Close | Close only (X, `rounded-[12px]`, 40×40) — actions move to footer                          |

---

### Section 1: General Information

**New layout:** White card with `rounded-[8px]` border+shadow, grey section header band, `grid grid-cols-4` with 4 rows (3 from Figma + 1 added row for computed fields).

#### Section Header Band

- Background: `#e0e3e5`
- Border bottom: `1px solid rgba(194,199,202,0.3)`
- Content: small icon + "GENERAL INFORMATION" (Work Sans Black, 10px, uppercase, `#42474a`, `tracking-[1px]`)
- Padding: `8px 16px 9px`

#### Form Grid — 4 columns, 4 rows, `gap-x-[16px] gap-y-[8px]`, `p-[16px]`

| Position       | Field                       | Type                      | Notes                                                                                                                                                    |
| -------------- | --------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row 1, Col 1   | **Item Type**               | Single-select dropdown    | Canonical inventory classification. Selecting an item type applies its default tax code and profit margin.                                               |
| Row 1, Col 3   | **Item Number / SKU**       | Text input                | Font: Liberation Mono Bold, 12px.                                                                                                                        |
| Row 1, Col 4   | **Cost**                    | Currency input            | Right-aligned, red text `#86000d`.                                                                                                                       |
| Row 2, Col 1–2 | **Description**             | Text input (spans 2 cols) | Label renamed; internal key stays `item_name`. Uppercase display.                                                                                        |
| Row 2, Col 3   | **Price You Charge**        | Currency input            | Green bg `#a3f69c`, green text `#002204`, `$` prefix. 14px font.                                                                                         |
| Row 2, Col 4   | **# In Stock**              | Number input              | Blue text `#005db7`, centered, 14px.                                                                                                                     |
| Row 3, Col 1   | **Tax Profile**             | Single-select dropdown    | Renamed from "Tax Codes". Single-select in UI; wrap in array on save.                                                                                    |
| Row 3, Col 2   | **Final Price (after tax)** | Read-only display         | **New computed field.** `retail_price × (1 + tax_rate)`. Updates live. Style: muted bg, italic or distinct label "FINAL W/ TAX".                         |
| Row 3, Col 3–4 | **Profit Margin %**         | Read-only display         | **New computed field.** `((price − cost) / price) × 100`. Updates live. Show `--` when price is 0. Color-code: green if > 20%, yellow 10–20%, red < 10%. |

**Input styling (all editable fields):**

- Background: `#e5e9eb`
- Border radius: `2px`
- Height: `32px`
- Inset shadow: `inset 0px 2px 4px 0px rgba(0,0,0,0.05)`
- Padding: `12px` horizontal

**Label styling:**

- Font: Work Sans Black, 9px, uppercase, `#73787b`, `tracking-[0.45px]`
- Margin bottom: `2.5px`

**Read-only field styling:**

- Background: `#f0f3f5` (lighter than editable inputs)
- Border: `1px dashed rgba(194,199,202,0.6)`
- Label suffix: "(calculated)"

---

### Section 2: Tab Bar

> **Tabs are NOT changing.** The Figma design's tab labels (Optional Info, Pending Orders, etc.) are the designer's placeholder names. We keep the **current four tabs** exactly as they are. Only the **visual styling** of the tab bar changes.

**Keep existing tabs:**

1. Case & Quantity _(default)_
2. Additional SKUs
3. Special Pricing
4. Sales History

**Tab bar styling changes:**

| Property         | Current               | New                                            |
| ---------------- | --------------------- | ---------------------------------------------- |
| Active indicator | Radix UI underline    | `border-b-4 border-[#004b0f]` (4px dark green) |
| Active text      | CSS var accent        | `#004b0f`, Work Sans Black, 11px               |
| Inactive text    | CSS var muted         | `#73787b`, Work Sans Bold, 11px                |
| Bar border       | none                  | `border-b-2 border-[#e5e9eb]`                  |
| Tab padding      | varies                | `pt-[8px] pb-[12px] px-[24px]`                 |
| Text transform   | normal                | uppercase, `tracking-[0.55px]`                 |
| Component        | `TabBar` + Radix Tabs | Replace Radix with custom underline nav        |

---

### Section 3: Tab Content

Tab content is **functionally unchanged**. Only the card wrapper styling updates to match the new design system:

- White card, `rounded-[8px]`, `shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]`, `border border-[rgba(194,199,202,0.3)]`
- Internal section sub-headers use: Work Sans Black, 10px, `#73787b`, `tracking-[2px]`, with `border-b border-[rgba(194,199,202,0.2)]`
- Inputs inside tabs adopt the same `#e5e9eb` bg, `rounded-[2px]`, inset shadow style as Section 1

The **Optional Info** section from the Figma (checkboxes + metadata fields) maps to new fields added inside the **Case & Quantity tab** or as an additional sub-section below the existing content, since these are item control flags that logically belong with item configuration:

- Item Controls checkboxes: Allow Food Stamps, Prompt for Price at POS, Scale at POS
- Metadata fields: Bonus Points Earned, Commission Amount, Physical Location

---

### Modal Footer: Action Bar

**New component** — `FooterActionBar.tsx`. Does not exist currently; buttons were in the header.

| Property   | Value                                                    |
| ---------- | -------------------------------------------------------- |
| Background | `#2d3133`                                                |
| Height     | `80px`                                                   |
| Padding    | `0 24px`                                                 |
| Layout     | flex, items centered, space between left and right zones |

#### Left: Item Search (relocated from ItemForm)

The existing debounced search input moves here. Styled for dark background:

- Input background: `#e5e9eb`
- Placeholder: light-colored text
- Results dropdown: same logic, positioned upward (`dropup`)

#### Right: Action Buttons

| Button               | Height | Style                                                    |
| -------------------- | ------ | -------------------------------------------------------- |
| **New Item**         | `48px` | `#10651d` bg, `rgba(0,75,15,0.5)` border, `#8ee088` text |
| **Save**             | `48px` | `#004b0f` bg, white text                                 |
| _(vertical divider)_ | —      | `2px rgba(194,199,202,0.3)`                              |
| **Delete Item**      | `40px` | `#af0f1a` bg, `#86000d` border, `#ffbdb7` text           |
| **Discard**          | `48px` | `#eef1f3` bg, `2px #c2c7ca` border, `#2d3133` text       |

All button text: Work Sans Black, 9–11px, uppercase.

**Discard behavior:** Resets `ItemForm` state back to last loaded item (or blank if no item selected). Equivalent to clicking New Item when already on a clean form.

---

## Design System Changes

| Token / Style         | Current               | New                                      |
| --------------------- | --------------------- | ---------------------------------------- |
| Input background      | `var(--bg-input)`     | `#e5e9eb`                                |
| Input border radius   | `var(--radius)`       | `2px`                                    |
| Input inset shadow    | none                  | `inset 0px 2px 4px 0px rgba(0,0,0,0.05)` |
| Label font            | inherited             | Work Sans Black, 9px, uppercase          |
| Label color           | `var(--text-muted)`   | `#73787b`                                |
| Section header bg     | none                  | `#e0e3e5` band                           |
| Tab active color      | blue accent           | `#004b0f` (dark green)                   |
| Tab bar border        | none                  | `2px solid #e5e9eb`                      |
| Footer bg             | none                  | `#2d3133`                                |
| Price field highlight | none                  | `#a3f69c` bg, `#002204` text             |
| Cost field color      | `var(--text-primary)` | `#86000d` (red)                          |
| Stock field color     | `var(--text-primary)` | `#005db7` (blue)                         |

**Fonts needed (add to `index.html`):**

- `Work Sans` — weights 700 (Bold) and 900 (Black)
- `Liberation Mono` — weight 700 (Bold), for SKU field
- `Inter` — Bold (verify already present)

---

## Tests That Need Updating

### Unit / Component Tests

| File                        | What changes                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InventoryModal.test.tsx`   | Button assertions: "New Item" / "Save Item" no longer in header; assert they exist in footer instead. Modal sizing assertions.                                                                                                                                                                                                                                              |
| `ItemForm.test.tsx`         | **Most impacted.** Update: (1) field label queries (`item_name` label becomes "Description"), (2) dept/tax selectors now single-select, (3) search bar render location (now in footer, not ItemForm), (4) new fields (item_type, checkboxes, bonus points, etc.), (5) computed fields (final price, profit margin) update on input change, (6) "Discard" button resets form |
| `TabBar.test.tsx`           | Tab styling assertions — aria patterns stay the same but CSS class assertions change if any exist                                                                                                                                                                                                                                                                           |
| `DepartmentPanel.test.tsx`  | Visual/wrapper changes only; CRUD logic unchanged — check if any class-based selectors break                                                                                                                                                                                                                                                                                |
| `TaxCodePanel.test.tsx`     | Same as above                                                                                                                                                                                                                                                                                                                                                               |
| `DistributorPanel.test.tsx` | Same as above                                                                                                                                                                                                                                                                                                                                                               |
| `POSScreen.test.tsx`        | No functional changes; verify inventory modal open/close still works                                                                                                                                                                                                                                                                                                        |
| `currency.test.ts`          | No changes needed                                                                                                                                                                                                                                                                                                                                                           |
| `pricing-engine.test.ts`    | No changes needed                                                                                                                                                                                                                                                                                                                                                           |

**New unit tests to write:**

| Test                                  | What to cover                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ItemForm.test.tsx` — computed fields | Final price updates when retail_price or tax_rate changes; profit margin updates on cost/price change; shows `--` when price is 0; color coding at thresholds |
| `ItemForm.test.tsx` — Discard         | Clicking Discard resets all fields to last-loaded state                                                                                                       |
| `ItemForm.test.tsx` — Delete Item     | Delete button present; triggers confirmation dialog; calls deleteInventoryItem on confirm                                                                     |
| `ItemForm.test.tsx` — new fields      | item_type dropdown renders options; checkboxes toggle correctly; bonus_points/commission/location save correctly                                              |
| `FooterActionBar.test.tsx`            | Search input present; action buttons present with correct labels; button disabled states                                                                      |

### E2E Tests (Playwright)

| File                           | What changes                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory.spec.ts`            | Search bar selector changes (it's now in the footer, not inside the form body). Update locator. Verify product selection still populates form. |
| `inventory-management.spec.ts` | Department / Tax Code / Distributor CRUD selectors may change if locators relied on specific layout classes. Verify.                           |
| `transactions.spec.ts`         | No changes expected — this doesn't touch the inventory modal UI.                                                                               |

**New E2E tests to write:**

| Test                                  | What to cover                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `inventory.spec.ts` — computed fields | Enter cost + price + select tax → assert final price and margin display correctly                          |
| `inventory.spec.ts` — Discard         | Edit a loaded item → click Discard → assert fields reset                                                   |
| `inventory.spec.ts` — Delete          | Load an item → click Delete → confirm dialog → item removed                                                |
| `inventory.spec.ts` — new fields      | Set item_type, check "Prompt for Price at POS", enter physical location → save → reload → verify persisted |

---

## File-by-File Change Summary

### Files to modify

| File                                 | Changes                                                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InventoryModal.tsx`                 | Modal shell sizing/radius/overlay, remove header action buttons, add `<FooterActionBar>`, update tab list styling                                                                                                                                     |
| `items/ItemForm.tsx`                 | Rework field grid (4-col, 4 rows), add computed fields, rename label (item_name→Description), single-select dept/tax, add Item Type dropdown, add new optional fields (checkboxes + metadata), remove search bar (moved to footer), add Discard logic |
| `items/ItemForm.test.tsx`            | Update all affected assertions; add tests for computed fields, Discard, Delete, new fields                                                                                                                                                            |
| `departments/DepartmentPanel.tsx`    | Visual reskin: input styles, label styles, card wrapper                                                                                                                                                                                               |
| `tax-codes/TaxCodePanel.tsx`         | Same as DepartmentPanel                                                                                                                                                                                                                               |
| `distributors/DistributorPanel.tsx`  | Same as DepartmentPanel                                                                                                                                                                                                                               |
| `crud-panel.css`                     | Update to new input/label styling or replace with inline Tailwind                                                                                                                                                                                     |
| `src/renderer/src/styles/tokens.css` | Add/extend tokens for new colors if needed                                                                                                                                                                                                            |
| `src/renderer/index.html`            | Add Work Sans + Liberation Mono font imports                                                                                                                                                                                                          |
| `tests/e2e/inventory.spec.ts`        | Update search locator; add new E2E tests                                                                                                                                                                                                              |

### Files to create

| File                                 | Purpose                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `inventory/FooterActionBar.tsx`      | Dark footer: search bar (left) + New / Save / Delete / Discard buttons (right) |
| `inventory/FooterActionBar.test.tsx` | Unit tests for footer component                                                |
| `shared/types/index.ts` additions    | New fields on `SaveInventoryItemInput` and `InventoryProductDetail`            |
| `main/database/schema.ts` additions  | New columns for item_type, allow_food_stamps, etc. (migration required)        |

---

## Implementation Order

1. **Fonts & tokens** — Add Work Sans + Liberation Mono to `index.html`; update CSS token values
2. **Modal shell** — Resize, update radius, overlay styling
3. **Modal header** — Add icon, title, subtitle, minimal close button; remove action buttons
4. **FooterActionBar** — New component with search bar + action buttons; move search logic from `ItemForm`
5. **General Information grid** — 4-col layout, rename labels, single-select dept/tax, Item Type field, color accents on price/cost/stock
6. **Computed fields** — Final price after tax + profit margin (read-only, live-updating)
7. **Tab bar reskin** — Custom underline nav, same 4 tabs, new dark-green active style
8. **Tab content reskin** — Card wrapper, sub-header styles, input styles inside tabs
9. **New optional fields** — Checkboxes (food stamps, price prompt, scale) + bonus points / commission / location
10. **CRUD panel reskin** — DepartmentPanel, TaxCodePanel, DistributorPanel visual updates
11. **Backend / DB** — Add new columns to schema, update repos, update shared types
12. **Tests** — Update all affected unit tests; add new unit + E2E tests

---

## Open Questions

1. **Item Type values** — What are the valid item types (Standard Item, Weighted, Service, etc.)? Needs a backend enum/lookup.
2. **Tax Profile single-select** — Confirm with backend whether items can ever have multiple tax rates. If yes, single-select is a UX simplification and the save layer wraps it in an array.
3. **Department single-select** — Current schema supports `dept_ids` (array). Confirm whether v2 intentionally restricts to one department per item, requiring a schema change.
4. **Pending Orders / Modifiers tabs** — Not implementing now (Figma tabs are design-only), but are these planned features for a future phase?
5. **Commission mode** — `$` flat amount vs `%` of sale price? Confirm which should be the default.
6. **"+" button on Department** — Should it open the DepartmentPanel in a slide-over/modal, or jump the user to the Departments tab?
7. **Delete Item** — Confirm a modal confirmation dialog is required before deletion (recommended).
8. **Profit margin color thresholds** — Confirm the thresholds for green / yellow / red (suggested: >20% green, 10–20% yellow, <10% red).
9. **DB migration strategy** — New columns for new fields: use `ALTER TABLE ... ADD COLUMN` with defaults, or create a new migration file?
