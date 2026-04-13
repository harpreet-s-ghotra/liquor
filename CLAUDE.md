# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## High Spirits POS Project Guide

This file provides essential context for working on this project. Read it before making any changes.

---

## Project Overview

**High Spirits POS** is a desktop Point of Sale application for liquor stores by Checkoutmain & Co., built on Electron. It is inspired by PC America POS in its UX structure. Revenue comes from per-transaction residuals via Finix payment processing under an ISV/platform model.

- **Target platform:** Windows (developed on macOS)
- **Started:** February 2026
- **Current phase:** Phase 2 (Inventory) mostly complete, Phase 3 (Finix) in progress

---

## Tech Stack

| Layer         | Technology                                                                            |
| ------------- | ------------------------------------------------------------------------------------- |
| Desktop shell | Electron 39 (electron-vite)                                                           |
| UI            | React 19 + TypeScript                                                                 |
| State         | Zustand 5                                                                             |
| Styling       | BEM CSS + custom CSS tokens (`styles/tokens.css`) + stylelint-config-concentric-order |
| Database      | SQLite via better-sqlite3 (sync, main process only)                                   |
| Payments      | Finix API                                                                             |
| Unit tests    | Vitest + React Testing Library                                                        |
| E2E tests     | Playwright                                                                            |

---

## Project Structure

```
src/
  main/               Electron main process
    index.ts          IPC handlers (ipcMain.handle calls)
    database/         SQLite repositories (one file per entity)
    services/finix.ts  Finix API integration
  preload/
    index.ts          Exposes window.api to renderer via contextBridge
    index.d.ts        Type definitions for window.api
  renderer/src/
    App.tsx           Root — routes based on auth state
    pages/            ActivationScreen, LoginScreen, POSScreen
    components/
      action/         ActionPanel (product grid + category selector)
      ticket/         TicketPanel (shopping cart)
      payment/        PaymentModal
      search/         SearchModal
      inventory/      InventoryModal + ItemForm + CRUD panels
      layout/         HeaderBar, BottomShortcutBar
      common/         FormField, ValidatedInput, TabBar, AppButton
      ui/             Radix UI primitives (Dialog, Tabs, etc.)
    store/
      useAuthStore.ts Auth state machine (Zustand)
      usePosScreen.ts Cart + product state (Zustand)
      useThemeStore.ts Theme preference (Zustand)
    hooks/
      useCrudPanel.ts Generic CRUD state hook (used by Dept/Tax/Distributor panels)
      useDebounce.ts  Debounce for search inputs
    utils/
      currency.ts     formatCurrency, parseCurrencyDigitsToDollars, normalizeCurrencyForInput
      pricing-engine.ts Special pricing rule evaluation
    styles/
      tokens.css      CSS custom properties — single source of truth for colors/spacing
  shared/
    types/index.ts    ALL shared types between main and renderer — edit here first
tests/
  e2e/               Playwright test suites
docs/                Feature specs and architecture docs
```

---

## Architecture Rules

### IPC — The Only Way to Talk to the Database

The renderer **never** directly accesses the database. All data calls go through:

```
window.api.methodName(args)     [renderer]
  → preload/index.ts            [contextBridge]
  → ipcMain.handle in main/index.ts
  → database/*.repo.ts
  → SQLite
```

When adding a new backend feature:

1. Add the repository method in `src/main/database/*.repo.ts`
2. Add the `ipcMain.handle` in `src/main/index.ts`
3. Expose it via `contextBridge` in `src/preload/index.ts`
4. Add the type signature in `src/preload/index.d.ts`
5. Call it from the renderer via `window.api.methodName()`

### Types — Single Source of Truth

All shared types live in `src/shared/types/index.ts`. Do not duplicate type definitions in the renderer. Renderer-only types go in `src/renderer/src/types/pos.ts`.

### State Management

- **Zustand** for global state (`useAuthStore`, `usePosScreen`, `useThemeStore`)
- **Local React state** for form state (e.g., `ItemForm` uses `useState`)
- Do not add Redux, Context API, or other state libraries
- Derived values go in `useMemo` inside stores, not in components

### Auth State Machine

The app has 6 states managed by `useAuthStore`:

```
loading → auth → pin-setup → distributor-onboarding → login → pos
```

- `auth`: No valid Supabase session — shows `AuthScreen` (email + password)
- `pin-setup`: Authenticated but no cashiers in SQLite — shows `PinSetupScreen`
- `distributor-onboarding`: Cashiers exist but no products — shows `DistributorOnboardingScreen`
- `login`: Fully set up, no cashier logged in — shows `LoginScreen`
- `pos`: Cashier logged in — shows `POSScreen`

Supabase service: `src/main/services/supabase.ts`. Session persisted in `userData/supabase-auth.json`.

---

## Key Commands

```bash
npm run dev          # Start Electron app in development
npm run dev:renderer # Start renderer only (Vite on :4173) — used for E2E tests
npm run lint               # ESLint
npm run typecheck          # TypeScript type checking
npm run test               # Run all tests (renderer + node/backend)
npm run test:watch         # Vitest watch mode (renderer)
npm run test:node          # Run backend (Node/SQLite) tests only
npm run test:node:watch    # Backend tests in watch mode
npm run test:coverage      # Coverage for both suites
npm run test:node:coverage # Coverage for backend only
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:ui        # Playwright in UI mode
npm run build              # Production build
```

---

## Supabase CLI — Use This for All Cloud DB Work

The Supabase CLI (`npx supabase`) is installed. **Use it directly** — do not ask the user to run SQL manually in the Supabase portal.

```bash
# Link project to remote (run once if not yet linked)
npx supabase link --project-ref <ref>   # ref from project URL: app.supabase.com/project/<ref>

# Execute arbitrary SQL against the remote DB
npx supabase db execute --remote --sql "SELECT * FROM merchant_products LIMIT 5;"

# Create a new migration file
npx supabase migration new <migration-name>

# Push local migration files to remote
npx supabase db push

# Pull remote schema into local migration history
npx supabase db pull

# Show schema diff between local migrations and remote
npx supabase db diff --use-migra

# Inspect remote DB (tables, indexes, RLS policies)
npx supabase inspect db table-sizes --remote
npx supabase inspect db index-sizes --remote
```

### Rules

- Always use `npx supabase db execute --remote` to inspect data or verify schema — never ask the user to open the portal
- Schema changes go through migration files (`supabase/migrations/`) committed to the repo — never apply ad-hoc SQL via the portal
- After creating a migration file, push it with `npx supabase db push`
- RLS policies and table definitions belong in migration files, not applied manually

---

## Quality Gate — Required Before Finalizing Any Change

Run in this order:

```bash
npx prettier --write .   # fix all formatting issues first
npm run lint
npx stylelint "src/**/*.css" # enforce concentric CSS property ordering
npm run typecheck
npm run test:coverage        # renderer + backend (must stay ≥ 80%)
npm run test:e2e             # for UI flow changes
```

**Coverage must stay ≥ 80%** for statements, branches, functions, and lines. If coverage drops:

1. Write or update unit tests first
2. Re-run coverage
3. Do not finalize until the threshold passes

---

## Testing Conventions

### Backend Tests (Vitest — Node environment)

- Test files live alongside source: `repo.test.ts` in `src/main/database/`
- Use `createTestDb()` helper: opens an in-memory SQLite DB, calls `setDatabase` + `applySchema`
- Call repo functions directly — no IPC, no mocking
- Enable `foreign_keys = ON` in the test DB to catch constraint bugs
- `applySchema` is exported from `schema.ts` for this purpose

```typescript
function createTestDb(): void {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  setDatabase(db)
  applySchema(db)
}
```

### Renderer Unit Tests (Vitest — jsdom environment)

- Test files live alongside source: `ComponentName.test.tsx`
- Mock `window.api` in `beforeEach` — never let tests hit real IPC
- Use Zustand `setState` directly for store tests — no app initialization needed
- Keep tests deterministic and independent from external services
- Test IDs: prefer `data-testid` attributes; avoid brittle class selectors

```typescript
// Standard mock pattern
beforeEach(() => {
  vi.mocked(window.api.getProducts).mockResolvedValue([...])
})
```

### E2E Tests (Playwright)

- Files live in `tests/e2e/`
- Inject mock API via `page.addInitScript()` — never hit real DB in E2E
- Use `loginWithPin` helper to get past the login screen
- Write E2E tests for any user-facing workflow change

```typescript
const attachPosApiMock = async (page: Page) => {
  await page.addInitScript(() => {
    window.api = { getMerchantConfig: async () => ({...}), ... }
  })
}
```

---

## Styling Conventions

### BEM CSS — No Tailwind

This project uses **plain CSS with BEM naming** — no Tailwind, no CSS-in-JS. Each component has a companion `.css` file imported at the top of the `.tsx`.

### BEM Naming Convention

- **Block:** component name in kebab-case (e.g., `ticket-panel`)
- **Element:** double underscore (e.g., `ticket-panel__line`)
- **Modifier:** double dash (e.g., `ticket-panel__line--active`)

### CSS Property Ordering — Concentric CSS

Property order is enforced by `stylelint-config-concentric-order`:

1. **Positioning** — `position`, `top`, `right`, `z-index`
2. **Display & Box Model** — `display`, `flex`, `grid`, `width`, `height`, `margin`, `padding`
3. **Border & Background** — `border`, `border-radius`, `background`
4. **Typography** — `font`, `text`, `color`
5. **Other** — `cursor`, `opacity`, `box-shadow`

### When to Use Inline Styles

Only use inline `style={{}}` for **truly dynamic values** — values computed at runtime from props or state. Examples:

- Conditional backgrounds (`isSelected ? 'var(--active-bg)' : 'var(--bg)'`)
- Dynamic `gridTemplateRows` / `gridTemplateColumns`
- Color derived from component state

Static styles **always** go in the `.css` file.

### Class Merging

Use `cn()` from `@renderer/lib/utils` (which wraps `clsx`) for conditional class composition:

```tsx
import { cn } from '@renderer/lib/utils'
;<div className={cn('ticket-panel__line', isActive && 'ticket-panel__line--active')} />
```

### Design Tokens First

All colors, radius, and semantic values are defined as CSS custom properties in `src/renderer/src/styles/tokens.css`. Use `var(--token-name)` in CSS files rather than hardcoding hex values.

### Key Design Tokens

```css
--bg-shell, --bg-panel, --bg-surface, --bg-input  /* backgrounds */
--text-primary, --text-muted, --text-on-dark       /* text */
--border-default, --border-strong, --border-soft   /* borders */
--semantic-success-text, --semantic-danger-text    /* status colors */
--accent-blue                                      /* focus/accent */
```

### UI Constraints

- Minimum button height: **56px** for action buttons; **64–80px** for primary pay actions
- No animations or transitions — the app must feel instant
- No emojis in UI
- Touch-friendly targets throughout

---

## Component Reuse Rules — MANDATORY

Before writing ANY new UI element, check the table below. If an existing component covers the use case, you MUST use it. Do not write raw HTML elements (`<button>`, `<input>`, `<select>`, `<label>`) when a project component exists. Do not create new wrapper components that duplicate existing ones.

Keep this table current when adding or modifying components in `ui/` or `common/`.

### Component Lookup

| Need                                   | Use                                                 | Import from             |
| -------------------------------------- | --------------------------------------------------- | ----------------------- |
| Clickable button                       | `AppButton`                                         | `common/AppButton`      |
| Button with ghost/outline/icon variant | `Button`                                            | `ui/button`             |
| Text input (forms)                     | `ValidatedInput` with `fieldType`                   | `common/ValidatedInput` |
| Text input (inventory, compact)        | `InventoryInput`                                    | `common/InventoryInput` |
| Select dropdown (inventory)            | `InventorySelect`                                   | `common/InventoryInput` |
| Label + input + error wrapper          | `FormField`                                         | `common/FormField`      |
| Modal / dialog                         | `Dialog` + `DialogContent`                          | `ui/dialog`             |
| Confirmation prompt                    | `ConfirmDialog`                                     | `common/ConfirmDialog`  |
| Error feedback (modal)                 | `ErrorModal`                                        | `common/ErrorModal`     |
| Success feedback (modal, auto-closes)  | `SuccessModal`                                      | `common/SuccessModal`   |
| Tabs                                   | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | `ui/tabs`               |
| Status badge                           | `Badge`                                             | `ui/badge`              |
| Radio selection                        | `RadioGroup` + `RadioGroupItem`                     | `ui/radio-group`        |
| Multi-toggle                           | `ToggleGroup` + `ToggleGroupItem`                   | `ui/toggle-group`       |
| Checkbox                               | `Checkbox`                                          | `ui/checkbox`           |
| Accessible label                       | `Label`                                             | `ui/label`              |
| Floating panel                         | `Popover`                                           | `ui/popover`            |
| Divider                                | `Separator`                                         | `ui/separator`          |
| Class merging                          | `cn()`                                              | `lib/utils`             |
| CRUD list panel                        | `useCrudPanel<T>` hook                              | `hooks/useCrudPanel`    |
| Debounced value                        | `useDebounce<T>` hook                               | `hooks/useDebounce`     |
| Currency display                       | `formatCurrency()`                                  | `utils/currency`        |
| Currency input handling                | `normalizeCurrencyForInput()`                       | `utils/currency`        |

### Which Button Component?

- **`AppButton`** — default choice for all standard buttons (actions, form submit, cancel, CRUD operations). Defaults `type="button"`. Variants: `default | success | danger | warning | neutral`. Sizes: `sm | md | lg`.
- **`Button`** (CVA) — use directly only when you need `ghost`, `outline`, or `icon` size variants, or `asChild` for Radix composition. Otherwise use `AppButton`.
- **Raw `<button>`** — only acceptable for highly custom interactive elements where the visual design is fundamentally different from a standard button (e.g., product grid tiles, ticket line items, F-key shortcuts with unique layouts). Always include `type="button"`.

### Component Anti-Patterns — Do Not

- Write `<button className="..." style={{...}}>` with inline styles for static properties when `AppButton` with a `variant` prop achieves the same result
- Write `<input className="...">` instead of `ValidatedInput` or `InventoryInput` — these handle focus rings, border colors, and sizing consistently
- Write `<label>...<span className="text-red...">*</span></label>` instead of `FormField` with `required`
- Create a new confirmation modal instead of using `ConfirmDialog`
- Render inline error/success text (`<p className="...error...">`) when `ErrorModal` or `SuccessModal` should be used
- Render raw IPC error messages — always strip the `"Error invoking remote method '...': Error:"` prefix before displaying
- Write manual debounce logic (`setTimeout`/`clearTimeout`) instead of `useDebounce`
- Duplicate CRUD state management (items array, error/success messages, loading) instead of `useCrudPanel`
- Write `toFixed(2)` or manual dollar formatting instead of `formatCurrency()`
- Write manual input sanitization instead of using `ValidatedInput` with the right `fieldType`

---

## Inventory System — Key Details

The inventory modal (`InventoryModal` + `ItemForm`) is the most complex part of the UI.

### Current Structure

- `InventoryModal` — modal shell + 4 outer tabs (Items, Departments, Tax Codes, Vendors)
- `ItemForm` — product CRUD with its own 4 inner tabs (Case & Quantity, Additional SKUs, Special Pricing, Sales History)
- `DepartmentPanel`, `TaxCodePanel`, `VendorPanel` — all use the `useCrudPanel` hook

### useCrudPanel Hook

Generic hook for all CRUD panels. Provides: `items`, `error`, `success`, `editingId`, `runAction`, `loadItems`. Do not replicate this pattern — use the hook.

### Currency Handling

Always use the utilities in `currency.ts` for monetary values:

- `normalizeCurrencyForInput(value)` — on user input
- `parseCurrencyDigitsToDollars(digits)` — convert raw digit string to dollar amount
- `formatCurrency(amount)` — display formatting

Never store raw currency strings or perform arithmetic on unformatted strings.

### Pricing Engine

Special pricing logic lives in `src/renderer/src/utils/pricing-engine.ts`. The `applyPromotions` and `deriveCartTotals` functions are tested thoroughly — do not inline pricing logic in components.

---

## Active Work — Inventory Modal v2

The inventory modal is being redesigned. See `docs/features/inventory-v2.md` for the full spec. Key decisions:

- Visual redesign matching Figma (`node-id=6:3`, file `99ouO4wLIDF6jwNQIhZUax`)
- Tabs keep the same 4 items — only the tab bar **styling** changes (new dark-green underline style)
- New `FooterActionBar` component replaces header buttons; search bar moves to the footer
- Two new computed (read-only) fields in General Info: **Final Price after tax** and **Profit Margin %**
- New persisted fields: item_type, allow_food_stamps, prompt_for_price_at_pos, scale_at_pos, bonus_points_earned, commission_amount, commission_mode, physical_location
- The Figma navigation buttons (Previous / Look Up / Next) are **not being implemented** — keep the existing search bar UX

**Do not start implementation without reviewing `docs/features/inventory-v2.md` first.**

---

## AI Index — Read Before Searching

Before searching the codebase, read the relevant index doc in `docs/ai/`:

| Index                      | Covers                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| `docs/ai/repo-map.md`      | Architecture, layer entry points, IPC channels, module lookup table |
| `docs/ai/testing-map.md`   | Test locations, runners, patterns, how to add tests                 |
| `docs/ai/inventory-map.md` | All inventory feature files, components, types, tests               |
| `docs/ai/finix-map.md`     | Payment/auth files, Finix API, refunds, device roadmap              |
| `docs/ai/glossary.md`      | Canonical terms and definitions                                     |

Routing: read `repo-map.md` first for general tasks. Read the feature-specific map for scoped work. Check `glossary.md` when a domain term is ambiguous.

---

## Documentation

All documentation lives in `docs/`. See `docs/README.md` for the full index.

| Doc                                    | Covers                                                            |
| -------------------------------------- | ----------------------------------------------------------------- |
| `docs/project-plan.md`                 | Full project vision, roadmap, DB schema, Finix architecture       |
| `docs/design-system.md`                | Visual spec -- colors, typography, layout rules, component specs  |
| `docs/features/inventory-v1.md`        | Inventory CRUD spec (v1, historical)                              |
| `docs/features/inventory-v2.md`        | Inventory modal redesign (active)                                 |
| `docs/features/pricing-engine.md`      | Special pricing rules, mix-and-match                              |
| `docs/features/product-search.md`      | Search modal spec                                                 |
| `docs/features/returns-and-refunds.md` | Return workflow, refund scenarios                                 |
| `docs/features/clock-in-clock-out.md`  | Register sessions, end-of-day report, cash reconciliation         |
| `docs/features/stax-activation.md`     | Legacy auth flow spec (superseded by supabase-onboarding)         |
| `docs/features/supabase-onboarding.md` | Supabase auth, PIN setup, distributor catalog import (Phase A)    |
| `docs/features/cloud-sync.md`          | Multi-register transaction & inventory sync via Supabase Realtime |
| `docs/features/finix-integration.md`   | Finix credentials, phases, refunds, device roadmap                |
| `docs/features/sales-reports.md`       | Sales summary, product/category analysis, tax report, comparisons |

### Documentation Conventions

- All doc files use **kebab-case** naming
- Feature specs go in `docs/features/`
- AI navigation indexes go in `docs/ai/`
- E2E test docs go in `docs/tests/` (auto-maintained by `update-test-docs` agent)

---

## Documentation Workflow — Mandatory for All Changes

AI agents (Claude Code, Copilot, any LLM) MUST follow this workflow. These are not suggestions -- they are required steps that happen automatically as part of every task.

### When implementing a new feature

1. Create a feature spec in `docs/features/<feature-name>.md` before writing code
2. Add it to the index in `docs/README.md`
3. Add it to the Documentation table in this file (CLAUDE.md)

### When modifying an existing feature

1. Update the corresponding doc in `docs/features/` to reflect the changes
2. If the change affects types, update `docs/ai/repo-map.md` if IPC channels changed

### When writing or updating tests

1. Write unit tests for all new code (coverage must stay >= 80%)
2. Write E2E tests for user-facing workflow changes
3. After E2E test changes, run the `update-test-docs` agent to sync `docs/tests/`

### When adding new IPC channels, types, or stores

1. Update `docs/ai/repo-map.md` with new IPC channels
2. Update `docs/ai/testing-map.md` if new test files were added
3. Update the feature-specific AI map if one exists (`inventory-map.md`, `finix-map.md`)

### When completing a task

Before finalizing, verify:

- [ ] Relevant docs in `docs/features/` are up to date
- [ ] `docs/README.md` index reflects any new or renamed docs
- [ ] CLAUDE.md references are correct if docs were added/moved
- [ ] Test docs are synced (run `update-test-docs` if E2E tests changed)

### What NOT to document

- Code patterns derivable from reading the source
- Git history (use `git log` / `git blame`)
- Debugging solutions (the fix is in the code; the commit message has context)
- Ephemeral task details or conversation context

---

## Commit Conventions

Follow Conventional Commits:

```
feat:      New feature
fix:       Bug fix
refactor:  Code change that doesn't add a feature or fix a bug
docs:      Documentation only
test:      Test additions or changes
chore:     Tooling, dependencies, config
style:     Formatting, CSS-only changes
```

Branch naming: `feature/name`, `fix/name`

---

## What NOT to Do

- **No direct DB calls from the renderer** — always go through `window.api`
- **No hardcoded product/inventory data** — all data comes from SQLite via IPC
- **No new state libraries** — Zustand only
- **No animations** — the app must feel instant
- **No emojis** — in code or UI
- **No Tailwind** — this project uses BEM CSS, not Tailwind. Do not add Tailwind or utility-first CSS classes
- **No CSS-in-JS for static styles** — only use inline `style={{}}` for dynamic values computed at runtime
- **Do not duplicate types** — all shared types belong in `src/shared/types/index.ts`
- **Do not skip the coverage gate** — ≥80% is required on every change
- **Do not write raw `<button>`, `<input>`, or `<select>` elements** — use the project components listed in "Component Reuse Rules" above
- **Do not add features beyond what was asked** — keep scope tight
- **Do not leave Prettier issues unresolved** — run `npx prettier --write .` before linting; Prettier config: single quotes, no semis, 100 char width, no trailing commas

---

## Finix Integration Notes

- Sandbox base URL: `https://finix.sandbox-payments-api.com`
- Production base URL: `https://finix.live-payments-api.com`
- The Electron app stores merchant-specific Finix credentials locally after Supabase onboarding
- Refunds must be performed against the original Finix `transfer_id`
- Test cards: Visa `4111111111111111`, Mastercard `5555555555554444`
- See `docs/features/finix-integration.md` for the full endpoint reference
