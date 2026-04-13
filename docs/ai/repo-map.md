# Repo Map

> Compact structural index for AI-assisted development. Read this before any codebase search.

## Architecture

```
Renderer (React)  →  window.api  →  Preload (contextBridge)  →  IPC  →  Main (Electron)  →  SQLite
```

- Renderer never touches the database directly.
- All data flows through `window.api.*` methods defined in `src/preload/index.ts`.
- Shared types live in `src/shared/types/index.ts` — single source of truth.

## Layer → Entry Points

| Layer            | Entry file                           | Purpose                                             |
| ---------------- | ------------------------------------ | --------------------------------------------------- |
| Main process     | `src/main/index.ts`                  | IPC handlers (`ipcMain.handle`) + app lifecycle     |
| Database repos   | `src/main/database/*.repo.ts`        | One file per entity; sync SQLite via better-sqlite3 |
| Schema           | `src/main/database/schema.ts`        | DDL + migrations (`applySchema`)                    |
| Finix service    | `src/main/services/finix.ts`         | Merchant verification, charges, refunds, devices    |
| Auto-updater     | `src/main/services/auto-updater.ts`  | electron-updater, checks public releases repo       |
| Report export    | `src/main/services/report-export.ts` | PDF/CSV export via pdfkit                           |
| Reports repo     | `src/main/database/reports.repo.ts`  | SQLite aggregation queries for all reports          |
| Preload          | `src/preload/index.ts`               | `contextBridge.exposeInMainWorld`                   |
| Preload types    | `src/preload/index.d.ts`             | `window.api` type contract                          |
| App root         | `src/renderer/src/App.tsx`           | Auth-state routing → pages                          |
| Shared types     | `src/shared/types/index.ts`          | 30+ types used by both main and renderer            |
| Shared constants | `src/shared/constants.ts`            | Validation rules (SKU pattern, PIN length, etc.)    |
| CSS tokens       | `src/renderer/src/styles/tokens.css` | Design tokens (colors, spacing, borders)            |

## Module Lookup — "If X, open Y"

| Task                       | Files to read                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Add a new IPC method       | `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, relevant `*.repo.ts`     |
| Add a shared type          | `src/shared/types/index.ts` only — then import in renderer/main                                 |
| Add a new page             | `src/renderer/src/pages/`, `src/renderer/src/App.tsx`, `src/renderer/src/store/useAuthStore.ts` |
| Add a component            | `src/renderer/src/components/<feature>/`, companion `.css`, companion `.test.tsx`               |
| Show an error to the user  | `common/ErrorModal` — modal with OK button (touch-friendly, size lg)                            |
| Show a success to the user | `common/SuccessModal` — modal that auto-closes after 5 s                                        |
| Add a Zustand store        | `src/renderer/src/store/`, export from index if needed                                          |
| Change product schema      | `schema.ts` → `products.repo.ts` → `src/shared/types/index.ts` → preload types → renderer       |
| Add an E2E test            | `tests/e2e/`, then `docs/tests/` for documentation                                              |
| Debug pricing              | `src/renderer/src/utils/pricing-engine.ts` + `pricing-engine.test.ts`                           |
| Debug currency display     | `src/renderer/src/utils/currency.ts`                                                            |
| Change CSS tokens          | `src/renderer/src/styles/tokens.css`                                                            |

## IPC Channel Naming

Channels follow `entity:action` pattern:

- `products:list`, `products:search`, `products:active-special-pricing`
- `inventory:products:search`, `inventory:products:detail`, `inventory:products:save`, `inventory:products:delete`
- `departments:list`, `departments:create`, `departments:update`, `departments:delete`
- `tax-codes:*`, `distributors:*`, `sales-reps:*`, `cashiers:*` — same CRUD pattern
- `merchant:get-config`, `merchant:verify-finix`, `merchant:deactivate`
- `auth:login`, `auth:logout`, `auth:check-session`
- `catalog:distributors`, `catalog:import`
- `transactions:save`, `transactions:recent`, `transactions:get-by-number`, `transactions:save-refund`, `transactions:list`
- `held-transactions:save`, `held-transactions:list`, `held-transactions:delete`, `held-transactions:clear-all`
- `sessions:get-active`, `sessions:create`, `sessions:close`, `sessions:list`, `sessions:report`, `sessions:print-report`
- `peripheral:get-drawer-config`, `peripheral:save-drawer-config`, `peripheral:open-cash-drawer`
- `peripheral:get-receipt-config`, `peripheral:save-receipt-config`
- `peripheral:get-receipt-printer-config`, `peripheral:save-receipt-printer-config`, `peripheral:list-receipt-printers`, `peripheral:get-printer-status`
- `finix:verify-merchant`, `finix:charge:card`, `finix:refund:transfer`, `finix:devices:list`, `finix:devices:create`, `finix:charge:terminal`, `finix:provision-merchant`
- `reports:sales-summary`, `reports:product-sales`, `reports:category-sales`, `reports:tax-summary`, `reports:comparison`, `reports:cashier-sales`, `reports:hourly-sales`, `reports:export`
- `sync:get-status`, `sync:get-device-config`, `sync:connectivity-changed` (event)
- `updater:check`, `updater:install`, `updater:update-available` (event), `updater:update-not-available` (event), `updater:update-downloaded` (event), `updater:error` (event)

## Auth State Machine

```
loading → auth → set-password → pin-setup → business-setup → distributor-onboarding → login → pos
```

- `loading`: App initializing
- `auth`: No valid Supabase session → `AuthScreen`
- `set-password`: Invite link accepted, user sets password → `SetPasswordScreen`
- `pin-setup`: Session valid, no cashiers in SQLite → `PinSetupScreen`
- `business-setup`: Cashiers exist, no merchant config → `BusinessSetupScreen`
- `distributor-onboarding`: Merchant configured, no products → `DistributorOnboardingScreen`
- `login`: Fully set up, no cashier logged in → `LoginScreen`
- `pos`: Cashier authenticated → `POSScreen`

Supabase service: `src/main/services/supabase.ts`
Session storage: `userData/supabase-auth.json` (file-based, Node has no localStorage)

## Key Stores

| Store           | State                              | Actions                                                                           |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| `useAuthStore`  | appState, merchant, cashier        | initialize, emailLogin, signOut, completeSetup, completeOnboarding, login, logout |
| `usePosScreen`  | products, cart, categories, totals | addToCart, removeFromCart, checkout, loadProducts                                 |
| `useThemeStore` | theme (dark/light)                 | toggleTheme                                                                       |
| `useAlertStore` | alerts[]                           | showAlert, dismissAlert                                                           |

## Cloud Sync — Module Lookup

Sync code lives entirely in `src/main/` (main process only). Never imported by renderer.

| Module                                           | Purpose                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `src/main/services/sync-worker.ts`               | Background drain loop + Realtime subscriptions for all entity types                |
| `src/main/services/sync/types.ts`                | All cloud payload types (`*SyncPayload`, `Cloud*Payload`)                          |
| `src/main/services/sync/initial-sync.ts`         | One-time product reconciliation on startup (cursor-based pagination, LWW)          |
| `src/main/services/sync/product-sync.ts`         | `uploadProduct`, `applyRemoteProductChange`                                        |
| `src/main/services/sync/inventory-delta-sync.ts` | `uploadInventoryDelta` (append-only cloud deltas)                                  |
| `src/main/services/sync/transaction-sync.ts`     | `uploadTransaction`, `applyRemoteTransaction`                                      |
| `src/main/services/sync/item-type-sync.ts`       | `uploadItemType`, `applyRemoteItemTypeChange` (name renames propagate to products) |
| `src/main/services/sync/tax-code-sync.ts`        | `uploadTaxCode`, `applyRemoteTaxCodeChange`                                        |
| `src/main/services/sync/distributor-sync.ts`     | `uploadDistributor`, `applyRemoteDistributorChange`                                |
| `src/main/services/sync/cashier-sync.ts`         | `uploadCashier`, `applyRemoteCashierChange` (includes pin_hash, main-process only) |
| `src/main/database/sync-queue.repo.ts`           | Local sync queue CRUD                                                              |
| `src/main/database/device-config.repo.ts`        | Device UUID + fingerprint storage                                                  |
| `src/main/services/connectivity.ts`              | `net.isOnline()` polling + listener                                                |
| `src/main/services/device-registration.ts`       | Registers terminal in Supabase `registers` table                                   |

### SyncEntityType values

`'product' | 'inventory_delta' | 'transaction' | 'item_type' | 'tax_code' | 'distributor' | 'cashier'`

### Natural identity keys (for upsert)

| Entity      | Conflict key                      |
| ----------- | --------------------------------- |
| product     | `merchant_id, sku`                |
| item_type   | `merchant_id, name`               |
| tax_code    | `merchant_id, code`               |
| distributor | `merchant_id, distributor_number` |
| cashier     | `merchant_id, pin_hash`           |

### IPC sync channels

- `sync:get-status` → queue stats + last_synced_at
- `sync:get-device-config` → device UUID + name
- `sync:connectivity-changed` → event emitted by connectivity monitor
