# Stax Integration Map

> All files involved in Stax payment processing. Read before any payment/auth work.

## Flow Overview

```
ActivationScreen → validateApiKey → saveMerchantConfig → login state
LoginScreen → validatePin → pos state

Phase A (no hardware):
POSScreen → checkout → chargePaymentMethod → saveTransaction

Phase B (terminal on-site):
POSScreen → checkout → chargeTerminal → saveTransaction
```

> Phase A is the active testing path. Phase B activates once the physical card reader is registered. Both paths share the same IPC interface, error handling, and transaction recording — only the stax.ts charge function differs.

## File Inventory

### Backend

| File | Key exports | Purpose |
|------|-------------|---------|
| `src/main/services/stax.ts` | `validateApiKey`, `getTerminalRegisters`, `chargeTerminal`, `StaxApiError` | Stax Pay API calls (Phase B terminal path — implemented). Phase A direct charge functions to be added. |
| `src/main/database/merchant-config.repo.ts` | `getMerchantConfig`, `saveMerchantConfig`, `clearMerchantConfig` | API key + merchant metadata persistence |
| `src/main/database/cashiers.repo.ts` | `getCashiers`, `createCashier`, `validatePin`, `hashPin` | Cashier auth (PIN hashing with crypto) |
| `src/main/database/transactions.repo.ts` | `saveTransaction`, `saveRefundTransaction`, `getRecentTransactions`, `listTransactions` | Transaction recording |

### Planned additions to `stax.ts` (Phase A)

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `createCustomer()` | `POST /customer` | Create throwaway customer for tokenization |
| `createPaymentMethod()` | `POST /payment-method/` | Tokenize a card number → `payment_method_id` |
| `chargePaymentMethod()` | `POST /charge` | Direct charge (no terminal) — for pre-hardware testing |

### IPC Channels

| Channel | Status | Purpose |
|---------|--------|---------|
| `merchant:get-config` | Active | Load stored merchant config |
| `merchant:activate` | Active | Validate API key with Stax, save config |
| `merchant:deactivate` | Active | Clear config, return to activation screen |
| `cashiers:list/create/validate-pin/update/delete` | Active | Cashier management |
| `stax:terminal:registers` | Active | List card readers |
| `stax:terminal:charge` | Active (Phase B) | Process payment on physical terminal |
| `stax:charge:direct` | Planned (Phase A) | Direct API charge for pre-hardware testing |
| `transactions:save/recent/get-by-number/save-refund/list` | Active | Transaction persistence |

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
| `StaxMerchantInfo` | Stax API response shape from `GET /self` |
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
| `docs/stax-integration-plan.md` | API endpoints, account model, two-phase plan, test cards |

## API Details

- Base URL: `https://apiprod.fattlabs.com/`
- Sandbox and production use the same URL (API key determines environment)
- Account type: Stax Pay (direct merchant) — same terminal endpoints as Stax Connect
- Test cards: Visa `4111111111111111`, Mastercard `5555555555554444`
- Electron app uses `ApiKeyAuth` (merchant Bearer token) — stored in main process only, never sent to renderer
