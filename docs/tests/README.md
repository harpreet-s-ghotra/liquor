# Test Documentation

This directory documents the current Playwright end-to-end workflows in `tests/e2e`.

## E2E Test Coverage

Each file below documents one Playwright spec. Every workflow is broken into concise user steps and assertions so the covered behavior is easy to audit.

| Test File                                                          | Workflows | Area                                                                                          |
| ------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------- |
| [startup.md](startup.md)                                           | 4         | POS startup layout, defaults, and cart selection behavior                                     |
| [transactions.md](transactions.md)                                 | 35        | Cart edits, split-payment persistence, case discounts, and tile rules                         |
| [hold-transactions.md](hold-transactions.md)                       | 16        | Hold, recall, selective recall, delete, and clear-all flows                                   |
| [inventory.md](inventory.md)                                       | 10        | Inventory modal validation, save/search, tab wiring, display name, and footer search behavior |
| [inventory-resize-and-pricing.md](inventory-resize-and-pricing.md) | 6         | Inventory resize-handle persistence and special-pricing rule editing                          |
| [inventory-management.md](inventory-management.md)                 | 9         | CRUD for item types, tax codes, distributors, and items                                       |
| [search-modal.md](search-modal.md)                                 | 5         | Search modal columns, filters, and zero-results layout stability                              |
| [search-open-in-inventory.md](search-open-in-inventory.md)         | 1         | Search modal handoff into inventory editing                                                   |
| [finix-payments.md](finix-payments.md)                             | 9         | Finix-backed credit and debit payment flows                                                   |
| [clock-out.md](clock-out.md)                                       | 9         | Session list, clock-out confirmation, and report workflows                                    |
| [auth-error-handling.md](auth-error-handling.md)                   | 8         | PIN validation errors, retries, and keypad behavior                                           |
| [promotions.md](promotions.md)                                     | 8         | Special pricing and discount behavior in cart and checkout                                    |
| [manager-modal.md](manager-modal.md)                               | 10        | F6 manager modal tabs, close behavior, cashier/register admin, and data history               |
| [reorder-dashboard.md](reorder-dashboard.md)                       | 3         | F2 Inventory reorder-to-purchase-order handoff and create-view item calculations              |
| [purchase-orders.md](purchase-orders.md)                           | 3         | Purchase-order full receipt, received-order edits, and case-cost unit pricing                 |
| [printer-settings.md](printer-settings.md)                         | 13        | Printer modal configuration, save/reset, and sample-print controls                            |
| [reports.md](reports.md)                                           | 7         | Sales reports modal tabs, cards, export actions, and manual sales-history pulls               |
| [refunds.md](refunds.md)                                           | 6         | Sales history expansion, recall-for-return, and refund completion flow                        |

**Total: 162 test cases**

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
