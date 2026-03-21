# Pricing Engine — Special Pricing Fix & Mix-and-Match

## Problem

The POS system saves special pricing rules per product (`special_pricing` table) but **never applies them in the cart**. The `Product` type used by the POS store omits pricing fields, and `deriveCartTotals()` has no promotional pricing logic.

Additionally, the merchant needs a "Mix & Match" feature — cross-item group deals (e.g., "any 2 items from this group for $9.99 each").

Both features require a unified **Pricing Engine** so the cart correctly applies, stacks, and displays all promotions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Cart (Zustand store)               │
│  CartItem[] — raw items with lineQuantity & price    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Pricing Engine (pure function)           │
│                                                      │
│  Inputs:                                             │
│    • cart: CartItem[]                                │
│    • specialPricingMap: Map<productId, rules[]>      │
│    • mixMatchGroups: MixMatchGroup[]                 │
│                                                      │
│  Outputs:                                            │
│    • annotated CartLineItem[] with promo metadata    │
│    • totalSavings breakdown                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           TicketPanel (cart display)                  │
│  Renders promo badges, grouped items, savings        │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Promotions are computed at derivation time** — not baked into cart item prices. This keeps manual price overrides, item discounts, and promo discounts orthogonal.
2. **Pricing rules are loaded once at app start** and refreshed when inventory changes.
3. **Best deal wins** — if an item qualifies for both special pricing and mix-and-match, the engine applies whichever gives the greater discount. They do not stack.
4. **Manual price overrides take priority** — if a cashier manually changes an item's price, no promo is applied to that line (the cashier knows best).

---

## Phase 1: Fix Special Pricing (Per-Item Quantity Discounts)

### What exists today

| Layer                            | State                                                     |
| -------------------------------- | --------------------------------------------------------- |
| DB table `special_pricing`       | ✅ Has `product_id`, `quantity`, `price`, `duration_days` |
| DB table `products`              | ✅ Has `special_pricing_enabled`, `special_price` columns |
| Inventory Form (ItemForm.tsx)    | ✅ Allows adding/editing rules                            |
| Shared type `SpecialPricingRule` | ✅ `{ quantity, price, duration_days }`                   |
| `getProducts()` query            | ❌ Does NOT load special pricing data                     |
| `Product` type                   | ❌ Does NOT include special pricing fields                |
| `deriveCartTotals()`             | ❌ No promo logic                                         |
| TicketPanel rendering            | ❌ No promo display                                       |

### Data Flow Changes

#### 1. New IPC endpoint: `getActiveSpecialPricing()`

Returns all currently active special pricing rules (where `created_at + duration_days >= now`), keyed by product ID.

```typescript
// New shared type
type ActiveSpecialPricingRule = {
  product_id: number
  quantity: number // quantity threshold (buy X or more)
  price: number // per-unit price when threshold met
}

// IPC: returns Map-friendly array grouped by product_id
type SpecialPricingMap = Map<number, ActiveSpecialPricingRule[]>
```

**Why a separate endpoint?** Keeps `getProducts()` lean (it's called often for search). Special pricing is loaded once and cached in the POS store.

#### 2. Extend POS Store (`usePosScreen.ts`)

```typescript
// New state fields
specialPricingMap: Map<number, ActiveSpecialPricingRule[]>

// New action
loadSpecialPricing: () => void   // called on mount & after inventory changes
```

#### 3. Annotated Cart Lines

Extend the `CartItem` type or create a wrapper:

```typescript
// Promotion metadata attached to each line during derivation
type PromoAnnotation = {
  promoType: 'special-pricing' | 'mix-match'
  promoLabel: string // e.g., "Buy 3+ @ $8.99 each"
  promoUnitPrice: number // the discounted per-unit price
  promoLineSavings: number // (original - promo) × quantity
  mixMatchGroupId?: number // for visual grouping (Phase 2)
  mixMatchGroupName?: string // for display (Phase 2)
}
```

#### 4. Pricing Engine: `applyPromotions()`

Pure function (no hooks, fully testable):

```typescript
function applyPromotions(
  cart: CartItem[],
  specialPricingMap: Map<number, ActiveSpecialPricingRule[]>,
  mixMatchGroups: MixMatchGroup[] // empty [] for Phase 1
): { lines: AnnotatedCartLine[]; promoSavings: number }
```

**Special pricing logic per cart line:**

```
for each cartItem:
  if cartItem has manual price override (price !== basePrice) → skip
  if cartItem has item discount (itemDiscountPercent > 0) → skip

  rules = specialPricingMap.get(cartItem.id) ?? []

  // Find the best qualifying rule (highest quantity threshold the cart meets)
  bestRule = rules
    .filter(rule => cartItem.lineQuantity >= rule.quantity)
    .sort((a, b) => a.price - b.price)   // lowest price = best deal
    [0]

  if bestRule:
    savings = (cartItem.price - bestRule.price) × cartItem.lineQuantity
    annotate line with { promoType: 'special-pricing', promoUnitPrice: bestRule.price, ... }
```

#### 5. TicketPanel UI Changes

When a cart line has a promo annotation, render additional info below the item name:

```
┌──────────────────────────────────────────────────────────┐
│ #1   Crown Royal 750ml           3        $26.97         │
│      🏷️ Buy 3+ @ $8.99 each — Save $12.00               │
│         (was $12.99 each)                                │
└──────────────────────────────────────────────────────────┘
```

**Visual treatment:**

- Same peach/orange gradient used for item discounts (`--accent-peach`)
- Badge with promo label
- Strikethrough on original price
- Savings amount displayed prominently

#### 6. Totals Section

The existing `totalSavings` already shows in the totals area. Promo savings will feed into this same number. No new UI needed for totals.

### Files to Change (Phase 1)

| File                                                 | Change                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `src/shared/types/index.ts`                          | Add `ActiveSpecialPricingRule`, `PromoAnnotation` types       |
| `src/main/database/products.repo.ts`                 | Add `getActiveSpecialPricing()` function                      |
| `src/main/index.ts`                                  | Register new IPC handler                                      |
| `src/preload/index.ts` + `index.d.ts`                | Expose `getActiveSpecialPricing` to renderer                  |
| `src/renderer/src/store/usePosScreen.ts`             | Add pricing map state, call `applyPromotions()` in derivation |
| `src/renderer/src/utils/pricing-engine.ts`           | **New file** — pure `applyPromotions()` function              |
| `src/renderer/src/components/ticket/TicketPanel.tsx` | Render promo annotations on cart lines                        |
| `src/renderer/src/types/pos.ts`                      | Add `AnnotatedCartLine` renderer type                         |

### Test Plan (Phase 1)

| Test                     | Scope                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `pricing-engine.test.ts` | Unit: `applyPromotions()` with various cart/rule combos       |
|                          | - No rules → no annotations                                   |
|                          | - Quantity below threshold → no discount                      |
|                          | - Quantity meets threshold → discount applied                 |
|                          | - Multiple rules → best deal selected                         |
|                          | - Manual price override → promo skipped                       |
|                          | - Item discount already applied → promo skipped               |
| `usePosScreen.test.ts`   | Unit: store loads pricing, cart totals include promo savings  |
| `TicketPanel.test.tsx`   | Unit: promo badge renders when annotation present             |
| E2E                      | Verify promo appears in cart after adding qualifying quantity |

---

## Phase 2: Mix-and-Match Pricing

### Data Model

```sql
-- A mix-and-match deal group
CREATE TABLE IF NOT EXISTS mix_match_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,               -- "Wine & Cheese Combo", "Beer 6-Pack Deal"
  required_qty INTEGER NOT NULL,    -- How many items needed to trigger the deal
  deal_price REAL NOT NULL,         -- Per-item price when deal is active
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products belonging to a mix-and-match group
CREATE TABLE IF NOT EXISTS mix_match_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  UNIQUE(group_id, product_id),
  FOREIGN KEY (group_id) REFERENCES mix_match_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### Shared Types

```typescript
type MixMatchGroup = {
  id: number
  name: string
  required_qty: number // e.g., 2
  deal_price: number // e.g., 9.99 per item
  is_active: boolean
  items: MixMatchGroupItem[]
}

type MixMatchGroupItem = {
  product_id: number
  product_name: string
  retail_price: number // for showing the "was" price
}
```

### Pricing Engine Extension

```
for each mixMatchGroup:
  eligibleCartItems = cart.filter(item => group.items.includes(item.id))

  totalEligibleQty = sum of eligibleCartItems.lineQuantity

  // How many complete "sets" can we fill?
  completeSets = floor(totalEligibleQty / group.required_qty)
  discountedUnits = completeSets × group.required_qty

  // Distribute discounted units across items (greedy: most expensive first)
  sortedItems = eligibleCartItems.sort(by price DESC)
  remaining = discountedUnits

  for each item in sortedItems:
    unitsToDiscount = min(item.lineQuantity, remaining)
    annotate item with mix-match promo for unitsToDiscount
    remaining -= unitsToDiscount
```

**Conflict resolution:** If an item qualifies for both a special pricing rule AND a mix-match group, compare the savings and apply whichever is better for the customer.

### Cart Display (Mix & Match)

When a mix-and-match deal is active, items are visually grouped in the ticket:

```
┌─ 🔗 Wine & Cheese Combo ────────────────────────────────┐
│ #1   Cabernet Sauvignon 750ml     1        $9.99         │
│      🏷️ Mix & Match — Save $5.00 (was $14.99)            │
│                                                          │
│ #2   Aged Gouda Wheel             1        $9.99         │
│      🏷️ Mix & Match — Save $2.00 (was $11.99)            │
├──────────────────────────────────────────────────────────┤
│      Combo Savings: $7.00                                │
└──────────────────────────────────────────────────────────┘
```

**Visual treatment:**

- Left border accent (e.g., `--accent-lavender` or a distinct color from item discounts)
- Group header bar with deal name
- Items within the group are indented/bordered together
- Per-item savings shown
- Group total savings shown at the group footer

**Partial match display:** If only 1 of 2 required items is in the cart, show a subtle hint:

```
│ #3   Merlot 750ml                 1        $12.99        │
│      🔗 Add 1 more for Wine & Cheese Combo ($9.99 each)  │
```

This nudge helps the merchant complete deals for customers.

### Inventory Management Tab

New **"Mix & Match"** tab in the Inventory Management popup, following the same unified layout as Departments/Tax Codes/Vendors:

```
┌──────────────────────────────────────────────────────┐
│ Section 1: Create New Group                          │
│ [Group Name]  [Required Qty]  [Deal Price]  [Add]    │
├──────────────────────────────────────────────────────┤
│ Section 2: Scrollable Group List                     │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Name              │ Qty │ Price │ Items │ Active │ │
│ │ Wine & Cheese     │  2  │ $9.99 │   4   │  ✓    │ │
│ │ Beer 6-Pack Deal  │  6  │ $7.49 │  12   │  ✓    │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ Section 3: Edit Selected Group                       │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Editing: Wine & Cheese Combo     [Save] [Delete] │ │
│ │                                                  │ │
│ │ [Group Name_______]  [Required Qty]  [Deal Price]│ │
│ │                                                  │ │
│ │ Items in Group:                                  │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ Cabernet Sauvignon 750ml  ($14.99)  [Remove] │ │ │
│ │ │ Aged Gouda Wheel          ($11.99)  [Remove] │ │ │
│ │ │ Merlot 750ml              ($12.99)  [Remove] │ │ │
│ │ │ Brie Wheel                ($8.99)   [Remove] │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ │                                                  │ │
│ │ [Search to add item...________________] [Add]    │ │
│ │  > Chardonnay 750ml ($13.99)                     │ │
│ │  > Pinot Noir 750ml ($15.99)                     │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ Section 4: Search Groups                             │
│ [Search ________________________________]            │
└──────────────────────────────────────────────────────┘
```

The item search in the edit section uses the existing product search backend. Typing filters products in a dropdown, clicking adds the product to the group.

### Files to Add/Change (Phase 2)

| File                                                                | Change                                              |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| `src/main/database/schema.ts`                                       | Add `mix_match_groups` and `mix_match_items` tables |
| `src/main/database/mix-match.repo.ts`                               | **New** — CRUD for groups & items                   |
| `src/main/index.ts`                                                 | Register mix-match IPC handlers                     |
| `src/preload/index.ts` + `index.d.ts`                               | Expose mix-match APIs                               |
| `src/shared/types/index.ts`                                         | Add `MixMatchGroup`, `MixMatchGroupItem` types      |
| `src/renderer/src/utils/pricing-engine.ts`                          | Extend `applyPromotions()` with mix-match logic     |
| `src/renderer/src/components/inventory/mix-match/MixMatchPanel.tsx` | **New** — management panel                          |
| `src/renderer/src/components/inventory/InventoryModal.tsx`          | Add Mix & Match tab                                 |
| `src/renderer/src/components/ticket/TicketPanel.tsx`                | Render mix-match groups with visual grouping        |
| `src/renderer/src/store/usePosScreen.ts`                            | Load mix-match groups, pass to pricing engine       |

### Test Plan (Phase 2)

| Test                     | Scope                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `pricing-engine.test.ts` | Unit: mix-match scenarios — partial groups, full groups, multi-set, conflict with special pricing |
| `MixMatchPanel.test.tsx` | Unit: Create group, add/remove items, edit, delete                                                |
| `TicketPanel.test.tsx`   | Unit: mix-match visual grouping, partial hint display                                             |
| E2E                      | Full flow: create group → add items → POS cart reflects deal                                      |

---

## Implementation Order

| Step   | Description                                                                | Dependency |
| ------ | -------------------------------------------------------------------------- | ---------- |
| **1a** | Create `pricing-engine.ts` with `applyPromotions()` — special pricing only | None       |
| **1b** | Add `getActiveSpecialPricing()` backend + IPC                              | None       |
| **1c** | Wire pricing map into POS store, call engine in `deriveCartTotals()`       | 1a + 1b    |
| **1d** | Update TicketPanel to render promo annotations                             | 1c         |
| **1e** | Tests for Phase 1                                                          | 1a–1d      |
| **2a** | DB schema + repo for mix-match groups                                      | None       |
| **2b** | Mix & Match management panel (inventory tab)                               | 2a         |
| **2c** | Extend pricing engine with mix-match logic                                 | 1a + 2a    |
| **2d** | TicketPanel visual grouping for mix-match                                  | 2c         |
| **2e** | Partial match hints in cart                                                | 2d         |
| **2f** | Tests for Phase 2                                                          | 2a–2e      |

---

## Open Questions

1. **Stacking policy:** Current plan = best deal wins, no stacking. Should the merchant be able to override this per-group?
2. **Mix-match time limits:** Should mix-match groups have an expiration date like special pricing has `duration_days`?
3. **Receipt printing:** When receipts are implemented (Phase 4), promo savings should be itemized on the receipt. Noted for later.
4. **Reporting:** Should there be a report showing promo usage / savings given? Noted for later.
