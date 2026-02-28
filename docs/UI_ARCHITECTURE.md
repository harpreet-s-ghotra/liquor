# UI Architecture Plan (MVP)

## Goal

Build a **modern pastel UI** inspired by the shared design reference, while preserving the **PC America POS layout structure** (operational flow, panel placement, touch-first controls).

This document defines:

- component boundaries,
- CSS strategy,
- design tokens,
- folder structure,
- phased refactor plan from current `App.tsx` monolith.

---

## Layout Rules (PC America structure, modern look)

### Required spatial structure

- **Left panel (primary)**
  - Search + quantity controls (top)
  - Current ticket/table of line items (middle)
  - Line action buttons (bottom)
- **Right panel (secondary)**
  - Totals summary (top)
  - Category selector row
  - Product quick-add grid
  - Payment method row + primary Pay action
- **Bottom strip**
  - Function-key style shortcuts (labels only in MVP)

### UX constraints for MVP

- Large touch targets (minimum 56px height for action buttons; 64–80px for primary actions)
- Ticket line "Item Info" text should be ~1.5x larger than base row text for cashier readability.
- Color semantics:
  - destructive = red/pink
  - warning/void = amber
  - positive/pay = green
  - neutral actions = cool gray/blue
- Category tabs and product cards should be color-coded by category using pastel tones for fast visual scanning.
- `Favorites` should be the default category on open (not `All`) so cashier workflows start with a focused subset of SKUs.
- Latest added/updated cart line should become selected automatically so Delete always targets the most recent interaction by default.
- Keyboard shortcuts are labeled but not functionally implemented yet
- No extra features beyond current MVP scope

---

## Visual Direction (from reference image)

### Style characteristics to keep

- Dark base/shell + pastel cards/buttons
- Rounded corners, soft contrast, clear hierarchy
- Compact but readable typography for cashier speed

### Suggested token set

Use CSS variables at app shell level (single source of truth):

```css
:root {
  --bg-shell: #111315;
  --bg-panel: #1c1f24;
  --bg-surface: #23272f;

  --pastel-pink: #f4c7dc;
  --pastel-lavender: #d8c7f2;
  --pastel-blue: #c7dff6;
  --pastel-mint: #c7f0de;
  --pastel-peach: #ffd9bf;

  --text-primary: #f5f7fa;
  --text-secondary: #b5bdc9;

  --semantic-danger: #f08f9f;
  --semantic-warning: #f4c37a;
  --semantic-success: #8ee39f;
  --semantic-accent: #95c7ff;
}
```

---

## Component Architecture

## Renderer folder structure

```text
src/renderer/src/
  components/
    layout/
      PosShell.tsx
      PosShell.css
      LeftPanel.tsx
      RightPanel.tsx
      BottomShortcutBar.tsx

    ticket/
      TicketControls.tsx
      TicketTable.tsx
      TicketLineRow.tsx
      TicketActions.tsx
      ticket.css

    catalog/
      CategoryTabs.tsx
      ProductPad.tsx
      ProductPadItem.tsx
      catalog.css

    payment/
      TotalsCard.tsx
      PaymentMethods.tsx
      PlaceOrderButton.tsx
      payment.css

    common/
      PosButton.tsx
      PosButton.css
      StatusBadge.tsx

  pages/
    POSScreen.tsx

  store/
    posStore.ts

  styles/
    tokens.css
    reset.css
    utilities.css
    app.css
```

---

## Data & state boundaries

### `POSScreen` responsibilities

- Compose layout only
- Trigger initial data load
- Connect store state/actions

### Zustand `posStore` responsibilities

- Products, categories, active category
- Cart lines, selected line, quantity input
- Derived totals (`subtotal`, `tax`, `total`)
- Actions:
  - `loadProducts`
  - `setSearch`
  - `setCategory`
  - `setQuantityInput`
  - `addToCart`
  - `removeSelectedLine`
  - `clearTransaction`

### Presentational components

Pure UI; no direct Electron or DB calls.

---

## CSS strategy decision

## Recommendation: **Hybrid (Tailwind + tokenized CSS files)**

Because you want strong visual consistency + maintainable structure:

- Use **Tailwind utilities** for spacing/layout primitives and responsive behavior
- Use **component CSS files** for highly customized POS skins (gradients, pastel themes, control states)
- Keep global design tokens in `styles/tokens.css`

This avoids dumping all styles in one file and keeps component-level ownership clear.

### If you do not want Tailwind now

Use plain CSS modules + global tokens first, and add Tailwind in a later cleanup. The architecture above still applies.

---

## Refactor plan from current code

### Phase 1 (safe split, no UX change)

1. Create `pages/POSScreen.tsx` and move existing JSX there
2. Extract `LeftPanel`, `RightPanel`, `BottomShortcutBar`
3. Move all current CSS into `styles/app.css` + section files

### Phase 2 (state cleanup)

1. Move logic from `App.tsx` into `store/posStore.ts`
2. Keep `App.tsx` as shell wrapper only
3. Keep browser preview fallback in one adapter/helper

### Phase 3 (visual polish with pastel system)

1. Introduce tokens in `styles/tokens.css`
2. Replace hardcoded colors with semantic variables
3. Standardize `PosButton` variants (`danger`, `warning`, `neutral`, `success`)

---

## MVP component list (must build first)

- `TicketControls`
- `TicketTable`
- `TicketActions`
- `TotalsCard`
- `CategoryTabs`
- `ProductPad`
- `PaymentMethods`
- `PlaceOrderButton`
- `BottomShortcutBar`

No extra analytics, reservations, table management, or advanced workflows in this phase.

---

## Definition of Done (UI)

- Layout matches PC America panel structure
- Styling reflects modern pastel reference direction
- All touch actions are comfortably clickable on touchscreen
- No business logic left in large monolithic `App.tsx`
- Each component has local style ownership and shared token usage
- Lint and typecheck pass
