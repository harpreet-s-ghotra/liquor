# Design System Documentation: The Industrial Command Center

## 1. Overview & Creative North Star

### Creative North Star: "The Tactical Monolith"

This design system reimagines the high-utility environment of legacy Point-of-Sale software through a lens of premium, industrial precision. We are moving away from the cluttered "gray-box" era of PC America and toward a "Tactical Monolith"—an interface that feels as heavy and reliable as a physical steel register, yet as fluid as a modern editorial layout.

The system prioritizes **unapologetic hierarchy**. By utilizing intentional asymmetry and massive typographic contrasts, we ensure that a cashier’s eye is drawn exactly where it needs to be: the total, the active line item, and the primary action. We break the "template" look by treating the UI as a series of heavy, interlocking slabs rather than a flat grid of buttons.

---

## 2. Colors

The palette is rooted in industrial grays and high-visibility status tokens. We use color not as decoration, but as a functional language.

### Surface Hierarchy & Nesting

- **The "No-Line" Rule:** Explicitly prohibit the use of 1px solid borders for sectioning panels. Boundaries must be established through tonal shifts. For example, the transaction list sits on `surface-container-lowest` while the surrounding workspace uses `surface-container`.
- **Layering Logic:**
  - **Main Background:** `surface` (#f7fafc)
  - **Side Panels:** `surface-container-low` (#f1f4f6)
  - **Active Interaction Areas (Keypad/Line Items):** `surface-container-highest` (#e0e3e5) to create a sense of "inset" tactile focus.

### Status Tokens

- **Primary (Success/Total):** `primary` (#004b0f) used for "PAY" and grand totals.
- **Secondary (Function/Options):** `secondary` (#005db7) for navigational options and TS lookup.
- **Tertiary (Critical/Delete):** `tertiary` (#86000d) for voids and cancellations.
- **Customer/Context:** `secondary-fixed` (#d6e3ff) for orange-toned info panels (interpreted here through professional blue/orange contrasts for higher legibility).

### The "Glass & Gradient" Rule

To elevate the "industrial" feel, use subtle vertical gradients on primary buttons, transitioning from `primary` (#004b0f) to `primary-container` (#10651d). Floating modals or quick-info overlays should utilize Glassmorphism (backdrop-blur: 12px) over `surface-variant` with 80% opacity to maintain context without visual noise.

---

## 3. Typography

The typography strategy is "Read-from-the-Aisle." We use **Work Sans** for its geometric, authoritative weight in displays and **Inter** for its extreme legibility in data-heavy tables.

- **The Total (Grand Scale):** Use `display-lg` (3.5rem) for the Grand Total. This is the "Hero" of the screen.
- **Action Headlines:** Use `headline-lg` for button labels. This ensures that even under fluorescent lighting or at a distance, the action is unmistakable.
- **The Ledger:** Use `body-lg` for line items. Use a bold weight for the "Price" column to differentiate it from "Quantity."
- **Functional Labels:** Use `label-md` in all-caps with 0.05rem letter spacing for secondary metadata (e.g., TAX, SUB-TOTAL, CASHIER ID).

---

## 4. Elevation & Depth

We reject traditional drop shadows in favor of **Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card (#ffffff) placed on a `surface-dim` background (#d7dadc) creates a natural lift that feels architectural rather than digital.
- **Ambient Shadows:** For floating elements like a "Quick Find" modal, use a shadow with a 40px blur at 6% opacity, tinted with `on-surface` (#181c1e).
- **The Ghost Border:** If a line is required for accessibility in high-glare environments, use `outline-variant` (#c2c7ca) at 20% opacity. Never use a 100% opaque black or gray border.
- **Tactile Insets:** Numerical inputs and search bars should feel "recessed" by using a slightly darker `surface-container-highest` background than their parent container.

---

## 5. Components

### Header Bar (Top App Bar)

The header provides system context and quick-access controls. It does **not** contain a product title — it is a pure utility bar.

- **Height:** 64px.
- **Background:** `surface` (#f8fafc) with a 2px bottom border in `outline` (#e2e8f0).
- **Left side:** Empty (reserved for future branding if needed).
- **Right side (in order):**
  1.  **Help icon** — circle-help (Lucide `CircleHelp`), 20px, `on-surface` (#181c1e).
  2.  **Settings icon** — gear (Lucide `Settings`), 20px, `on-surface` (#181c1e). Both icons wrapped in 36px touch targets with 8px padding.
  3.  **Admin / Cashier badge** — A pill displaying the current user role and station. Background: `surface-container-highest` (#e5e9eb). Border: ghost `outline-variant` at 20% opacity. Rounded `4px`. Inner text: Work Sans Bold, 12px, uppercase, tracking 1.2px, color `on-surface-variant` (#42474a). Format: `"ADMIN: STATION 01"` or `"CASHIER: {name}"`. This badge is the primary visual cue to differentiate admin windows from cashier windows.

### Bottom F-Key Bar

Replaces the current light shortcut bar. Styled as a dark "keyboard tray" to ground the interface.

- **Height:** 56px.
- **Background:** `inverse-surface-dark` (#0f172a) — a deep navy, darker than `--bg-shell`.
- **Button style:**
  - Background: `#1e293b` with a 2px bottom border `#475569` (tactile "key press" effect).
  - Rounded: `2px` (intentionally sharp — these are "keys", not "buttons").
  - Inner layout: F-key badge + label, horizontal, gap 8px.
- **F-key badge:** Background `#334155`, rounded `2px`, px 4px. Text: Work Sans Black, 10px, white, centered.
- **Label:** Work Sans Bold, 10px, uppercase, tracking 1px, color `#cbd5e1`.
- **Keys (left to right):** F1 Help, F2 Inventory, F3 Clock In/Out, F4 Customers, F5 Reports, F6 Manager.
- **EXIT POS button:** Far right, isolated. Background: `tertiary` (#86000d). Same key styling but red. Label: "EXIT POS" in white.

### The "Mega-Button" (Primary Action)

- **Dimensions:** Minimum height of `16` (3.5rem) for touch-friendliness.
- **Styling:** Solid `primary` background. Top-left icon from the `on-primary` set.
- **Typography:** `headline-sm` centered.
- **Corner Radius:** `lg` (0.5rem) to balance the "chunky" aesthetic with modern softening.

### The Ledger (Line Item Table)

The ledger is the cashier's primary workspace. It follows the Figma reference exactly.

- **Container:** White card (`surface-container-lowest` #ffffff), rounded `8px`, subtle shadow `0 1px 2px rgba(0,0,0,0.05)`, ghost border at 10% opacity.
- **Table Header:** Background `surface-container` (#ebeef0). Work Sans Black, 10px, uppercase, tracking 2px, color `on-surface-variant` (#42474a). 12-column grid: col 1 = #, col 2-7 = Item Description, col 8-9 = Qty (right-aligned), col 10-12 = Price (right-aligned). Vertical padding 12px, horizontal padding 24px.
- **Line Items (regular):** 12-column grid matching header. Vertical padding 16px top + 17px bottom, horizontal padding 24px. Item name: Work Sans Bold, 16px, uppercase, color `on-surface` (#181c1e). SKU line: Inter Medium, 12px, color `on-surface-variant` (#42474a), shown below item name. Qty: Work Sans Bold, 18px, right-aligned. Price: Work Sans Bold, 18px, right-aligned.
- **Active Line Item:** Background `primary-fixed` (#a3f69c) with ghost bottom border `rgba(0,75,15,0.1)`. All text shifts to `on-primary-fixed-variant` (#002204). Item name: Work Sans Extra Bold, 18px, uppercase. Qty/Price: Work Sans Black, 20px.
- **Zebra Striping:** Odd rows: `surface-container-lowest` (#ffffff). Even rows: `surface-container-low` (#f1f4f6). Active row overrides zebra with `primary-fixed`.
- **Footer Row (below ledger):** Contains the barcode/SKU input and action buttons. Background: `surface-container-highest` (#e0e3e5) for the input area (recessed tactile feel). Action buttons: vertical layout with icon on top + uppercase label below, each 96px wide, full height (~112px). Colors: Delete `#86000d` (red), Discount `#ea580c` (orange), Qty Change `#005db7` (blue), Price Change `#64a1ff` (light blue, dark text `#003670`).

### Payment Method Buttons

Payment buttons live at the bottom of the right-side action panel. They keep their current grid position but adopt Figma's styling.

- **Cash / Credit (primary row):** Background `secondary-fixed-dim` (#a9c7ff). Text `on-secondary-fixed` (#001b3d). Include a left-aligned Lucide icon (Cash: `Banknote`, Credit: `CreditCard`). Work Sans Black, 14px, uppercase.
- **Debit / Account (secondary row):** Background `secondary-fixed` (#d6e3ff). Same text color and typography. Icons: Debit: `Wallet`, Account: `UserCircle`.
- **Corner radius:** `8px` (`lg`).
- **Layout:** Icon + label left-aligned with 12px gap, vertically centered. Min-height 70px for comfortable touch targets.

### Numeric Keypad

- **Grid:** 3x4 grid using `surface-container-high` buttons.
- **Feedback:** On-press, shift to `surface-dim`.
- **Contrast:** Large `headline-lg` numerals centered.

### The Total Block

- **Aesthetic:** This is a high-contrast zone. Background: `inverse-surface` (#2d3133). Text: `primary-fixed` (#a3f69c) for the dollar amount.
- **Layout:** Align "Total" label to the left and "Amount" to the right using `display-md` typography.
- **Row separators:** Ghost borders `rgba(194,199,202,0.2)` between Sub Total, Tax, Discount, and Total rows.
- **Labels:** Work Sans Bold, 12px, uppercase, color `outline` (#c2c7ca).
- **Values:** Work Sans Bold, 24px, color `surface-container-lowest` (#eef1f3).
- **Total label:** Work Sans Black, 30px, color `primary-fixed-dim` (#8ee088), uppercase, tracking -1.5px.
- **Total value:** Work Sans Black, 48px, color `primary-fixed` (#a3f69c).

---

## 6. Do's and Don'ts

### Do

- **DO** use whitespace (`spacing-10` or higher) to separate the "Basket" from the "Payment" panel.
- **DO** use bold, high-contrast colors for different functional zones (e.g., all delete functions are `tertiary`).
- **DO** ensure all touch targets are at least 48px square, following the `spacing-12` scale.

### Don't

- **DON'T** use thin icons. Use "bold" or "filled" icon weights to match the chunky typography.
- **DON'T** use 1px dividers to separate line items; use the `0.2rem` (spacing-1) tonal shift instead.
- **DON'T** use standard "Select" dropdowns. In a POS environment, everything should be a flat, visible list or a modal grid.
- **DON'T** use pure black (#000000). Use `on-surface` (#181c1e) to keep the "Industrial" rather than "Basic" feel.
