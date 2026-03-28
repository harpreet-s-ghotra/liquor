# E2E Test Coverage

Visual overview of all end-to-end test workflows in the LiquorPOS application.

Each file below documents one Playwright test spec. Every test is broken down into its preconditions, step-by-step workflow, and assertions so you can see exactly what is covered at a glance.

| Test File | Workflows | Area |
| --- | --- | --- |
| [startup.md](startup.md) | 4 | POS screen initial state |
| [transactions.md](transactions.md) | 26 | Cart operations + payment modal |
| [hold-transactions.md](hold-transactions.md) | 16 | Hold / recall / TS Lookup |
| [inventory.md](inventory.md) | 5 | Inventory modal basics |
| [inventory-management.md](inventory-management.md) | 9 | Full CRUD for departments, tax codes, vendors, items |
| [search-open-in-inventory.md](search-open-in-inventory.md) | 1 | Search modal to inventory bridge |
| [stax-payments.md](stax-payments.md) | 9 | Terminal card payments (Stax) |

**Total: 70 test cases**

---

## How to Run

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
```

## Mock Strategy

All E2E tests inject `window.api` via `page.addInitScript()` -- no real database or Stax terminal is used. Each spec file has its own mock tailored to the workflows it tests.
