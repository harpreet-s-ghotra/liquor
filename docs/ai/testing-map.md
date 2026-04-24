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

| Test file                          | Tests                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `inventory-deltas.repo.test.ts`    | Inventory delta insert/query/sync-marking helpers                                                 |
| `products.repo.test.ts`            | Product CRUD, search, inventory queries, special pricing                                          |
| `transactions.repo.test.ts`        | Transaction sync hooks, inventory deltas, FIFO cost_at_sale coverage                              |
| `product-cost-layers.repo.test.ts` | FIFO layer creation/consumption and fallback cost behavior                                        |
| `held-transactions.repo.test.ts`   | Hold save/list/delete/clear                                                                       |
| `sessions.repo.test.ts`            | Session CRUD, report generation, cash reconciliation                                              |
| `tax-codes.repo.test.ts`           | Tax code CRUD + `enqueueTaxCodeSync` hook coverage                                                |
| `item-types.repo.test.ts`          | Item type CRUD + `enqueueItemTypeSync` hook coverage                                              |
| `distributors.repo.test.ts`        | Distributor CRUD + `enqueueDistributorSync` hook                                                  |
| `cashiers.repo.test.ts`            | Cashier CRUD + `enqueueCashierSync` hook coverage                                                 |
| `reports.repo.test.ts`             | Sales summary, product/category/tax/comparison/cashier/hourly reports                             |
| `purchase-orders.repo.test.ts`     | Purchase order CRUD, status transitions, unit-cost overrides, receiving cost layers, auto-receive |
| `schema.test.ts`                   | Schema backfills including size normalization idempotency                                         |

Pattern: `createTestDb()` with in-memory SQLite, `foreign_keys = ON`.

### Main Services — `src/main/services/`

| Test file                       | Tests                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| `cash-drawer.test.ts`           | Receipt-printer persistence, legacy USB fallback, printer enumeration    |
| `merchant-provisioning.test.ts` | Invite-time provisioning, auto-repair for invited users, name derivation |
| `telemetry.test.ts`             | JSONL telemetry flush and sensitive payload redaction                    |
| `sync/initial-sync.test.ts`     | Initial sync completion without automatic transaction backfill           |
| `sync/velocity-sync.test.ts`    | Cloud reorder-velocity RPC mapping and offline fallback                  |

### Sync Services — `src/main/services/sync/`

| Test file                  | Tests                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| `tax-code-sync.test.ts`    | `uploadTaxCode` success/error, `applyRemoteTaxCodeChange` LWW logic      |
| `item-type-sync.test.ts`   | `uploadItemType` success/error, apply LWW + name-rename product update   |
| `distributor-sync.test.ts` | `uploadDistributor` success/error, `applyRemoteDistributorChange` LWW    |
| `cashier-sync.test.ts`     | `uploadCashier` success/error, `applyRemoteCashierChange` LWW + pin_hash |

Pattern: Mock Supabase client via `vi.fn()` chains, `createTestDb()` for apply-side SQLite tests.

### Renderer — `src/renderer/src/`

| Area                             | Test files                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Pages                            | `pages/{POSScreen,LoginScreen,ActivationScreen,BusinessSetupScreen}.test.tsx`                                                       |
| Stores                           | `store/{useAuthStore,usePosScreen,useThemeStore}.test.ts(x)`                                                                        |
| Utils                            | `utils/{currency,pricing-engine}.test.ts`                                                                                           |
| Shared hooks                     | `hooks/useSearchDropdown.test.tsx`                                                                                                  |
| Components/action                | `action/ActionPanel.test.tsx`                                                                                                       |
| Components/ticket                | `ticket/TicketPanel.test.tsx`                                                                                                       |
| Components/payment               | `payment/PaymentModal.test.tsx`                                                                                                     |
| Components/search                | `search/SearchModal.test.tsx`                                                                                                       |
| Components/hold                  | `hold/HoldLookupModal.test.tsx`                                                                                                     |
| Components/clock-out             | `clock-out/{ClockOutModal,ClockOutReport}.test.tsx`                                                                                 |
| Components/layout                | `layout/{HeaderBar,BottomShortcutBar}.test.tsx`                                                                                     |
| Components/common                | `common/{AppButton,ValidatedInput,FormField,TabBar,ConfirmDialog,ErrorModal,SearchDropdown}.test.tsx`                               |
| Components/common                | `common/SyncProgressModal.test.tsx`                                                                                                 |
| Components/inventory             | `inventory/{InventoryModal,FooterActionBar}.test.tsx`                                                                               |
| Components/printer               | `printer/PrinterSettingsModal.test.tsx`                                                                                             |
| Components/reports               | `reports/{ReportsModal,ReportDateRangePicker}.test.tsx`                                                                             |
| Components/sales-history         | `sales-history/SalesHistoryModal.test.tsx`                                                                                          |
| Components/manager               | `manager/{ManagerModal,CashierPanel,RegisterPanel,MerchantInfoPanel,DataHistoryPanel,ReorderDashboard,PurchaseOrderPanel}.test.tsx` |
| Components/inventory/items       | `items/ItemForm.test.tsx`                                                                                                           |
| Components/inventory/dept        | `departments/DepartmentPanel.test.tsx`                                                                                              |
| Components/inventory/tax         | `tax-codes/TaxCodePanel.test.tsx`                                                                                                   |
| Components/inventory/distributor | `distributors/DistributorPanel.test.tsx`                                                                                            |
| App                              | `App.test.tsx`                                                                                                                      |

Pattern: Mock `window.api` in `beforeEach`, use `vi.mocked()`, Zustand `setState` for stores.

### Shared Utilities — `src/shared/`

| Test file            | Tests                                   |
| -------------------- | --------------------------------------- |
| `utils/size.test.ts` | Size normalization and canonical casing |

## E2E Test Locations — `tests/e2e/`

| Spec file                              | Covers                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `startup.spec.ts`                      | App launch, activation, cashier login                                        |
| `finix-payments.spec.ts`               | Finix credit/debit flow, decline, split pay                                  |
| `transactions.spec.ts`                 | Checkout, payments, refunds, history                                         |
| `inventory.spec.ts`                    | Inventory item CRUD, SKUs, special pricing, footer search keyboard selection |
| `inventory-management.spec.ts`         | Departments, Tax Codes, Distributors CRUD                                    |
| `inventory-resize-and-pricing.spec.ts` | Inventory resize handle persistence, special-pricing table without duration  |
| `hold-transactions.spec.ts`            | Hold and recall transactions                                                 |
| `search-modal.spec.ts`                 | Search filters, item type/distributor                                        |
| `search-open-in-inventory.spec.ts`     | Search → open in inventory, including non-canonical size display             |
| `clock-out.spec.ts`                    | Clock out flow, PIN, report, print                                           |
| `auth-error-handling.spec.ts`          | PIN validation errors, retries, and keypad behavior                          |
| `promotions.spec.ts`                   | Special pricing and discount behavior in cart and checkout                   |
| `manager-modal.spec.ts`                | Manager modal tabs, close behavior, and admin views                          |
| `reports.spec.ts`                      | Sales reports modal, tabs, export buttons, manual sales-history pull         |
| `printer-settings.spec.ts`             | Printer config, receipt settings, test print                                 |
| `refunds.spec.ts`                      | Sales history recall, return workflow                                        |
| `reorder-dashboard.spec.ts`            | Reorder projections, distributor filters, discontinued exclusion             |
| `purchase-orders.spec.ts`              | Mark fully received, submitted/received PO edits, and create price interlock |

Pattern: `page.addInitScript()` to inject mock `window.api`, including `consumePendingDeepLink()` for current app bootstrap. `loginWithPin` helper for auth bypass.

## Documentation — `docs/tests/`

Each E2E spec has a matching `.md` file with step tables. Keep in sync via `update-test-docs` agent.

## Adding a New Test

1. **Unit test**: Create `ComponentName.test.tsx` next to the component. Mock `window.api`. Run `npm run test:coverage`.
2. **E2E test**: Create `feature-name.spec.ts` in `tests/e2e/`. Inject mock API. Run `npm run test:e2e`.
3. **Docs**: After E2E changes, run `update-test-docs` agent to sync `docs/tests/`.
