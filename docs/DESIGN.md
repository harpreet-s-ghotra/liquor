# Design System Documentation: The Industrial Command Center

## 1. Overview & Creative North Star

### Creative North Star: "The Tactical Monolith"
This design system reimagines the high-utility environment of legacy Point-of-Sale software through a lens of premium, industrial precision. We are moving away from the cluttered "gray-box" era of PC America and toward a "Tactical Monolith"—an interface that feels as heavy and reliable as a physical steel register, yet as fluid as a modern editorial layout. 

The system prioritizes **unapologetic hierarchy**. By utilizing intentional asymmetry and massive typographic contrasts, we ensure that a cashier’s eye is drawn exactly where it needs to be: the total, the active line item, and the primary action. We break the "template" look by treating the UI as a series of heavy, interlocking slabs rather than a flat grid of buttons.

---

## 2. Colors

The palette is rooted in industrial grays and high-visibility status tokens. We use color not as decoration, but as a functional language.

### Surface Hierarchy & Nesting
*   **The "No-Line" Rule:** Explicitly prohibit the use of 1px solid borders for sectioning panels. Boundaries must be established through tonal shifts. For example, the transaction list sits on `surface-container-lowest` while the surrounding workspace uses `surface-container`.
*   **Layering Logic:** 
    *   **Main Background:** `surface` (#f7fafc)
    *   **Side Panels:** `surface-container-low` (#f1f4f6)
    *   **Active Interaction Areas (Keypad/Line Items):** `surface-container-highest` (#e0e3e5) to create a sense of "inset" tactile focus.

### Status Tokens
*   **Primary (Success/Total):** `primary` (#004b0f) used for "PAY" and grand totals.
*   **Secondary (Function/Options):** `secondary` (#005db7) for navigational options and TS lookup.
*   **Tertiary (Critical/Delete):** `tertiary` (#86000d) for voids and cancellations.
*   **Customer/Context:** `secondary-fixed` (#d6e3ff) for orange-toned info panels (interpreted here through professional blue/orange contrasts for higher legibility).

### The "Glass & Gradient" Rule
To elevate the "industrial" feel, use subtle vertical gradients on primary buttons, transitioning from `primary` (#004b0f) to `primary-container` (#10651d). Floating modals or quick-info overlays should utilize Glassmorphism (backdrop-blur: 12px) over `surface-variant` with 80% opacity to maintain context without visual noise.

---

## 3. Typography

The typography strategy is "Read-from-the-Aisle." We use **Work Sans** for its geometric, authoritative weight in displays and **Inter** for its extreme legibility in data-heavy tables.

*   **The Total (Grand Scale):** Use `display-lg` (3.5rem) for the Grand Total. This is the "Hero" of the screen.
*   **Action Headlines:** Use `headline-lg` for button labels. This ensures that even under fluorescent lighting or at a distance, the action is unmistakable.
*   **The Ledger:** Use `body-lg` for line items. Use a bold weight for the "Price" column to differentiate it from "Quantity."
*   **Functional Labels:** Use `label-md` in all-caps with 0.05rem letter spacing for secondary metadata (e.g., TAX, SUB-TOTAL, CASHIER ID).

---

## 4. Elevation & Depth

We reject traditional drop shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card (#ffffff) placed on a `surface-dim` background (#d7dadc) creates a natural lift that feels architectural rather than digital.
*   **Ambient Shadows:** For floating elements like a "Quick Find" modal, use a shadow with a 40px blur at 6% opacity, tinted with `on-surface` (#181c1e). 
*   **The Ghost Border:** If a line is required for accessibility in high-glare environments, use `outline-variant` (#c2c7ca) at 20% opacity. Never use a 100% opaque black or gray border.
*   **Tactile Insets:** Numerical inputs and search bars should feel "recessed" by using a slightly darker `surface-container-highest` background than their parent container.

---

## 5. Components

### The "Mega-Button" (Primary Action)
*   **Dimensions:** Minimum height of `16` (3.5rem) for touch-friendliness.
*   **Styling:** Solid `primary` background. Top-left icon from the `on-primary` set.
*   **Typography:** `headline-sm` centered.
*   **Corner Radius:** `lg` (0.5rem) to balance the "chunky" aesthetic with modern softening.

### The Ledger (Line Item Table)
*   **Spacing:** Vertical padding of `4` (0.9rem) between items.
*   **Interaction:** Active line item shifts to `primary-fixed` (#a3f69c) background with `on-primary-fixed` text.
*   **Separation:** No dividers. Use `surface-container-low` and `surface-container-lowest` in a zebra-stripe pattern for high-density readability.

### Numeric Keypad
*   **Grid:** 3x4 grid using `surface-container-high` buttons.
*   **Feedback:** On-press, shift to `surface-dim`.
*   **Contrast:** Large `headline-lg` numerals centered.

### The Total Block
*   **Aesthetic:** This is a high-contrast zone. Background: `inverse-surface` (#2d3133). Text: `primary-fixed` (#a3f69c) for the dollar amount.
*   **Layout:** Align "Total" label to the left and "Amount" to the right using `display-md` typography.

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace (`spacing-10` or higher) to separate the "Basket" from the "Payment" panel.
*   **DO** use bold, high-contrast colors for different functional zones (e.g., all delete functions are `tertiary`).
*   **DO** ensure all touch targets are at least 48px square, following the `spacing-12` scale.

### Don't
*   **DON'T** use thin icons. Use "bold" or "filled" icon weights to match the chunky typography.
*   **DON'T** use 1px dividers to separate line items; use the `0.2rem` (spacing-1) tonal shift instead.
*   **DON'T** use standard "Select" dropdowns. In a POS environment, everything should be a flat, visible list or a modal grid.
*   **DON'T** use pure black (#000000). Use `on-surface` (#181c1e) to keep the "Industrial" rather than "Basic" feel.