# Product Search Modal

## Overview

Add a **Search** button to the main POS screen (TicketPanel) that opens a full-featured product search modal. This gives cashiers a fast way to find items by name with optional department and distributor filters — useful when the item isn't visible in the product grid or its SKU is unknown.

## Current Layout

The TicketPanel top bar currently has two inputs in a grid:

```
[ Search item (1fr)  ] [ Qty (5.5rem) ]
```

## Proposed Layout

Add a **Search** button after the Qty input:

```
[ Search item (1fr)  ] [ Qty (5.5rem) ] [ 🔍 Search (5.5rem) ]
```

The grid changes from `1fr 5.5rem` → `1fr 5.5rem 5.5rem`.

### Button Spec

| Property  | Value                                 |
| --------- | ------------------------------------- |
| Label     | `Search` (with magnifying glass icon) |
| Size      | `md` (matches Qty input height)       |
| Variant   | `secondary` or `outline`              |
| Min width | `5.5rem`                              |
| Action    | Opens the Search Modal                |

## Search Modal

### Trigger

- Click the Search button, OR
- Keyboard shortcut (future): `Ctrl+F` / `Cmd+F`

### Layout

A centered overlay modal following the existing modal pattern (like InventoryModal / PaymentModal):

```
┌──────────────────────────────────────────────────┐
│  Product Search                         [Close]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Filters:                                        │
│  [ Department ▾ ]  [ Distributor ▾ ]              │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  #   Name          Dept    Price   Qty   │    │
│  │  ─────────────────────────────────────── │    │
│  │  101 Jack Daniels  Whiskey  $29.99  45   │    │
│  │  102 Jameson       Whiskey  $24.99  30   │    │
│  │  103 Crown Royal   Whiskey  $27.99  25   │    │
│  │  ...                                     │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [ Search items...                      ] [Go]   │
├──────────────────────────────────────────────────┤
│  Showing 3 of 3 results                          │
└──────────────────────────────────────────────────┘
```

### Modal Spec

| Property              | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| Size                  | `w-[min(60rem,95%)] h-[min(80vh,44rem)]`                    |
| Grid rows             | `auto auto 1fr auto` (header, filters, results, search bar) |
| Close                 | Close button in header; `Escape` key                        |
| Prevent outside click | Yes (matches existing modals)                               |

### Filters Row

Two dropdown selects side by side:

| Filter      | Source              | Default |
| ----------- | ------------------- | ------- |
| Department  | `getDepartments()`  | All     |
| Distributor | `getDistributors()` | All     |

Filters are applied _in combination_ with the search text. Changing a filter re-runs the search automatically if there is existing search text.

### Results Table

| Column   | Width  | Source                    |
| -------- | ------ | ------------------------- |
| #        | `3rem` | `item_number` (row index) |
| Name     | `1fr`  | `name`                    |
| SKU      | `7rem` | `sku`                     |
| Dept     | `8rem` | `category` (department)   |
| Price    | `6rem` | `price` (formatted)       |
| In Stock | `5rem` | `quantity`                |

- Rows are clickable — clicking a row adds the item to the cart and closes the modal
- Empty state: "No items found. Try a different search." (shown when search returns 0 results)
- Initial state: on open, auto-runs an empty search and shows all active products (no empty-form prompt)
- Max results: display up to 100 rows (truncate if more)

### Search Bar (Bottom)

Positioned at the bottom of the modal (same pattern as other modals):

```
[ Search items...                              ] [Go]
```

| Element   | Spec                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| Input     | Full width minus Go button, `text-lg`, autofocus                                |
| Go button | `size="md"`, triggers search                                                    |
| Enter key | Also triggers search                                                            |
| Behavior  | Searches by item name (LIKE %query%) with active department/distributor filters |

## Data Contract

### New IPC Channel

```typescript
// Renderer → Main
'db:searchProducts': (query: string, filters: { departmentId?: number; distributorNumber?: string }) => Product[]
```

### Backend Query

Extend `products.repo.ts` with a new function:

```typescript
function searchProducts(
  query: string,
  filters: { departmentId?: number; distributorNumber?: string }
): Product[]
```

SQL logic:

```sql
SELECT p.item_number AS id, p.sku, p.name, p.category,
       COALESCE(p.retail_price, p.price) AS price,
       COALESCE(p.in_stock, p.quantity) AS quantity,
       p.tax_rate
FROM products p
WHERE p.active = 1
  AND (p.name LIKE '%' || ? || '%' OR p.sku LIKE '%' || ? || '%')
  AND (? IS NULL OR p.dept_id = ?)
  AND (? IS NULL OR p.distributor_number = ?)
ORDER BY p.name ASC
LIMIT 100
```

## Component Structure

```
src/renderer/src/components/search/
  SearchModal.tsx        — Modal wrapper, state, search logic
  SearchModal.css        — Scoped styles
  SearchResultsTable.tsx — Results table component
```

## State Management

The search modal state lives in `usePosScreen.ts` (the POS screen store):

```typescript
// New state
isSearchModalOpen: boolean
openSearchModal: () => void
closeSearchModal: () => void
```

No global search state is needed — the modal manages its own search text, filters, and results internally via `useState`.

## User Flow

1. Cashier clicks **Search** button (or presses shortcut)
2. Modal opens with focus on the search input at the bottom
3. Cashier optionally selects Department and/or Distributor filters
4. Cashier types item name and presses Enter (or clicks Go)
5. Results appear in the table
6. Cashier clicks a result row → item is added to cart at current quantity
7. Modal closes automatically

## Implementation Steps

1. Add `isSearchModalOpen` state + actions to `usePosScreen.ts`
2. Create `SearchModal.tsx` and `SearchResultsTable.tsx` components
3. Add `searchProducts` function to `products.repo.ts`
4. Register `db:searchProducts` IPC channel in `src/main/index.ts`
5. Expose in preload (`src/preload/index.ts` and `src/preload/index.d.ts`)
6. Add the Search button to `TicketPanel.tsx` grid layout
7. Mount `SearchModal` in `POSScreen.tsx`
8. Write unit tests for the modal, results table, and store changes
9. Write unit test for the backend `searchProducts` function
10. Run quality gate: `lint → typecheck → test:coverage → test:e2e`

## Testing

### Unit Tests

- `SearchModal.test.tsx` — renders, opens/closes, search triggers IPC, results display, row click adds to cart
- `SearchResultsTable.test.tsx` — renders columns, empty state, row click callback
- `products.repo.test.ts` — `searchProducts` returns filtered results, respects department/distributor filters

### E2E

- Add search flow to `tests/e2e/` — open modal, search, verify results, click to add to cart

## Accessibility

- Modal traps focus when open
- Search input gets autofocus
- Escape closes modal
- Result rows are keyboard-navigable (arrow keys + Enter to select)
- ARIA labels on filter dropdowns and table
