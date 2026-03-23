# Stax Integration Map

> All files involved in Stax payment processing. Read before any payment/auth work.

## Flow Overview

```
ActivationScreen → validateApiKey → saveMerchantConfig → login state
LoginScreen → validatePin → pos state
POSScreen → checkout → chargeTerminal → saveTransaction
```

## File Inventory

### Backend

| File | Key exports | Purpose |
|------|-------------|---------|
| `src/main/services/stax.ts` | `validateApiKey`, `getTerminalRegisters`, `chargeTerminal`, `StaxApiError` | Stax Partner API calls |
| `src/main/database/merchant-config.repo.ts` | `getMerchantConfig`, `saveMerchantConfig`, `clearMerchantConfig` | API key + merchant metadata persistence |
| `src/main/database/cashiers.repo.ts` | `getCashiers`, `createCashier`, `validatePin`, `hashPin` | Cashier auth (PIN hashing with crypto) |
| `src/main/database/transactions.repo.ts` | `saveTransaction`, `saveRefundTransaction`, `getRecentTransactions`, `listTransactions` | Transaction recording |

### IPC Channels

- `merchant:get-config` — load stored merchant config
- `merchant:activate` — validate API key with Stax, save config
- `merchant:deactivate` — clear config, return to activation screen
- `cashiers:list/create/validate-pin/update/delete`
- `stax:terminal:registers` — list card readers
- `stax:terminal:charge` — process payment on terminal
- `transactions:save/recent/get-by-number/save-refund/list`

### Renderer

| File | Purpose |
|------|---------|
| `pages/ActivationScreen.tsx` | API key entry + merchant name display |
| `pages/LoginScreen.tsx` | PIN pad + cashier selection |
| `pages/POSScreen.tsx` | Main POS containing cart + checkout |
| `components/payment/PaymentModal.tsx` | Payment method selection, terminal charge |
| `store/useAuthStore.ts` | Auth state machine (loading → not-activated → login → pos) |
| `store/usePosScreen.ts` | Cart state + checkout flow |

### Shared Types

| Type | Purpose |
|------|---------|
| `MerchantConfig` | API key, merchant ID, company name |
| `StaxMerchantInfo` | Stax API response shape |
| `TerminalRegister` | Card reader device info |
| `TerminalChargeInput` | Charge request (amount, payment type, meta) |
| `TerminalChargeResult` | Charge response (txn ID, success, card last 4) |
| `Cashier` | Login credential (role, hashed PIN) |

### Tests

| Test | Covers |
|------|--------|
| `pages/ActivationScreen.test.tsx` | Activation form, API key validation |
| `pages/LoginScreen.test.tsx` | PIN entry, lockout |
| `components/payment/PaymentModal.test.tsx` | Payment flow |
| `store/useAuthStore.test.ts` | State transitions |
| `tests/e2e/startup.spec.ts` | Activation → login E2E |
| `tests/e2e/stax-payments.spec.ts` | Terminal charge E2E |

### Docs

| Doc | Content |
|-----|---------|
| `docs/stax-activation-and-login.md` | Auth flow spec |
| `docs/stax-integration-plan.md` | API endpoints, test cards, webhooks |

## API Details

- Base URL: `https://apiprod.fattlabs.com/`
- Sandbox and production use the same URL (API key determines environment)
- Test cards: Visa `4111111111111111`, Mastercard `5555555555554444`
- Electron app uses `ApiKeyAuth` (per-merchant); `PartnerApiKey` is server-side only
