# Stax Activation & POS Login — Implementation Plan

## Overview

This document covers two features that gate access to the POS:

| Phase | Feature                 | Description                                                                                                                                                          |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Merchant Activation** | First-launch screen where the merchant enters their Stax Pay API key. The key is validated against `GET /self` and stored locally.                                   |
| **2** | **Cashier PIN Login**   | After activation, cashiers log in with a 4-digit PIN. Supports multiple cashiers per merchant.                                                                       |

> **Account model:** LiquorPOS uses **Stax Pay** (direct merchant account). The API key is obtained from the Stax Pay merchant dashboard and entered manually on first launch. No partner/ISV backend is required.

### Business Flow

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Stax Pay Dash   │      │  First Launch    │      │   Daily Use      │
│                  │      │                  │      │                  │
│ 1. Get API key   │─────▶│ 2. Activation    │─────▶│ 3. Cashier PIN   │
│    from Stax Pay │      │    screen: enter │      │    login → POS   │
│    dashboard     │      │    API key       │      │                  │
│                  │      │ 3. Validate key  │      └──────────────────┘
│                  │      │    (GET /self)   │
│                  │      │ 4. Store config  │
└──────────────────┘      └──────────────────┘
```

---

## Project Structure — New & Modified Files

```
src/
├── main/
│   ├── index.ts                          # MODIFIED — register new IPC handlers
│   ├── services/
│   │   └── stax.ts                       # NEW — Stax API client (validate key, charge, etc.)
│   └── database/
│       ├── schema.ts                     # MODIFIED — add merchant_config & cashiers tables
│       ├── merchant-config.repo.ts       # NEW — CRUD for merchant activation data
│       └── cashiers.repo.ts             # NEW — CRUD for cashier PINs
├── preload/
│   ├── index.ts                          # MODIFIED — expose new IPC channels
│   └── index.d.ts                        # MODIFIED — type definitions for new APIs
├── shared/
│   ├── types/
│   │   └── index.ts                      # MODIFIED — add MerchantConfig, Cashier types
│   └── constants.ts                      # MODIFIED — add PIN_LENGTH, etc.
└── renderer/
    └── src/
        ├── App.tsx                       # MODIFIED — route between activation/login/POS
        ├── store/
        │   └── useAuthStore.ts           # NEW — Zustand store for auth state
        ├── pages/
        │   ├── ActivationScreen.tsx      # NEW — Stax API key entry UI
        │   ├── ActivationScreen.test.tsx # NEW — tests
        │   ├── LoginScreen.tsx           # NEW — Cashier PIN entry UI
        │   └── LoginScreen.test.tsx      # NEW — tests
        ├── components/
        │   └── common/
        │       └── PinPad.tsx            # NEW — reusable numeric PIN pad component
        ├── styles/
        │   └── auth.css                  # NEW — styles for activation & login screens
        └── types/
            └── pos.ts                    # MODIFIED — re-export new types

tests/
└── e2e/
    └── activation-login.spec.ts          # NEW — Playwright e2e tests
```

---

## Database Schema Changes

### Table: `merchant_config` (singleton — max 1 row)

Stores the activation state of this POS terminal.

```sql
CREATE TABLE IF NOT EXISTS merchant_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),     -- singleton enforcement
  stax_api_key TEXT NOT NULL,                  -- JWT from Stax dashboard
  merchant_id TEXT NOT NULL,                   -- Stax merchant UUID
  merchant_name TEXT NOT NULL,                 -- company name from GET /self
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `cashiers`

Stores cashier PINs for daily login.

```sql
CREATE TABLE IF NOT EXISTS cashiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,                      -- SHA-256 hash of 4-digit PIN
  role TEXT DEFAULT 'cashier',                 -- 'admin' | 'cashier'
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 1 — Merchant Activation

### 1A. Stax Service Layer (`src/main/services/stax.ts`)

A thin HTTP client for the Stax API. Phase 1 only needs `validateApiKey()`.

```typescript
// Key methods:
validateApiKey(apiKey: string): Promise<StaxMerchant>
  // → GET /self with Authorization: Bearer <apiKey>
  // → Returns { merchant_id, company_name, status } or throws

// Phase A — Pre-hardware testing (direct API charge):
createCustomer(apiKey: string, data: object): Promise<StaxCustomer>
  // → POST /customer
createPaymentMethod(apiKey: string, customerId: string, cardData: object): Promise<StaxPaymentMethod>
  // → POST /payment-method/
chargePaymentMethod(apiKey: string, paymentMethodId: string, total: number, meta?: object): Promise<TerminalChargeResult>
  // → POST /charge — synchronous, no polling

// Phase B — Terminal hardware (already implemented):
getTerminalRegisters(apiKey: string): Promise<TerminalRegister[]>
  // → GET /terminal/register
chargeTerminal(apiKey: string, input: TerminalChargeInput): Promise<TerminalChargeResult>
  // → POST /terminal/charge + polling
```

### 1B. Merchant Config Repo (`src/main/database/merchant-config.repo.ts`)

```typescript
getMerchantConfig(): MerchantConfig | null
saveMerchantConfig(config: SaveMerchantConfigInput): MerchantConfig
clearMerchantConfig(): void   // for deactivation/reset
```

### 1C. IPC Handlers (added to `src/main/index.ts`)

```
merchant:get-config     → getMerchantConfig()
merchant:activate       → validateApiKey(key) then saveMerchantConfig(result)
merchant:deactivate     → clearMerchantConfig()
```

### 1D. Preload Bridge

```typescript
// Added to api object in preload/index.ts:
getMerchantConfig: () => Promise<MerchantConfig | null>
activateMerchant: (apiKey: string) => Promise<MerchantConfig>
deactivateMerchant: () => Promise<void>
```

### 1E. Activation Screen UI (`src/renderer/src/pages/ActivationScreen.tsx`)

- Full-screen dark panel with centered card
- Logo / "High Spirits POS" branding at top
- Single input field: "Stax API Key" (password-masked, with show/hide toggle)
- "Activate" button → calls `window.api.activateMerchant(key)`
- Shows loading spinner during validation
- On success: shows merchant name confirmation, transitions to cashier setup
- On error: shows inline error message (invalid key, network error, etc.)

### 1F. App Router (`src/renderer/src/App.tsx`)

```typescript
// App now has 3 states:
// 1. NOT_ACTIVATED → show ActivationScreen
// 2. ACTIVATED_NO_LOGIN → show LoginScreen (or setup first cashier)
// 3. LOGGED_IN → show POSScreen

function App() {
  const { appState } = useAuthStore()

  switch (appState) {
    case 'not-activated': return <ActivationScreen />
    case 'login':         return <LoginScreen />
    case 'pos':           return <POSScreen />
  }
}
```

---

## Phase 2 — Cashier PIN Login

### 2A. Cashiers Repo (`src/main/database/cashiers.repo.ts`)

```typescript
getCashiers(): Cashier[]
createCashier(input: CreateCashierInput): Cashier   // hashes PIN with SHA-256
validatePin(pin: string): Cashier | null             // returns cashier if PIN matches
updateCashier(input: UpdateCashierInput): Cashier
deleteCashier(id: number): void
```

### 2B. IPC Handlers

```
cashiers:list           → getCashiers()
cashiers:create         → createCashier(input)
cashiers:validate-pin   → validatePin(pin)
cashiers:update         → updateCashier(input)
cashiers:delete         → deleteCashier(id)
```

### 2C. Preload Bridge

```typescript
getCashiers: () => Promise<Cashier[]>
createCashier: (input: CreateCashierInput) => Promise<Cashier>
validatePin: (pin: string) => Promise<Cashier | null>
updateCashier: (input: UpdateCashierInput) => Promise<Cashier>
deleteCashier: (id: number) => Promise<void>
```

### 2D. Login Screen UI (`src/renderer/src/pages/LoginScreen.tsx`)

- Full-screen dark panel matching activation screen style
- Merchant name displayed at top (from stored config)
- **If no cashiers exist**: show "Setup First Cashier" form (name + PIN + confirm PIN)
- **If cashiers exist**: show PIN pad (0-9 grid + backspace + clear)
- PIN entry: 4 dots that fill as digits are entered
- On valid PIN: transition to POS screen with cashier name displayed
- On invalid PIN: shake animation + "Invalid PIN" message
- Three failed attempts: 30-second lockout
- Admin cashiers can access a "Manage Cashiers" panel (add/edit/remove)

### 2E. Auth Store (`src/renderer/src/store/useAuthStore.ts`)

```typescript
type AuthState = {
  appState: 'loading' | 'not-activated' | 'login' | 'pos'
  merchantConfig: MerchantConfig | null
  currentCashier: Cashier | null
  loginAttempts: number
  lockoutUntil: number | null

  // Actions
  initialize: () => Promise<void> // check activation on app start
  activate: (apiKey: string) => Promise<void>
  deactivate: () => Promise<void>
  login: (pin: string) => Promise<boolean>
  logout: () => void
}
```

---

## Shared Types (added to `src/shared/types/index.ts`)

```typescript
export type MerchantConfig = {
  id: number
  stax_api_key: string
  merchant_id: string
  merchant_name: string
  activated_at: string
  updated_at: string
}

export type SaveMerchantConfigInput = {
  stax_api_key: string
  merchant_id: string
  merchant_name: string
}

export type Cashier = {
  id: number
  name: string
  role: 'admin' | 'cashier'
  is_active: number
  created_at: string
}

export type CreateCashierInput = {
  name: string
  pin: string // plain 4-digit PIN, hashed before storage
  role?: 'admin' | 'cashier'
}

export type UpdateCashierInput = {
  id: number
  name?: string
  pin?: string // optional, only if changing PIN
  role?: 'admin' | 'cashier'
  is_active?: number
}
```

---

## How to Test Locally on macOS

### Prerequisites

```bash
cd /Users/harpreetghotra/liquor-pos
npm install
```

### 1. Unit Tests (TDD — write these FIRST)

```bash
# Run all unit tests with coverage
npm run test:coverage

# Watch mode during development
npm run test:watch

# Run specific test file
npx vitest run src/renderer/src/pages/ActivationScreen.test.tsx
```

### 2. Manual Testing with Dev Server

```bash
# Start the Electron app in dev mode
npm run dev

# The app should now show the Activation Screen on first launch
# Enter the Stax sandbox API key from .env to test activation
```

### 3. Test Stax API Key Validation

```bash
# Verify your sandbox key still works:
curl -s -H "Authorization: Bearer $(grep STAX_API_KEY .env | cut -d= -f2-)" \
  https://apiprod.fattlabs.com/self | head -c 200
```

### 4. Reset Activation (start fresh)

```bash
# Delete the SQLite database to reset all local state:
rm -rf ~/Library/Application\ Support/liquor-pos/data/liquor-pos.db

# Or from within the app: Admin → Deactivate (future feature)
```

### 5. E2E Tests

```bash
# Run Playwright tests
npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui
```

### 6. Quality Gate (must pass before committing)

```bash
npm run lint && npm run typecheck && npm run test:coverage
```

---

## Implementation Order (Step by Step)

### Step 1 — Database & Types

1. Add `MerchantConfig`, `Cashier` types to `src/shared/types/index.ts`
2. Add constants to `src/shared/constants.ts`
3. Add `merchant_config` and `cashiers` tables to `src/main/database/schema.ts`
4. Create `merchant-config.repo.ts` and `cashiers.repo.ts`

### Step 2 — Stax Service

1. Create `src/main/services/stax.ts` with `validateApiKey()`
2. Test with sandbox key via a simple script or unit test

### Step 3 — IPC + Preload

1. Add IPC handlers to `src/main/index.ts`
2. Expose through `src/preload/index.ts`
3. Update type definitions in `src/preload/index.d.ts`

### Step 4 — Auth Store (TDD)

1. Write tests for `useAuthStore` first
2. Implement the Zustand store
3. Verify tests pass

### Step 5 — Activation Screen (TDD)

1. Write tests for `ActivationScreen` first
2. Implement the component
3. Update `App.tsx` to route based on auth state
4. **CHECKPOINT**: Run `npm run dev`, verify activation flow works visually

### Step 6 — Login Screen (TDD)

1. Write tests for `LoginScreen` and `PinPad` first
2. Implement components
3. **CHECKPOINT**: Run `npm run dev`, verify full flow: activation → first cashier → PIN login → POS

### Step 7 — Quality Gate

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test:coverage` (must be >= 80%)
4. Visual verification in the app

---

## Security Notes

- **API keys are stored in plain text in SQLite** — acceptable for a desktop POS app where the database is local to the machine. For extra security, consider OS keychain integration in a future phase.
- **PINs are hashed with SHA-256** — not bcrypt, since PINs are only 4 digits (10,000 combinations). The hash prevents casual reading but won't stop a determined attacker with database access. For a local POS terminal, this is standard practice.
- **Lockout after 3 failed PIN attempts** — 30-second cooldown prevents brute force at the terminal.
- **No API key transmitted to renderer** — the key stays in the main process; the renderer only gets the merchant name and ID.

- Visa Success: 4111 1111 1111 1111
- Visa Failure: 4012 8888 888 81881
- MasterCard Success: 5555 5555 5555 4444
- MasterCard Failure: 5105 1051 0510 5100
- Amex Success: 3782 822463 10005
- Amex Failure: 3714 496353 98431
