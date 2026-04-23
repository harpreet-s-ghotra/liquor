# Design System: The Tactical Monolith

> Visual specification and layout rules for the High Spirits POS interface.
> For CSS implementation details (BEM, tokens, component rules), see [CLAUDE.md](../CLAUDE.md#styling-conventions).

---

## 1. Creative North Star

This design system reimagines the high-utility environment of legacy Point-of-Sale software through a lens of premium, industrial precision. We are moving away from the cluttered "gray-box" era of PC America and toward a "Tactical Monolith" -- an interface that feels as heavy and reliable as a physical steel register, yet as fluid as a modern editorial layout.

The system prioritizes **unapologetic hierarchy**. By utilizing intentional asymmetry and massive typographic contrasts, we ensure that a cashier's eye is drawn exactly where it needs to be: the total, the active line item, and the primary action. We break the "template" look by treating the UI as a series of heavy, interlocking slabs rather than a flat grid of buttons.

---

## 2. Layout Structure

The POS screen follows a fixed two-panel + bottom-strip layout inspired by PC America:

### Left Panel (Primary -- Transaction)

- Search + quantity controls (top)
- Current ticket / line items table (middle)
- Line action buttons (bottom)

### Right Panel (Secondary -- Actions)

- Totals summary (top)
- Category selector row
- Product quick-add grid
- Payment method row + primary Pay action

### Bottom Strip

- Function-key style shortcuts styled as a dark "keyboard tray"

### UX Constraints

- Large touch targets: minimum 56px for action buttons, 64-80px for primary pay actions
- `Favorites` is the default category on open (not `All`)
- Latest added/updated cart line is auto-selected so Delete targets the most recent item
- No animations or transitions -- the app must feel instant
- No emojis in UI

---

## 3. Colors

The palette is rooted in industrial grays and high-visibility status tokens. Color is used as a functional language, not decoration.

### Surface Hierarchy

- **The "No-Line" Rule:** No 1px solid borders for sectioning panels. Boundaries are established through tonal shifts.
- **Layering Logic:**
  - Main Background: `surface` (#f7fafc)
  - Side Panels: `surface-container-low` (#f1f4f6)
  - Active Interaction Areas: `surface-container-highest` (#e0e3e5) for "inset" tactile focus

### Status Tokens

- **Primary (Success/Total):** `primary` (#004b0f) -- "PAY" and grand totals
- **Secondary (Function/Options):** `secondary` (#005db7) -- navigation and lookup
- **Tertiary (Critical/Delete):** `tertiary` (#86000d) -- voids and cancellations
- **Customer/Context:** `secondary-fixed` (#d6e3ff)

### Color Semantics

- Destructive = red/pink
- Warning/void = amber
- Positive/pay = green
- Neutral actions = cool gray/blue

### Gradients and Glass

- Subtle vertical gradients on primary buttons: `primary` (#004b0f) to `primary-container` (#10651d)
- Floating modals: Glassmorphism (backdrop-blur: 12px) over `surface-variant` at 80% opacity

---

## 4. Typography

Strategy: "Read-from-the-Aisle." **Work Sans** for geometric, authoritative weight in displays; **Inter** for extreme legibility in data-heavy tables.

- **Grand Total:** `display-lg` (3.5rem) -- the "Hero" of the screen
- **Action Headlines:** `headline-lg` for button labels
- **Line Items:** `body-lg` with bold weight for "Price" column
- **Functional Labels:** `label-md` in all-caps with 0.05rem letter spacing for metadata (TAX, SUB-TOTAL, CASHIER ID)

---

## 5. Elevation and Depth

We reject traditional drop shadows in favor of **Tonal Layering**.

- **Layering:** `surface-container-lowest` (#ffffff) on `surface-dim` (#d7dadc) creates architectural lift
- **Ambient Shadows:** Floating elements use 40px blur at 6% opacity, tinted with `on-surface` (#181c1e)
- **Ghost Border:** If required for accessibility, use `outline-variant` (#c2c7ca) at 20% opacity -- never 100% opaque
- **Tactile Insets:** Inputs and search bars use slightly darker background than parent container

---

## 6. Components

### Modal Header (AppModalHeader)

Every dialog in the app shares the same toolbar strip via `AppModalHeader` from `src/renderer/src/components/common/AppModalHeader.tsx`.

- Strip: `#2d3133` (matches the F-key bar), full-bleed top edge, padding `1rem 1.5rem`
- Icon tile: 36px square, `#1a3a5c` background, rounded 8px, 18px blue stroke icon (`#60a5fa`) from `modal-icons.tsx`
- Breadcrumb: uppercase label (tracked 2px, `#94a3b8`) + slash separator + mixed-case title (`#e8ecf0`)
- Close button: pill on right (`rgba(255,255,255,0.08)` + `rgba(255,255,255,0.12)` border), label defaults to `Close`, `aria-label` is `${label} ${title}` so tests can target it unambiguously
- ESC closes every modal — Radix Dialog handles this by default; modals that use a non-Radix overlay (`PaymentModal`) wire their own `keydown` listener
- Optional `actions` slot renders between breadcrumb and Close for per-modal extras (e.g. `Clear All` on the Hold Lookup)
- Layout contract: the header is always the first child of `DialogContent`. A `:has()` rule in `app-modal-header.css` removes `dialog__content` padding and clips corners automatically so the strip hugs the modal edges.

Icons are monochrome SVGs (18px, stroke `#60a5fa`, width 2.5, round caps). Every modal picks its own icon from `modal-icons.tsx` — do not reuse the Manager icon for another surface.

### Modal Tabs (AppModalTabs)

Modals that host tabbed content share the Manager pattern via the `.app-modal-tabs*` class set in `app-modal-header.css`:

- `.app-modal-tabs` — flex column on the Radix `Tabs` root
- `.app-modal-tabs__bar` — dark `#2d3133` strip wrapping the `TabsList`
- `.app-modal-tabs__list` — full-width horizontal list with subtle bottom border
- `.app-modal-tabs__trigger` — uppercase, 3px transparent bottom border; active state uses the `#60a5fa` underline (no button-look background or shadow)
- `.app-modal-tabs__content` — scrolling body with `1rem 1.5rem` gutter

Specificity is reinforced with descendant selectors (`.app-modal-tabs .tabs__list`) so the shared rules beat the base `ui/tabs.css` styles regardless of bundle import order. When adopting, add `app-modal-tabs` to the `<Tabs>` className and wrap `<TabsList>` in a `<div className="app-modal-tabs__bar">`.

### Modal Body Guidelines

- `DialogContent` for a modal hosting `AppModalHeader` must set `padding: 0; overflow: hidden`. The toolbar strip owns the top edge; the body owns everything below it.
- Prefer `.app-modal__body` (flex: 1, `1rem 1.5rem` gutter, auto scroll) for a single-column scrolling body. Pair with `--grid` modifier when the body is a grid.
- For modals with a filter / date bar between the header and the body, use `.app-modal__sub-bar` so every modal's sub-toolbar has the same `bg-surface` strip, border, and gutter.

### Header Bar

Pure utility bar -- no product title.

- Height: 64px
- Background: `surface` (#f8fafc) with 2px bottom border in `outline` (#e2e8f0)
- Right side: Help icon, Settings icon (36px touch targets), Admin/Cashier badge pill

### Bottom F-Key Bar

Dark "keyboard tray" grounding the interface.

- Height: 56px
- Background: `inverse-surface-dark` (#0f172a)
- Button style: `#1e293b` background with 2px bottom border `#475569` (tactile "key press")
- Corner radius: 2px (sharp -- "keys", not "buttons")
- F-key badge: `#334155` background, Work Sans Black 10px white
- Label: Work Sans Bold 10px uppercase, tracking 1px, color `#cbd5e1`
- EXIT POS: Far right, `tertiary` (#86000d) background

### Primary Action Button ("Mega-Button")

- Min height: 3.5rem
- Solid `primary` background, `headline-sm` centered text
- Corner radius: 0.5rem

### The Ledger (Line Item Table)

- Container: White card, rounded 8px, subtle shadow, ghost border at 10%
- Header: `surface-container` background, Work Sans Black 10px uppercase, tracking 2px, 12-column grid
- Regular rows: 12-column grid, Work Sans Bold 16px uppercase item name, Inter Medium 12px SKU
- Active row: `primary-fixed` (#a3f69c) background, Extra Bold 18px name, Black 20px qty/price
- Zebra: Odd `#ffffff`, Even `#f1f4f6`, Active overrides zebra
- Footer: `surface-container-highest` input area, action buttons 96px wide (Delete red, Discount orange, Qty blue, Price light blue)

### Payment Method Buttons

- Cash/Credit: `secondary-fixed-dim` (#a9c7ff) background, Work Sans Black 14px uppercase
- Debit/Account: `secondary-fixed` (#d6e3ff) background
- Corner radius: 8px, min-height 70px

### Numeric Keypad

- 3x4 grid, `surface-container-high` buttons
- On-press: shift to `surface-dim`
- Large `headline-lg` numerals centered

### Total Block

- Background: `inverse-surface` (#2d3133)
- Total amount: `primary-fixed` (#a3f69c)
- Row separators: ghost borders `rgba(194,199,202,0.2)`
- Labels: Work Sans Bold 12px uppercase, `outline` (#c2c7ca)
- Values: Work Sans Bold 24px, `surface-container-lowest` (#eef1f3)
- Total label: Work Sans Black 30px, `primary-fixed-dim` (#8ee088)
- Total value: Work Sans Black 48px, `primary-fixed` (#a3f69c)

---

## 7. Do's and Don'ts

### Do

- Use whitespace (`spacing-10` or higher) to separate panels
- Use bold, high-contrast colors for different functional zones
- Ensure all touch targets are at least 48px square
- Color-code category tabs and product cards by category using pastel tones

### Don't

- Use thin icons -- use "bold" or "filled" weights to match chunky typography
- Use 1px dividers for line items -- use tonal shift instead
- Use standard "Select" dropdowns -- use flat visible lists or modal grids
- Use pure black (#000000) -- use `on-surface` (#181c1e) for "Industrial" feel
