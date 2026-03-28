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
| Stax service     | `src/main/services/stax.ts`          | Partner API calls (validate key, charge terminal)   |
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
- `merchant:get-config`, `merchant:activate`, `merchant:deactivate`
- `transactions:save`, `transactions:recent`, `transactions:get-by-number`, `transactions:save-refund`, `transactions:list`
- `held-transactions:save`, `held-transactions:list`, `held-transactions:delete`, `held-transactions:clear-all`
- `sessions:get-active`, `sessions:create`, `sessions:close`, `sessions:list`, `sessions:report`, `sessions:print-report`
- `stax:terminal:registers`, `stax:terminal:charge`

## Auth State Machine

```
loading → not-activated → login → pos
```

- `not-activated`: No Stax API key → `ActivationScreen`
- `login`: Key present, no cashier → `LoginScreen`
- `pos`: Cashier logged in → `POSScreen`

## Key Stores

| Store           | State                              | Actions                                           |
| --------------- | ---------------------------------- | ------------------------------------------------- |
| `useAuthStore`  | appState, merchant, cashier        | checkActivation, activate, login, logout          |
| `usePosScreen`  | products, cart, categories, totals | addToCart, removeFromCart, checkout, loadProducts |
| `useThemeStore` | theme (dark/light)                 | toggleTheme                                       |
| `useAlertStore` | alerts[]                           | showAlert, dismissAlert                           |
