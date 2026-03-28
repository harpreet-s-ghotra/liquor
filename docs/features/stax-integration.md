# Stax Integration Plan

> Authoritative reference for Stax API integration in LiquorPOS.

## Account Model (Updated March 2026)

LiquorPOS is integrated with **Stax Pay** — a direct merchant account under Stax's standard payment processing tier.

> **Context:** Stax Connect (ISV/Partner tier) was the original plan but requires a higher account level than currently approved. Stax Pay provides the same terminal API endpoints and identical transaction flow — the code is the same. Stax Connect remains a future option if the account is upgraded.

| Role | Description |
| ---- | ----------- |
| **LiquorPOS** | Single merchant using Stax Pay for in-person card processing |
| **Stax** | Payment processor — handles authorization, settlement, reporting |
| **Terminal hardware** | Physical card reader (QD/Z Series/IDTech) — ordered, not yet on-site |

## Architecture

```
┌─────────────────┐
│  LiquorPOS App  │
│  (Electron)     │
│                 │
│  main process   │──── Bearer <merchant-api-key> ────▶  Stax API
│  stax.ts        │                                    apiprod.fattlabs.com
└─────────────────┘
```

No backend server required. The Electron main process calls the Stax API directly using the merchant's API key stored in local SQLite.

## Auth Model

| Key type       | Scope            | Where it lives                         |
| -------------- | ---------------- | -------------------------------------- |
| **ApiKeyAuth** | Single merchant  | SQLite `merchant_config` table (main process only — never sent to renderer) |

---

## Payment Flow — Two Phases

### Phase A: Pre-Hardware Testing (Active Now)

Until the physical terminal arrives, test the full payment flow using `POST /charge` with a tokenized payment method. This validates the API key, transaction recording, receipt flow, and error handling end-to-end.

```
1. POST /customer           → create a throwaway test customer
2. POST /payment-method/    → tokenize a demo card number
3. POST /charge             → charge the payment_method_id
4. Record transaction_id in local SQLite
```

This path is synchronous — no polling, immediate response.

### Phase B: Terminal Hardware (When Device Arrives)

Once the physical card reader is registered in the Stax Pay dashboard:

```
1. GET  /terminal/register                          → find default register
2. POST /terminal/charge                            → initiate charge (terminal prompts customer)
3. Poll GET /terminal/{registerId}/status/{txnId}   → wait for approval/decline
4. Record transaction_id in local SQLite
```

> **Code impact:** Phase A and Phase B share the same error handling, result mapping, IPC, and transaction recording. Only the charge call itself changes. The existing `chargeTerminal()` function in `stax.ts` is Phase B. A new `chargePaymentMethod()` function covers Phase A.

---

## Key Stax API Endpoints

### Payment Processing (ApiKeyAuth — active now)

| Endpoint | Purpose |
| -------- | ------- |
| `GET /self` | Validate API key, get merchant info |
| `POST /customer` | Create a customer (required before tokenizing a card) |
| `POST /payment-method/` | Tokenize a card number → returns `payment_method_id` |
| `POST /charge` | Charge a tokenized payment method — Phase A testing |
| `POST /verify` | Verify a payment method without charging |
| `GET /surcharge/review` | Check surcharge amount before charging (if enabled) |

### Terminal (ApiKeyAuth — Phase B, hardware required)

| Endpoint | Purpose |
| -------- | ------- |
| `GET /terminal/register` | List connected card reader devices |
| `POST /terminal/charge` | Charge via physical card terminal |
| `GET /terminal/{registerId}/status/{txnId}` | Poll transaction status |
| `POST /terminal/void-or-refund` | Void or refund at terminal |
| `POST /terminal/tokenize` | Tokenize a card via terminal swipe/dip/tap |

### Transaction Management

| Endpoint | Purpose |
| -------- | ------- |
| `GET /transaction` | List/filter all transactions |
| `GET /transaction/{id}` | Get transaction details |
| `POST /transaction/{id}/void-or-refund` | Void or refund a transaction |
| `GET /query/deposit` | Track settlement batches |

---

## Sandbox / Test Environment

Stax uses **one API URL** for both sandbox and production: `https://apiprod.fattlabs.com/`
The sandbox vs live distinction is determined solely by **which API key** you use.

### Getting Sandbox Access

Request a sandbox merchant account at [https://staxpayments.com/request-sandbox/](https://staxpayments.com/request-sandbox/)

### Test Card Numbers

| Card Type | Success | Failure |
| --------- | ------- | ------- |
| Visa | `4111111111111111` | `4012888888881881` |
| Mastercard | `5555555555554444` | `5105105105105100` |
| American Express | `378282246310005` | `371449635398431` |
| Discover | `6011111111111117` | `6011000990139424` |

**Test Debit Card (Mastercard):** `2223003122003222`

**Test ACH/Bank:**
- Routing: `021000021`
- Account: `9876543210`

**Failure testing:** Any card number not in the list above triggers a decline in sandbox. `Transaction.message` will read "Unable to process the purchase transaction".

**Card Present testing:** Contact support@fattmerchant.com to set up terminal device testing with your sandbox merchant account.

---

## Implementation Steps

### Step 1: Phase A — Direct API Testing (No Hardware)

1. Add `createCustomer()` to `stax.ts` → `POST /customer`
2. Add `createPaymentMethod()` to `stax.ts` → `POST /payment-method/`
3. Add `chargePaymentMethod()` to `stax.ts` → `POST /charge`
4. Wire up new IPC handlers: `stax:charge:direct`
5. Update `PaymentModal` to use direct charge path when no terminal is registered
6. Test end-to-end with demo cards above

### Step 2: Phase B — Terminal Integration (On Hardware Arrival)

1. Pair terminal device in Stax Pay dashboard → device appears in `GET /terminal/register`
2. Existing `chargeTerminal()` in `stax.ts` is already implemented and correct
3. Update `PaymentModal` to prefer terminal path when a register is available
4. Test with physical card reader using demo cards

### Step 3: Void / Refund

1. Add `voidOrRefund()` to `stax.ts` → `POST /transaction/{id}/void-or-refund`
2. Wire IPC: `stax:transaction:void-or-refund`
3. Expose refund button in transaction history

### Step 4: Revenue & Monitoring (Future)

If Stax Connect is approved in future:
- Register brand-level webhooks for `create_transaction` + `update_transaction_settled`
- Build backend aggregation for volume, residuals, settlements
- `GET /query/deposit` for daily reconciliation

---

## Charge API Response Shape

Full response shape returned by `POST /charge` on success. Fields are documented with their type, an example value, and notes on how they are used in LiquorPOS.

| Field | Type | Example | Notes |
| ----- | ---- | ------- | ----- |
| `id` | string (UUID) | `"5077d158-fe50-4c6a-ac40-6eb0657894ae"` | Stax transaction ID — store as `stax_transaction_id` in local `transactions` table |
| `type` | string | `"charge"` | Always `"charge"` for this endpoint |
| `success` | boolean | `true` | Primary indicator of whether the payment completed — check this first |
| `message` | string \| null | `null` | Human-readable result message — show to cashier on failure |
| `error_description` | string \| null | `null` | Detailed error text (e.g. rate limit message) — show to cashier when `success` is false |
| `total` | number | `22.59` | Amount charged in dollars — verify this matches the cart total |
| `method` | string | `"card"` | Payment method type — `"card"`, `"bank"`, etc. |
| `last_four` | string | `"1111"` | Last four digits of the card — top-level shortcut; prefer `payment_method.card_last_four` for display |
| `status` | string | `"APPROVED"` | Transaction status — `"APPROVED"`, `"FAILED"`, or `"VOIDED"`; useful for transaction history display |
| `is_captured` | number (0/1) | `1` | Whether funds have been captured; `1` means captured |
| `is_voided` | boolean | `false` | Whether the transaction has been voided |
| `is_voidable` | boolean | `true` | Whether a void is still possible — needed to conditionally show the void action in Phase B |
| `is_refundable` | boolean | `false` | Whether a standard refund is available |
| `is_cnp_refundable` | boolean | `true` | Whether a card-not-present refund is available |
| `total_refunded` | number | `0` | Total amount refunded so far in dollars |
| `settled_at` | string \| null | `null` | ISO datetime when the transaction settled; null until batch closes |
| `batched_at` | string \| null | `"2026-03-23 03:04:07"` | ISO datetime when the transaction was added to a settlement batch |
| `created_at` | string | `"2026-03-23 03:00:31"` | ISO datetime of transaction creation — store as the transaction timestamp |
| `currency` | string | `"USD"` | Currency code |
| `issuer_auth_code` | string | `""` | Auth code returned by the card issuer; may be empty |
| `avs_code` | string \| null | `null` | Address verification code; not always present |
| `avs_message` | string \| null | `null` | Human-readable AVS result |
| `cvv_code` | string \| null | `null` | CVV verification code; not always present |
| `cvv_message` | string \| null | `null` | Human-readable CVV result |
| `merchant_id` | string (UUID) | `"1fa011ae-7aab-4f66-922b-779f8384122d"` | Stax merchant identifier |
| `customer_id` | string (UUID) | `"c944aa83-deb6-4488-a4fe-1fb368145f03"` | Stax customer record ID |
| `payment_method_id` | string (UUID) | `"9a1ba843-a581-4e8a-9b25-d53fc9992ced"` | ID of the tokenized payment method used |
| `invoice_id` | string | `""` | Stax invoice reference; empty for direct charges |
| `schedule_id` | string \| null | `null` | Recurring schedule ID; null for one-time charges |
| `payment_method.id` | string (UUID) | `"9a1ba843-a581-4e8a-9b25-d53fc9992ced"` | Same as `payment_method_id` |
| `payment_method.card_type` | string | `"visa"` | Card network — `"visa"`, `"mastercard"`, `"amex"`, etc. — store as `card_type` |
| `payment_method.card_last_four` | string | `"1111"` | Last four digits of the card — store as `card_last_four` |
| `payment_method.card_exp` | string | `"122030"` | Expiry in `MMYYYY` format |
| `payment_method.bin_type` | string | `"CREDIT"` | `"CREDIT"` or `"DEBIT"` |
| `payment_method.person_name` | string | `"Test Customer"` | Cardholder name |
| `payment_method.is_tokenized` | boolean | `true` | Whether the card is stored as a token in Stax |
| `payment_method.card_exp_datetime` | string | `"2030-12-31 23:59:59"` | Expiry as a full datetime string |

### Fields We Store

| Response Field | Local Column | Table | Notes |
| -------------- | ------------ | ----- | ----- |
| `id` | `stax_transaction_id` | `transactions` | Primary Stax reference; used for void/refund in Phase B |
| `payment_method.card_last_four` | `card_last_four` | `transactions` | Displayed on receipt and transaction history |
| `payment_method.card_type` | `card_type` | `transactions` | Displayed on receipt (e.g. "Visa ****1111") |
| `success` | — | — | Not stored; used at call time to determine if payment completed and whether to finalize the sale |
| `message` / `error_description` | — | — | Not stored; shown to cashier in the `PaymentModal` error state when `success` is false |
| `is_voidable` | — | — | Not stored at this time; will be needed in Phase B to conditionally enable the void action |
| `status` | — | — | Not stored at this time; `"APPROVED"` / `"FAILED"` / `"VOIDED"` will be useful for transaction history in a future phase |

### Sandbox Rate Limiting

Stax sandbox enforces a "Max attempts exceeded" policy after multiple charges on the same payment method within a short time window.

- The `error_description` field contains the rate limit message when this occurs (e.g. `"Max attempts exceeded"`); `success` will be `false`.
- To avoid hitting this limit during development: create a fresh customer and payment method for each test session using `POST /customer` + `POST /payment-method/`, rather than reusing a previously tokenized card.
- Alternatively, wait approximately 5 minutes between test charges on the same payment method.
- This restriction applies to sandbox only and is not present in production.

---

## Related Docs

- [Stax Activation & Login](stax-activation.md) -- merchant activation + cashier PIN login flow
- [Stax API Documentation](https://docs.staxpayments.com/)
- [Stax Test Environments](https://docs.staxpayments.com/docs/test-environments)
- [Stax Test Card Numbers](https://docs.staxpayments.com/docs/test-card-payment-methods)
- [Request Stax Sandbox](https://staxpayments.com/request-sandbox/)
