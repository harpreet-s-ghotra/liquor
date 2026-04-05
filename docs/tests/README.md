# Test Documentation

This directory documents the current Playwright end-to-end workflows in `tests/e2e`.

## E2E Test Coverage

Each file below documents one Playwright spec. Every workflow is broken into concise user steps and assertions so the covered behavior is easy to audit.

| Test File                                                  | Workflows | Area                                                         |
| ---------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| [startup.md](startup.md)                                   | 4         | POS startup layout, defaults, and cart selection behavior    |
| [transactions.md](transactions.md)                         | 26        | Cart edits, search flows, and payment modal behavior         |
| [hold-transactions.md](hold-transactions.md)               | 16        | Hold, recall, selective recall, delete, and clear-all flows  |
| [inventory.md](inventory.md)                               | 5         | Inventory modal open, validation, save/search, SKU conflicts |
| [inventory-management.md](inventory-management.md)         | 9         | CRUD for item types, tax codes, distributors, and items      |
| [search-open-in-inventory.md](search-open-in-inventory.md) | 1         | Search modal handoff into inventory editing                  |
| [stax-payments.md](stax-payments.md)                       | 9         | Terminal-backed credit and debit payment flows               |
| [clock-out.md](clock-out.md)                               | 9         | Session list, clock-out confirmation, and report workflows   |

**Total: 79 test cases**

---

## How to Run

```bash
npm run test:e2e
npm run test:e2e:ui
```

## Mock Strategy

All Playwright specs inject `window.api` with `page.addInitScript()` so the workflows run against deterministic in-memory mocks instead of the real database, terminal, or printer integrations.

## Test Patterns

- Visibility, disabled-state, and text assertions for user-facing UI changes
- Keyboard and click interactions that match cashier workflows
- Async checks for modal state, search results, and payment processing
- Feature-grouped suites with self-contained setup per spec file
