# Finix Payment Integration

**Status:** Complete  
**Updated:** 2026-04-12

---

## Overview

LiquorPOS uses **Finix** for payment processing under the ISV/Platform model. The developer (ISV) holds one set of platform-level API credentials and each liquor store is a sub-Merchant under the ISV's Finix Application. Revenue comes from per-transaction residuals.

**Key decisions:**

- Finix platform credentials stored in **Supabase Vault** (never hardcoded in app or git)
- New merchants are **automatically provisioned** during onboarding via the `provision-finix-merchant` Edge Function
- **Phase A (complete):** Manual card entry — no hardware required
- **Phase B (future):** PAX A920PRO card-present terminal
- **Payment flow:** Auth + immediate capture (two-step)

---

## Architecture

```
Supabase Vault
  ├── FINIX_API_USERNAME      ← ISV platform credential
  ├── FINIX_API_PASSWORD      ← ISV platform credential
  ├── FINIX_APPLICATION_ID   ← ISV Application ID
  └── FINIX_ENVIRONMENT      ← 'sandbox' or 'live'

Supabase DB (merchants table)
  └── finix_merchant_id       ← MUxxxxxxxx, one per liquor store (set during onboarding)

Supabase Edge Functions:
  ├── get-finix-config        ← Returns { finix_merchant_id, api_username, api_password, merchant_name }
  └── provision-finix-merchant ← Creates Finix Identity + Merchant, stores MU ID in DB

Electron Main Process (local SQLite)
  └── merchant_config: { finix_api_username, finix_api_password, merchant_id, merchant_name }
  └── src/main/services/finix.ts   ← Finix service (replaces stax.ts)
  └── IPC handlers in src/main/index.ts

Renderer
  └── BusinessSetupScreen.tsx  ← Business info form (onboarding)
  └── PaymentModal.tsx         ← card form (Phase A) / terminal spinner (Phase B)
```

---

## What the ISV Must Provide

Before implementation, the ISV must collect the following from their Finix sandbox dashboard and store in Supabase Vault:

| Item                  | Format                       | Where to Find                     |
| --------------------- | ---------------------------- | --------------------------------- |
| Platform API Username | `USxxxxxxxxxxxxxxxxxxxxxxxx` | Finix Dashboard → API Credentials |
| Platform API Password | UUID format                  | Finix Dashboard → API Credentials |
| Application ID        | `APxxxxxxxxxxxxxxxxxxxxxxxx` | Finix Dashboard → Application     |

Store in Supabase Vault:

```bash
npx supabase secrets set FINIX_API_USERNAME=USxxxxxxxx
npx supabase secrets set FINIX_API_PASSWORD=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
npx supabase secrets set FINIX_APPLICATION_ID=APxxxxxxxx
npx supabase secrets set FINIX_ENVIRONMENT=sandbox  # or 'live' for production
```

---

## Environments

| Environment | Base URL                                 |
| ----------- | ---------------------------------------- |
| Sandbox     | `https://finix.sandbox-payments-api.com` |
| Production  | `https://finix.live-payments-api.com`    |

All requests use **HTTP Basic Auth**: `username:password`.  
All requests must include header: `Finix-Version: 2022-02-01`.

---

## Finix Resource Model

```
Application (ISV)
  └── Identity (merchant business info + underwriting)
        └── Merchant (MUxxxxxxxx — processing account, onboarding_state: APPROVED)
              └── Device (DVxxxxxxxx — PAX terminal, Phase B only)
                    └── Authorization (AUxxxxxxxx — card-present charge attempt)
                          └── Transfer (TRxxxxxxxx — captured funds movement)
```

---

## Automated Merchant Provisioning

Merchant provisioning happens during onboarding via the `BusinessSetupScreen`:

1. User completes PIN setup → app detects `merchant_id` is empty → shows `BusinessSetupScreen`
2. User fills out business info (name, DBA, type, address, owner details, SSN last 4, EIN)
3. App calls `window.api.finixProvisionMerchant(input)` → IPC → `provisionFinixMerchant()` in supabase.ts
4. Supabase Edge Function `provision-finix-merchant`:
   a. Creates a Finix **Identity** (POST /identities) with business entity data (MCC 5921)
   b. Creates a **Merchant** under the Identity (POST /identities/{id}/merchants) with `processor: DUMMY_V1` (sandbox) or `FINIX_V1` (production)
   c. Updates `merchants.finix_merchant_id` to the new `MUxxxxxxxx`
5. App fetches full Finix credentials via `get-finix-config` Edge Function and saves to local SQLite
6. Merchant transitions: `PROVISIONING` → `APPROVED` (sandbox is instant; production may take hours)

### Auth State Machine Flow

```
loading → auth → set-password → pin-setup → business-setup → distributor-onboarding → login → pos
```

### Sensitive Data Handling

- SSN and EIN are transmitted over HTTPS to the Edge Function, then to Finix API
- They are **never stored** in local SQLite or Supabase DB
- Form state is cleared on component unmount

---

## Payment Flow — Phase A (Manual Card Entry)

No hardware required. Used for pre-terminal testing and as fallback.

```
PaymentModal (card form)
  → window.api.finixChargeCard({ total_cents, person_name, card_number, card_exp, card_cvv })
  → IPC: finix:charge:card
  → finix.ts: chargeWithCard()
      1. POST /payment_instruments   ← tokenize card
      2. POST /authorizations        ← create auth (operation_key: AUTHORIZATION)
      3. PUT  /authorizations/{id}   ← immediate capture (capture_amount = total)
  → Returns FinixChargeResult
  → saveTransaction({ finix_authorization_id, card_last_four, card_type, ... })
```

### Authorization Request Body (Phase A)

```json
{
  "amount": 5000,
  "currency": "USD",
  "payment_instrument": "PIxxxxxxxx",
  "operation_key": "AUTHORIZATION"
}
```

### Capture Request Body

```json
{
  "capture_amount": 5000
}
```

---

## Payment Flow — Phase B (PAX A920PRO Terminal)

Triggered when a device ID is stored in `merchant_config`.

```
PaymentModal (terminal spinner)
  → window.api.finixChargeTerminal({ total_cents, device_id })
  → IPC: finix:charge:terminal
  → finix.ts: chargeTerminal()
      1. POST /authorizations     ← card-present auth (operation_key: CARD_PRESENT_AUTHORIZATION)
      2. PUT  /authorizations/{id} ← immediate capture
  → Returns FinixChargeResult (card details from card_present_details)
  → saveTransaction({ finix_authorization_id, card_last_four, card_type, ... })
```

### Authorization Request Body (Phase B)

```json
{
  "amount": 5000,
  "currency": "USD",
  "device": "DVxxxxxxxx",
  "operation_key": "CARD_PRESENT_AUTHORIZATION"
}
```

### Authorization Response Key Fields

```json
{
  "id": "AUxxxxxxxx",
  "state": "SUCCEEDED",
  "amount": 5000,
  "card_present_details": {
    "brand": "Visa",
    "masked_account_number": "XXXX1111",
    "entry_mode": "CHIP_ENTRY",
    "approval_code": "ABC123"
  },
  "failure_code": null,
  "failure_message": null
}
```

---

## Device Management (Phase B)

### Register a device

```
IPC: finix:device:create
POST /merchants/{merchant_id}/devices
Body: { name, model: "PAX_A920PRO", serial_number, configuration: { allow_debit: true } }
Returns: FinixDevice { id: "DVxxxxxxxx", ... }
Store device_id in local SQLite merchant_config
```

### List devices

```
IPC: finix:devices:list
GET /devices (filtered by merchant)
Returns: FinixDevice[]
```

---

## Void & Refund

### Void (before capture)

```
IPC: finix:void:authorization
PUT /authorizations/{authorization_id}
Body: { void_me: true }
```

### Refund (after capture)

```
IPC: finix:refund:transfer
POST /transfers/{transfer_id}/reversals
Body: { refund_amount: <cents> }
```

---

## IPC Channel Reference

| Channel                    | Direction       | Function                | Phase |
| -------------------------- | --------------- | ----------------------- | ----- |
| `finix:charge:card`        | renderer → main | `chargeWithCard()`      | A     |
| `finix:charge:terminal`    | renderer → main | `chargeTerminal()`      | B     |
| `finix:devices:list`       | renderer → main | `listDevices()`         | B     |
| `finix:device:create`      | renderer → main | `createDevice()`        | B     |
| `finix:void:authorization` | renderer → main | `voidAuthorization()`   | A+B   |
| `finix:refund:transfer`    | renderer → main | `refundTransfer()`      | A+B   |
| `merchant:activate`        | renderer → main | `verifyMerchant()`      | A+B   |
| `merchant:get-config`      | renderer → main | `getMerchantConfig()`   | A+B   |
| `merchant:deactivate`      | renderer → main | `clearMerchantConfig()` | A+B   |

---

## Types (src/shared/types/index.ts)

```typescript
type MerchantConfig = {
  id: number
  finix_api_username: string // platform API username
  finix_api_password: string // platform API password
  merchant_id: string // Finix MUxxxxxxxx
  merchant_name: string
  activated_at: string
  updated_at: string
}

type FinixDevice = {
  id: string // DVxxxxxxxx
  name: string
  model: 'PAX_A800' | 'PAX_A920PRO' | 'D135'
  serial_number: string | null
  enabled: boolean
  merchant: string // MUxxxxxxxx
}

type FinixCardInput = {
  total: number // in cents
  person_name: string
  card_number: string
  card_exp: string // MMYY
  card_cvv: string
  address_zip?: string
}

type FinixTerminalChargeInput = {
  total: number // in cents
  device_id: string // DVxxxxxxxx
}

type FinixChargeResult = {
  authorization_id: string // AUxxxxxxxx
  transfer_id: string // TRxxxxxxxx
  success: boolean
  last_four: string
  card_type: string
  total: number
  message: string
  status: 'approved' | 'declined' | 'error'
}
```

---

## Database Changes

### Supabase Migration

```sql
-- merchants table
ALTER TABLE merchants ADD COLUMN finix_merchant_id TEXT;
UPDATE merchants SET finix_merchant_id = stax_merchant_id WHERE stax_merchant_id IS NOT NULL;
ALTER TABLE merchants DROP COLUMN stax_merchant_id;
ALTER TABLE merchants DROP COLUMN payment_processing_api_key;
```

### Local SQLite (merchant_config)

New columns (via `ensureColumn`):

- `finix_api_username TEXT NOT NULL DEFAULT ""`
- `finix_api_password TEXT NOT NULL DEFAULT ""`
- Remove: `payment_processing_api_key` (existing rows left in place until manual cleanup)

### Local SQLite (transactions)

New column (via `ensureColumn`):

- `finix_authorization_id TEXT` — stores AUxxxxxxxx (replaces `stax_transaction_id` for new records)
- `finix_transfer_id TEXT` — stores TRxxxxxxxx after capture

---

## Files Changed

| File                                                        | Action                                        |
| ----------------------------------------------------------- | --------------------------------------------- |
| `src/main/services/stax.ts`                                 | DELETE                                        |
| `src/main/services/finix.ts`                                | CREATE                                        |
| `src/main/services/supabase.ts`                             | UPDATE — call Edge Function for credentials   |
| `src/main/index.ts`                                         | UPDATE — replace Stax IPC handlers with Finix |
| `src/main/database/schema.ts`                               | UPDATE — new columns                          |
| `src/main/database/merchant-config.repo.ts`                 | UPDATE — field names                          |
| `src/shared/types/index.ts`                                 | UPDATE — remove Stax types, add Finix types   |
| `src/preload/index.ts`                                      | UPDATE — replace Stax bridge methods          |
| `src/preload/index.d.ts`                                    | UPDATE — type signatures                      |
| `src/renderer/src/components/payment/PaymentModal.tsx`      | UPDATE — Phase A card form + Finix mapping    |
| `src/renderer/src/components/payment/PaymentModal.test.tsx` | UPDATE — mocks                                |
| `src/renderer/src/types/pos.ts`                             | UPDATE — PaymentResult                        |
| `src/renderer/src/pages/AuthScreen.tsx`                     | UPDATE — remove Stax branding                 |
| `supabase/migrations/<ts>_stax_to_finix.sql`                | CREATE                                        |
| `supabase/functions/get-finix-config/index.ts`              | CREATE                                        |
| `tests/e2e/finix-payments.spec.ts`                          | CREATE                                        |
| `tests/e2e/stax-payments.spec.ts`                           | DELETE                                        |
| `docs/features/stax-integration.md`                         | DELETE                                        |
| `docs/ai/stax-map.md`                                       | DELETE → `docs/ai/finix-map.md`               |

---

## Testing

### Sandbox Test Cards (Finix)

Use with manual card entry (Phase A):

- Visa: `4111111111111111`, any future exp, any CVV
- Mastercard: `5555555555554444`, any future exp, any CVV

### Coverage Gate

All changes must maintain ≥ 80% coverage (statements, branches, functions, lines):

```bash
npm run test:coverage
npm run test:node:coverage
```

### Smoke Test (sandbox)

1. Log in as test merchant → confirm `merchant_config` populated with Finix credentials
2. Add item to cart, open PaymentModal
3. Enter test Visa card → charge → confirm transaction saved with `finix_authorization_id`
4. Check Finix sandbox dashboard → Authorization + Transfer present and captured

---

## Error Handling

| Finix error                                         | User-facing message                             |
| --------------------------------------------------- | ----------------------------------------------- |
| `state: FAILED`, `failure_code: INSUFFICIENT_FUNDS` | "Card declined — insufficient funds"            |
| `state: FAILED`, any other code                     | "Card declined — please try another card"       |
| HTTP 402                                            | "Payment processor error — please try again"    |
| HTTP 401/403                                        | "Payment configuration error — contact support" |
| Network timeout                                     | "Connection timed out — please try again"       |

Strip the `"Error invoking remote method '...': Error:"` prefix from all IPC error messages before displaying in UI.

---

## Supabase Edge Function Spec

**Name:** `get-finix-config`  
**Trigger:** HTTP POST, authenticated (JWT required)

**Logic:**

1. Extract user ID from JWT via `supabase.auth.getUser()`
2. Query `merchants` table: `SELECT finix_merchant_id, merchant_name WHERE user_id = $uid`
3. Read platform credentials from `Deno.env`: `FINIX_API_USERNAME`, `FINIX_API_PASSWORD`
4. Return `{ finix_merchant_id, api_username, api_password, merchant_name }`

**Error cases:**

- No merchant row found → 404 with message: "Merchant not provisioned — contact support"
- Missing env vars → 500 with message: "Payment configuration error"
