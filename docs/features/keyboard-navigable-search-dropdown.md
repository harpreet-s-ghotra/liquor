# Keyboard-Navigable Search Dropdown

**Status:** Complete
**Date:** 2026-04-23
**Scope:** Add full keyboard navigation (Up/Down/Enter/Escape/Home/End) to every search input that opens a typeahead-style results dropdown. Extract the shared logic into one reusable component + hook so we stop reimplementing this per panel.

---

## Why

Today, every search-with-dropdown in the app reimplements the same "open the menu, click a row" pattern but none support keyboard selection. An operator using a barcode scanner or a keyboard cannot pick a result without reaching for the mouse.

Three call sites currently:

| Location                                                   | Trigger                   | Result list                                   |
| ---------------------------------------------------------- | ------------------------- | --------------------------------------------- |
| `inventory/FooterActionBar.tsx:67-108`                     | Inventory items search    | `<ul role="listbox">` of `InventoryProduct`   |
| `inventory/purchase-orders/PurchaseOrderPanel.tsx:498-547` | Add product to a draft PO | `<ul>` of `Product` filtered to a distributor |
| `inventory/reorder/ReorderDashboard.tsx:600-630`           | Add item to reorder list  | `<div>` of `InventoryProduct` matches         |

All three:

- Render a results list under a search input
- Close on outside click
- Select via `onMouseDown` / `onClick` only
- Have **no** `ArrowUp` / `ArrowDown` / `Enter` handling

Out of scope:

- `SearchModal.tsx` (full-screen results table, not a dropdown — different shape)
- `HeaderBar.tsx` settings dropdown (menu, not search)
- The plain filter inputs in `ItemTypePanel`, `TaxCodePanel`, `DistributorPanel` (no dropdown — they filter the table in place)

---

## Target Behaviour

When the dropdown is open and focus is on the input:

| Key           | Action                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ArrowDown`   | Move highlight down by 1. Wraps from last to first. Opens dropdown if closed and results exist.                  |
| `ArrowUp`     | Move highlight up by 1. Wraps from first to last.                                                                |
| `Home`        | Highlight first result.                                                                                          |
| `End`         | Highlight last result.                                                                                           |
| `Enter`       | Select highlighted result. If no row is highlighted, fall back to current `onEnter` behaviour (e.g. run search). |
| `Escape`      | Close dropdown. Highlight resets. Focus stays in input.                                                          |
| `Tab`         | Close dropdown, advance focus normally — never select.                                                           |
| `Mouse hover` | Move highlight to hovered row (no auto-select).                                                                  |
| `Mouse click` | Select hovered row. Same path as `Enter` on highlighted row.                                                     |

When the dropdown opens (results appear after typing), highlight defaults to **none** — first `ArrowDown` highlights index 0. This avoids accidentally selecting the wrong row when the user pauses typing.

When results change (new query, new fetch), highlight resets to none.

ARIA per the [WAI-ARIA Combobox 1.2 listbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- Input: `role="combobox"`, `aria-expanded`, `aria-controls={listboxId}`, `aria-autocomplete="list"`, `aria-activedescendant={highlightedOptionId}`.
- Listbox: `role="listbox"`, `id={listboxId}`.
- Options: `role="option"`, `id={optionId}`, `aria-selected={index === highlightIndex}`.
- Highlight visual: a `--highlighted` BEM modifier on the row, driven by state — not `:hover`.

---

## Design — Reusable Pieces

Two pieces, layered:

### 1. `useSearchDropdown<TItem>` hook (`src/renderer/src/hooks/useSearchDropdown.ts`)

Owns the state machine. Headless. No JSX.

```ts
type UseSearchDropdownOptions<TItem> = {
  results: TItem[]
  isOpen: boolean
  onSelect: (item: TItem) => void
  onClose: () => void
  onEnterWithoutHighlight?: () => void // e.g. submit raw query
}

type UseSearchDropdownReturn = {
  highlightIndex: number // -1 = nothing highlighted
  setHighlightIndex: (index: number) => void
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  getOptionProps: (index: number) => {
    id: string
    role: 'option'
    'aria-selected': boolean
    onMouseEnter: () => void
    onMouseDown: (event: React.MouseEvent) => void
  }
  getInputProps: () => {
    role: 'combobox'
    'aria-expanded': boolean
    'aria-controls': string
    'aria-autocomplete': 'list'
    'aria-activedescendant': string | undefined
  }
  listboxId: string
}
```

Internals:

- Generate a stable `listboxId` via `useId()`.
- Reset `highlightIndex` to `-1` when `results` reference changes or `isOpen` flips false.
- Wrap-around math on Up/Down.
- Scroll the highlighted option into view via a small `scrollIntoView({ block: 'nearest' })` call when the index changes — only when the option DOM exists. Use a ref map keyed by index, populated by the consumer or by `getOptionProps` callbacks (decide during implementation; simplest is a `data-option-index` attribute and `querySelector` inside the hook).

This is the **only** new piece of logic. The hook can be tested in isolation with `@testing-library/react`'s `renderHook`.

### 2. `SearchDropdown<TItem>` component (`src/renderer/src/components/common/SearchDropdown.tsx`)

Thin presentational wrapper that combines an `InventoryInput` (or plain input via prop) with a positioned listbox. Uses `useSearchDropdown` under the hood.

```tsx
type SearchDropdownProps<TItem> = {
  value: string
  onValueChange: (value: string) => void
  results: TItem[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: TItem) => void
  onSubmit?: () => void // Enter with no highlight
  renderOption: (item: TItem, isHighlighted: boolean) => React.ReactNode
  getOptionKey: (item: TItem) => string | number
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement>
  className?: string // applied to wrapper for site-specific layout
  inputClassName?: string // applied to the input
  listboxClassName?: string // applied to the <ul>
  optionClassName?: string // applied to each <li>
  disabled?: boolean
  ariaLabel: string
  emptyState?: React.ReactNode // e.g. "No item found for SKU X" footer
}
```

The component:

- Forwards `inputRef` so call sites that already manage focus (`searchInputRef` in `FooterActionBar`) continue to work.
- Uses `onMouseDown` (not `onClick`) on options to fire **before** the input loses focus — matches today's behaviour at all three sites.
- Keeps outside-click-to-close as the call site's responsibility, because each site already has a wrapper ref. Optionally accept a `wrapperRef` and handle it internally — only do this if it doesn't force layout regressions in the inventory footer.

Why both a hook and a component:

- The component is enough for FooterActionBar and PurchaseOrderPanel — both have similar dropdown shells.
- ReorderDashboard has a more elaborate row layout with loading state inside the dropdown; it uses the hook directly with its own JSX.
- Sites that already use `InventoryInput` for compact styling can pass `inputClassName` to keep their look.

---

## Per-Site Migration

### `FooterActionBar.tsx`

Replace lines 65-128:

- The `<input>` + `<ul role="listbox">` pair becomes one `<SearchDropdown>` instance.
- Because the inventory search lives in the bottom footer bar, its listbox opens **upward** above the input instead of downward into the footer chrome.
- The "No item found for X" block stays as the `emptyState` slot — it sits below the listbox.
- The search button next to the input stays as a sibling of the dropdown (component returns the wrapper only, not the button).
- `onSubmit` wires to the existing `onSearch` callback so `Enter` with no highlight runs the SKU search.
- `searchInputRef` continues to flow through.

### `PurchaseOrderPanel.tsx`

Replace lines 498-547 (`po-panel__create-item-search`):

- Wraps the input + listbox.
- `onSelect={handleSelectSearchResult}`.
- `renderOption` returns the existing two-line layout (name + SKU + price).
- Drop the bespoke `useEffect` that toggles `setItemSearchOpen` based on results — `SearchDropdown` owns `isOpen` via `onOpenChange`.

### `ReorderDashboard.tsx`

Replace the input + `reorder-dashboard__search-results` block (around 600-630):

- Use the **hook** directly instead of the component, because the dropdown shows a loading row when `searchLoading` is true and the row layout has more columns.
- Apply `getInputProps()` to the existing `InventoryInput` and `getOptionProps(i)` to each result row.
- Loading row stays a non-option `<div>` outside `getOptionProps`.

---

## Tests

### Hook (`src/renderer/src/hooks/useSearchDropdown.test.ts`)

- `ArrowDown` from `-1` → highlights `0`.
- `ArrowDown` past last → wraps to `0`.
- `ArrowUp` from `-1` → highlights last.
- `Home` / `End` → first / last.
- `Enter` with `highlightIndex >= 0` → calls `onSelect` with that item.
- `Enter` with `highlightIndex === -1` → calls `onEnterWithoutHighlight` if provided.
- `Escape` → calls `onClose` and resets `highlightIndex`.
- Changing `results` reference → resets `highlightIndex` to `-1`.
- `isOpen → false` → resets `highlightIndex`.

### Component (`src/renderer/src/components/common/SearchDropdown.test.tsx`)

- Renders the input with `role="combobox"` and `aria-expanded` reflecting `isOpen`.
- Renders one `role="option"` per result.
- Highlighted option gets `aria-selected="true"` and the `--highlighted` modifier class.
- `aria-activedescendant` on the input matches the highlighted option's id.
- Mouse hover changes the highlight without selecting.
- `Enter` selects the highlighted item.

### Site tests (extend, don't replace)

- `FooterActionBar.test.tsx`: add coverage for `ArrowDown` → `Enter` flow selecting the first result, calling `onSelectSearchResult` with the right `InventoryProduct`.
- `PurchaseOrderPanel.test.tsx`: same for the create-PO add-item search.
- A new test file or an extension to `ReorderDashboard.test.tsx` for the hook-driven path.

### E2E

Add one Playwright path that types into the inventory search, presses `ArrowDown` twice and `Enter`, then asserts the second result's item form is loaded. One path is enough — the other sites are covered by unit tests.

---

## File Touch List

New:

- `src/renderer/src/hooks/useSearchDropdown.ts`
- `src/renderer/src/hooks/useSearchDropdown.test.ts`
- `src/renderer/src/components/common/SearchDropdown.tsx`
- `src/renderer/src/components/common/SearchDropdown.test.tsx`
- `src/renderer/src/components/common/search-dropdown.css`

Edited:

- `src/renderer/src/components/inventory/FooterActionBar.tsx`
- `src/renderer/src/components/inventory/FooterActionBar.test.tsx`
- `src/renderer/src/components/inventory/purchase-orders/PurchaseOrderPanel.tsx`
- `src/renderer/src/components/inventory/purchase-orders/PurchaseOrderPanel.test.tsx`
- `src/renderer/src/components/inventory/purchase-orders/purchase-order-panel.css` — drop the now-redundant dropdown styles, keep site-specific overrides.
- `src/renderer/src/components/inventory/reorder/ReorderDashboard.tsx`
- `src/renderer/src/components/inventory/reorder/ReorderDashboard.test.tsx`
- `src/renderer/src/components/inventory/reorder/reorder-dashboard.css` — same.

Docs:

- This file.
- Add a row to `docs/README.md`.
- Add `SearchDropdown` and `useSearchDropdown` to the **Component Lookup** table in `CLAUDE.md` so future search-with-results inputs default to the shared component.

---

## CSS

`search-dropdown.css` defines the **base** styles — positioning, listbox shadow, option padding, the `--highlighted` modifier — using existing tokens from `tokens.css`:

```css
.search-dropdown {
  position: relative;
}
.search-dropdown__listbox {
  position: absolute;
  z-index: 20;
  top: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  list-style: none;
  box-shadow: var(--shadow-md);
}
.search-dropdown__option {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}
.search-dropdown__option--highlighted {
  background: var(--bg-input);
}
```

Sites pass `optionClassName` to override row layout (two-line, single-line, etc).

---

## Risks

- **Site-specific CSS regressions.** The current dropdowns each have their own positioning; consolidating to one wrapper risks visual drift. Mitigation: keep `inputClassName` / `listboxClassName` overrides and screenshot-check each site after migration.
- **Outside-click handling.** Each site has its own `useEffect` with a wrapper ref. Keeping that in the call site is simpler than internalizing it; revisit if it causes drift.
- **Mouse hover changing highlight.** Some users find this jumpy. We mirror the WAI-ARIA pattern — confirm with a quick manual test before shipping; if it feels wrong, drop hover-to-highlight and keep keyboard-only.
- **Scroll-into-view for long result lists.** All three current sites cap at ~20 results. If a future caller raises this, the `scrollIntoView` call must work — verify with a 50-result fixture in the hook test.

---

## Verification

1. `npx prettier --write .`
2. `npm run lint`
3. `npx stylelint "src/**/*.css"`
4. `npm run typecheck`
5. `npm run test:coverage` — must stay ≥ 80%.
6. `npm run test:e2e`.
7. Manual:
   - F2 → Items tab → type a partial name → `ArrowDown` highlights row 1 → `ArrowDown` again to row 2 → `Enter` loads that item.
   - F2 → Purchase Orders → New Order → pick distributor → search a product → `ArrowUp` from no-highlight wraps to last result → `Enter` adds it to the line list.
   - F2 → Reorder → search → loading row appears, then results → arrow keys skip the loading row and only navigate selectable options.
   - `Escape` closes the dropdown but keeps the typed query in the input.
   - `Tab` closes the dropdown without selecting.
   - Screen reader (VoiceOver on macOS) announces "row 2 of 12 highlighted" as the highlight moves.

---

## Out of Scope

- Async-search debounce changes — every site already debounces via `useDebounce`.
- Reworking `SearchModal.tsx` — different surface (table view, not typeahead).
- Adding a global "/" hotkey to focus the inventory search.
- Persisting the last-typed query.
