# Stax Partner Integration Plan

> Extracted from [PROJECT_PLAN.md](../PROJECT_PLAN.md) — the authoritative reference for Stax API integration.

## Business Model

You = **Stax Partner (ISV)**. Each liquor store = a **sub-merchant** under your Partner account.

| Your role | Stax role | Liquor store role |
|---|---|---|
| Platform/ISV (LiquorPOS app) | Payment processor + underwriter | Sub-merchant under your brand |

**Revenue:** When you enroll a merchant, you define their `pricing_plan` (per-txn rate, discount rate). Stax handles billing and pays you a **residual/revenue share** on every transaction your merchants process.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  LiquorPOS App  │────▶│  Your Backend    │────▶│  Stax API   │
│  (Electron)     │     │  (Node.js API)   │     │  Partner    │
│                 │     │  PartnerApiKey   │     │             │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                                               │
        │  ApiKeyAuth (per-merchant)                    │
        └───────────────────────────────────────────────┘
              Direct transaction calls
```

## Auth Model

| Key type | Scope | Usage |
|---|---|---|
| **PartnerApiKey** | All merchants under your brand | Backend server for onboarding, portfolio management |
| **ApiKeyAuth** | Single merchant | Each POS install uses the merchant's own key for transactions |
| **EphemeralAuth** | Temporary, 24hr | Secure one-time actions from the POS client |

---

## Key Stax API Endpoints

### Merchant Onboarding (PartnerApiKey)

| Endpoint | Purpose |
|---|---|
| `POST /admin/enroll` | Create merchant + user + registration in one call; starts underwriting |
| `POST /merchant` | Create a merchant (lightweight) |
| `GET /merchant` | List all merchants in your portfolio |
| `GET /merchant/{id}` | Get store details |
| `POST /merchant/{id}/apikey` | Generate per-merchant API key for POS app |
| `PUT /merchant/{id}/registration` | Update registration/underwriting data |
| `POST /merchant/{id}/registration/file` | Upload KYC documents |

### Payment Processing (ApiKeyAuth per-merchant)

| Endpoint | Purpose |
|---|---|
| `POST /terminal/charge` | Charge via physical card terminal (Dejavoo, etc.) |
| `POST /charge` | Charge a tokenized payment method (keyed entry, card-on-file) |
| `GET /terminal/register` | List connected card reader devices |
| `POST /terminal/void-or-refund` | Void or refund at terminal |
| `GET /surcharge/review` | Check surcharge amount before charging |
| `POST /payment-method/` | Tokenize a card |

### Portfolio Monitoring (PartnerApiKey)

| Endpoint | Purpose |
|---|---|
| `POST /webhookadmin/webhook/brand` | Partner-level webhooks for ALL merchants |
| `GET /query/deposit` | Track settlement batches |
| `GET /query/statistics/teamSummary` | Dashboard stats |
| `GET /transaction` | List/filter all transactions |
| `GET /underwriting/disputes/{merchantId}` | Track chargebacks |

### Branding / White-Label

| Endpoint | Purpose |
|---|---|
| `POST /team/option/branding` | Upload your logo; merchants see YOUR brand |
| `PUT /team/options` | Configure team-level settings |

---

## Webhook Events Available (Brand-Level)

`create_transaction`, `update_transaction`, `update_transaction_settled`, `create_deposit`, `create_dispute`, `update_dispute`, `create_merchant`, `update_merchant_status`, `update_underwriting`, `update_electronic_signature`

---

## Sandbox / Test Environment

Stax uses **one API URL** for both sandbox and production: `https://apiprod.fattlabs.com/`
The sandbox/live distinction is determined by **which API key** you use (sandbox key vs live key).

### Getting Sandbox Access

1. **Merchant Developers:** Request a sandbox account at [https://staxpayments.com/request-sandbox/](https://staxpayments.com/request-sandbox/)
2. **Partner Developers:** Log in to Stax Connect → toggle **Test Mode** in the left menu → create test merchants from there
3. Sandbox accounts connect to a **test gateway** — no real transactions are processed

### Test Card Numbers

| Card Type | Success Card 1 | Success Card 2 |
|---|---|---|
| Visa | `4111111111111111` | `4012888888881881` |
| Mastercard | `5555555555554444` | `5105105105105100` |
| American Express | `378282246310005` | `371449635398431` |
| Discover | `6011111111111117` | `6011000990139424` |

**Test Debit Card (Mastercard):** `2223003122003222`

**Test ACH/Bank:**
- Routing: `021000021`
- Account: `9876543210`

**Failure testing:** Any card number not in the above list will trigger a failure in sandbox. The `Transaction.message` field will read "Unable to process the purchase transaction" (in sandbox) or the real decline reason (in production).

**Card Present testing:** Contact support@fattmerchant.com to set up terminal device testing with your sandbox merchant account.

---

## Implementation Steps

### Step 1: Partner Onboarding
1. Apply to become a Stax Partner/ISV — get `PartnerApiKey` + `brand` identifier
2. Define `pricing_plan`(s) with Stax (your per-transaction markup)
3. Get sandbox credentials for development

### Step 2: Backend Service
1. Build a lightweight Node.js/Express API that holds the `PartnerApiKey`
2. Endpoints: enroll merchant, list merchants, generate merchant API keys
3. Webhook receiver for transaction events & merchant status updates
4. Admin dashboard aggregating volume, revenue share, chargebacks

### Step 3: Merchant Onboarding Flow
1. New store signs up → backend calls `POST /admin/enroll`
2. Stax creates merchant, starts KYC/KYB underwriting
3. Backend calls `POST /merchant/{id}/apikey` for the store's API key
4. POS app is configured with that merchant's API key
5. Webhook `update_merchant_status` notifies when underwriting completes

### Step 4: POS Payment Integration
1. **Terminal flow** (card reader): `POST /terminal/charge` with register_id, total, meta (line items, tax)
2. **Keyed/card-on-file**: `POST /charge` with payment_method_id, total
3. Check `GET /surcharge/review` first if credit surcharging is enabled
4. Store Stax `transaction_id` in local SQLite alongside existing transaction record
5. Handle void/refund via `POST /terminal/void-or-refund`

### Step 5: Revenue & Monitoring
1. Register brand-level webhooks for `create_transaction` + `update_transaction_settled`
2. Backend aggregates: volume per store, your residual revenue, settlement status
3. `GET /query/deposit` for daily reconciliation
4. `GET /underwriting/disputes/{merchantId}` for chargeback monitoring

---

## Related Docs

- [Stax Activation & Login](stax-activation-and-login.md) — Implementation of the merchant activation + cashier PIN login flow
- [Stax API Documentation](https://docs.staxpayments.com/)
- [Stax Connect Overview](https://docs.staxpayments.com/docs/stax-connect-overview)
- [Stax Partner Program](https://staxpayments.com/partners/)
- [Stax Test Environments](https://docs.staxpayments.com/docs/test-environments)
- [Stax Test Card Numbers](https://docs.staxpayments.com/docs/test-card-payment-methods)
- [Request Stax Sandbox](https://staxpayments.com/request-sandbox/)
