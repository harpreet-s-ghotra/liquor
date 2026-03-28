# Testing Map

> Where tests live, how they work, and what to run.

## Test Suites

| Suite             | Runner     | Env      | Config                  | Command                 |
| ----------------- | ---------- | -------- | ----------------------- | ----------------------- |
| Renderer unit     | Vitest     | jsdom    | `vitest.config.ts`      | `npm run test`          |
| Backend unit      | Vitest     | node     | `vitest.config.node.ts` | `npm run test:node`     |
| Combined coverage | Vitest     | both     | merged                  | `npm run test:coverage` |
| E2E               | Playwright | chromium | `playwright.config.ts`  | `npm run test:e2e`      |

Coverage threshold: **>= 80%** (statements, branches, functions, lines).

## Unit Test Locations

### Backend (Node/SQLite) — `src/main/database/`

| Test file                        | Tests                                                    |
| -------------------------------- | -------------------------------------------------------- |
| `products.repo.test.ts`          | Product CRUD, search, inventory queries, special pricing |
| `held-transactions.repo.test.ts` | Hold save/list/delete/clear                              |
| `sessions.repo.test.ts`          | Session CRUD, report generation, cash reconciliation     |

Pattern: `createTestDb()` with in-memory SQLite, `foreign_keys = ON`.

### Renderer — `src/renderer/src/`

| Area                             | Test files                                                                  |
| -------------------------------- | --------------------------------------------------------------------------- |
| Pages                            | `pages/{POSScreen,LoginScreen,ActivationScreen}.test.tsx`                   |
| Stores                           | `store/{useAuthStore,usePosScreen,useThemeStore}.test.ts(x)`                |
| Utils                            | `utils/{currency,pricing-engine}.test.ts`                                   |
| Components/action                | `action/ActionPanel.test.tsx`                                               |
| Components/ticket                | `ticket/TicketPanel.test.tsx`                                               |
| Components/payment               | `payment/PaymentModal.test.tsx`                                             |
| Components/search                | `search/SearchModal.test.tsx`                                               |
| Components/hold                  | `hold/HoldLookupModal.test.tsx`                                             |
| Components/clock-out             | `clock-out/{ClockOutModal,ClockOutReport}.test.tsx`                         |
| Components/layout                | `layout/HeaderBar.test.tsx`                                                 |
| Components/common                | `common/{AppButton,ValidatedInput,FormField,TabBar,ConfirmDialog}.test.tsx` |
| Components/inventory             | `inventory/{InventoryModal,FooterActionBar}.test.tsx`                       |
| Components/inventory/items       | `items/ItemForm.test.tsx`                                                   |
| Components/inventory/dept        | `departments/DepartmentPanel.test.tsx`                                      |
| Components/inventory/tax         | `tax-codes/TaxCodePanel.test.tsx`                                           |
| Components/inventory/distributor | `distributors/DistributorPanel.test.tsx`                                    |
| App                              | `App.test.tsx`                                                              |

Pattern: Mock `window.api` in `beforeEach`, use `vi.mocked()`, Zustand `setState` for stores.

## E2E Test Locations — `tests/e2e/`

| Spec file                          | Covers                                    |
| ---------------------------------- | ----------------------------------------- |
| `startup.spec.ts`                  | App launch, activation, cashier login     |
| `stax-payments.spec.ts`            | Terminal charge flow                      |
| `transactions.spec.ts`             | Checkout, save, recall                    |
| `inventory.spec.ts`                | Inventory item CRUD                       |
| `inventory-management.spec.ts`     | Departments, Tax Codes, Distributors CRUD |
| `hold-transactions.spec.ts`        | Hold and recall                           |
| `search-open-in-inventory.spec.ts` | Search → open in inventory                |
| `clock-out.spec.ts`                | Clock out flow, PIN, report, print        |

Pattern: `page.addInitScript()` to inject mock `window.api`. `loginWithPin` helper for auth bypass.

## Documentation — `docs/tests/`

Each E2E spec has a matching `.md` file with step tables. Keep in sync via `update-test-docs` agent.

## Adding a New Test

1. **Unit test**: Create `ComponentName.test.tsx` next to the component. Mock `window.api`. Run `npm run test:coverage`.
2. **E2E test**: Create `feature-name.spec.ts` in `tests/e2e/`. Inject mock API. Run `npm run test:e2e`.
3. **Docs**: After E2E changes, run `update-test-docs` agent to sync `docs/tests/`.
