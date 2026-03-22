# Startup

**Spec file:** `tests/e2e/startup.spec.ts`
**Suite:** `Startup`

Tests that the POS screen renders correctly on first load after login.

**Mock data:** 15 products across 5 categories (Wine, Beer, Spirits, Coolers, Mixers)

---

## 1. Startup panels are visible and favorites is default

Verifies the core layout renders and the category dropdown defaults to "Favorites".

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in with PIN 1234 | POS screen loads |
| 2 | -- | Ticket panel is visible |
| 3 | -- | Action panel is visible |
| 4 | -- | Bottom shortcut bar is visible |
| 5 | -- | Category dropdown shows "Favorites" |
| 6 | -- | Product grid shows 3 items (favorites only) |

---

## 2. Payment buttons are disabled on startup

Verifies payment actions are not available when the cart is empty.

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in with PIN 1234 | POS screen loads |
| 2 | -- | Cash button is disabled |
| 3 | -- | Credit button is disabled |
| 4 | -- | Debit button is disabled |
| 5 | -- | Pay Now button is disabled |

---

## 3. Latest added item is selected, and clicking another item selects it

Verifies selection behavior in the ticket panel.

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, switch category to "All" | 15 products visible |
| 2 | Click first product | First item is active in ticket |
| 3 | Click second product | Second item is now active |
| 4 | Click first ticket line | First item is active again |

---

## 4. Cart section is scrollable and auto-scrolls to latest added item

Verifies the ticket panel scrolls when many items are added.

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in, switch category to "All" | 15 products visible |
| 2 | Click 12 products sequentially | 12 items in cart |
| 3 | -- | Ticket container has `overflow-y: auto` or `scroll` |
| 4 | -- | Last added item is the active line |
| 5 | -- | Container `scrollTop > 0` (scrolled down) |
