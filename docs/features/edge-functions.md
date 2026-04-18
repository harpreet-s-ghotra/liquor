# Supabase Edge Functions

All Edge Functions live in `supabase/functions/` and run as Deno serverless functions on the Supabase platform. They act as the secure bridge between the Electron client and third-party services (Finix) so that platform-level API credentials never leave the server.

## Functions Overview

| Function                   | Purpose                                         | Auth                               | Called From                            |
| -------------------------- | ----------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `invite-merchant`          | Create merchant row + send Supabase invite      | `INVITE_ADMIN_SECRET` bearer token | Admin CLI / scripts                    |
| `provision-finix-merchant` | Create Finix Identity + Bank Account + Merchant | Supabase JWT (user session)        | `BusinessSetupScreen` via IPC          |
| `get-finix-config`         | Return Finix API creds + merchant ID            | Supabase JWT (user session)        | App startup via `fetchAndSaveMerchant` |

## Deployment

```bash
# Deploy a single function
npx supabase functions deploy <function-name>

# Deploy all functions
npx supabase functions deploy

# List deployed functions
npx supabase functions list

# View logs
npx supabase functions logs <function-name>
```

## Required Secrets

Set via `npx supabase secrets set KEY=VALUE`. All three functions share the same secret store.

| Secret                      | Used By                                        | Description                                        |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `FINIX_API_USERNAME`        | `provision-finix-merchant`, `get-finix-config` | Platform-level Finix API key username              |
| `FINIX_API_PASSWORD`        | `provision-finix-merchant`, `get-finix-config` | Platform-level Finix API key password              |
| `FINIX_APPLICATION_ID`      | `provision-finix-merchant`                     | Finix Application ID (tags created identities)     |
| `FINIX_ENVIRONMENT`         | `provision-finix-merchant`                     | `sandbox` or `live` — controls API URL + processor |
| `INVITE_ADMIN_SECRET`       | `invite-merchant`                              | Shared secret for admin-only invite endpoint       |
| `SUPABASE_URL`              | All (auto-injected)                            | Supabase project URL                               |
| `SUPABASE_ANON_KEY`         | All (auto-injected)                            | Supabase anon/public key                           |
| `SUPABASE_SERVICE_ROLE_KEY` | `invite-merchant`, `provision-finix-merchant`  | Bypasses RLS for admin writes                      |

### Current Sandbox Values

```
FINIX_API_USERNAME = USuH7QbBi3u3fBgQbSo5FA6E
FINIX_APPLICATION_ID = AP7EJ1mTFmKiEMxBvZW4sCUh
FINIX_ENVIRONMENT = sandbox
```

(Passwords/service keys are not documented here — see `npx supabase secrets list` for digests.)

---

## Function Details

### `invite-merchant`

**File:** `supabase/functions/invite-merchant/index.ts`

Creates a new merchant in the system. Steps:

1. Validates `INVITE_ADMIN_SECRET` from the `Authorization: Bearer` header
2. Checks if a Supabase auth user already exists for the given email
3. If not, sends an invite email via `admin.auth.admin.inviteUserByEmail()`
4. Upserts a row in the `merchants` table with `user_id` and `merchant_name`

**Request:**

```bash
curl -X POST https://<project>.supabase.co/functions/v1/invite-merchant \
  -H "Authorization: Bearer <INVITE_ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@store.com", "merchantName": "Corner Bottle Shop"}'
```

**Response (200):**

```json
{ "success": true, "userId": "uuid", "merchantName": "Corner Bottle Shop", "invited": true }
```

---

### `provision-finix-merchant`

**File:** `supabase/functions/provision-finix-merchant/index.ts`

The core onboarding function. Called when a merchant submits the Business Setup form. Creates all required Finix resources for the merchant to process payments.

**Flow:**

1. **Authenticate** — verifies Supabase JWT from the user's session
2. **Create Finix Identity** — `POST /identities` with business info, owner details, DOB, tax ID, MCC `5921` (liquor stores)
3. **Tag Identity** — `PUT /identities/{id}` with `application_id` tag
4. **Create Bank Account** — `POST /payment_instruments` with type `BANK_ACCOUNT` for settlement
5. **Create Merchant** — `POST /identities/{id}/merchants` with processor (`DUMMY_V1` for sandbox, `FINIX_V1` for live)
6. **Store result** — updates `merchants.finix_merchant_id` in Supabase via service role client

**Request:** Called internally via `window.api.finixProvisionMerchant(businessInfoInput)` which hits:

```
POST https://<project>.supabase.co/functions/v1/provision-finix-merchant
Authorization: Bearer <user-jwt>
Body: BusinessInfoInput JSON
```

**Response (200):**

```json
{ "finix_merchant_id": "MU...", "merchant_name": "Corner Spirits" }
```

**Error responses:** 401 (unauthorized), 400 (missing fields), 502 (Finix API error with `finix_error` detail)

---

### `get-finix-config`

**File:** `supabase/functions/get-finix-config/index.ts`

Returns the platform's Finix API credentials and the merchant's Finix ID to the Electron app. Called on every app startup to populate the local `merchant_config` SQLite table.

**Flow:**

1. Authenticates via Supabase JWT
2. Queries `merchants` table for the user's `finix_merchant_id`
3. Returns the platform API credentials (from secrets) + merchant ID

**Response (200):**

```json
{
  "finix_merchant_id": "MU...",
  "api_username": "US...",
  "api_password": "...",
  "merchant_name": "Corner Spirits"
}
```

**Error responses:** 401 (unauthorized), 404 (no merchant row), 422 (`finix_merchant_id` is null — not yet provisioned), 500 (secrets not configured)

**Security note:** The platform API credentials are stored as Supabase secrets and only returned to authenticated users who have a merchant row. They are never hardcoded in the Electron app.

---

## Data Flow: Onboarding to First Transaction

```
1. Admin invites merchant
   invite-merchant → creates auth user + merchants row (finix_merchant_id = NULL)

2. Merchant opens app, authenticates via Supabase
   App sees finix_merchant_id is NULL → shows BusinessSetupScreen

3. Merchant fills business form and submits
   provision-finix-merchant → creates Identity + Bank Account + Merchant in Finix
   → stores finix_merchant_id in Supabase merchants table

4. App fetches config
   get-finix-config → returns API creds + merchant ID
   → saved to local SQLite merchant_config table

5. Merchant processes a card payment
   Electron main process → chargeWithCard() in finix.ts
   → POST /identities (buyer) → POST /payment_instruments (card)
   → POST /authorizations → POST /authorizations/{id}/captures
   All against Finix API using the platform credentials + merchant ID
```

---

## Switching from Sandbox to Live Payments

When Finix approves the application for live processing, the following changes are required:

### 1. Supabase Secrets (Server-Side)

```bash
npx supabase secrets set \
  FINIX_API_USERNAME=<live-api-username> \
  FINIX_API_PASSWORD=<live-api-password> \
  FINIX_APPLICATION_ID=<live-application-id> \
  FINIX_ENVIRONMENT=live
```

This controls:

- **API URL:** `provision-finix-merchant` switches from `finix.sandbox-payments-api.com` to `finix.live-payments-api.com`
- **Processor:** merchant creation uses `FINIX_V1` instead of `DUMMY_V1`

### 2. Electron App Environment Variable

In `src/main/services/finix.ts`, the base URL defaults to sandbox:

```typescript
const FINIX_API_URL = process.env.FINIX_API_URL ?? 'https://finix.sandbox-payments-api.com'
```

For production builds, set the environment variable:

```
FINIX_API_URL=https://finix.live-payments-api.com
```

This can be set in `electron-builder.yml` or the build CI environment. Alternatively, the app could read this from the `get-finix-config` response (future enhancement).

### 3. Re-Provision All Merchants

Existing sandbox merchants **do not carry over to live**. Every merchant must re-run the Business Setup flow so `provision-finix-merchant` creates new Finix resources under the live application.

**Steps:**

1. Clear `finix_merchant_id` in Supabase `merchants` table for all users
2. Clear `merchant_config` in each POS terminal's local SQLite DB
3. On next app launch, each merchant sees the Business Setup screen and re-provisions

### 4. Remove Test Cards from PaymentModal

The `TEST_CARDS` constant in `PaymentModal.tsx` is sandbox-only. In production:

- **Phase A (manual card entry):** replace with a real card input form, or remove entirely if only using terminals
- **Phase B (card-present terminals):** the PAX terminal handles card data — no changes needed

### 5. Checklist

| Item                   | Where                         | Change                                              |
| ---------------------- | ----------------------------- | --------------------------------------------------- |
| Finix API credentials  | Supabase secrets              | Set live username/password                          |
| Finix Application ID   | Supabase secrets              | Set live application ID                             |
| Finix environment flag | Supabase secrets              | `FINIX_ENVIRONMENT=live`                            |
| Finix API URL          | `finix.ts` / build env        | `FINIX_API_URL=https://finix.live-payments-api.com` |
| Merchant data          | Supabase + local SQLite       | Clear and re-provision                              |
| Test cards             | `PaymentModal.tsx`            | Remove `TEST_CARDS` or replace with card input UI   |
| Buyer identity email   | `finix.ts` `chargeWithCard()` | Replace placeholder `customer@example.com`          |

### 6. What Does NOT Change

- Edge Function code — `provision-finix-merchant` and `get-finix-config` are environment-aware via the `FINIX_ENVIRONMENT` secret
- IPC handlers — same `finix:charge:card` and `finix:charge:terminal` channels
- Local DB schema — `merchant_config` table structure is identical
- Auth flow — Supabase auth and session management are payment-agnostic
