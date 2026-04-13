# Supabase Auth & Distributor Onboarding

> Phase A of the cloud integration. Replaces manual API key entry with Supabase email/password auth and adds a guided first-run onboarding flow.

## Implementation Status

### Completed

- [x] Supabase project created; all three tables exist in production (`merchants`, `catalog_distributors`, `catalog_products`)
- [x] RLS policies applied to all three tables
- [x] Finix merchant credentials flow through the onboarding path and local merchant config persistence
- [x] NYSLA catalog uploaded via `scripts/upload-catalog.ts` (~80K+ products from 709 CSV files)
- [x] Supabase client in main process (`src/main/services/supabase.ts`) with file-based auth token storage
- [x] IPC channels: `auth:login`, `auth:logout`, `auth:check-session`, `auth:set-session`, `auth:set-password`, `catalog:distributors`, `catalog:import`
- [x] All channels exposed via preload (`src/preload/index.ts` + `src/preload/index.d.ts`)
- [x] `AuthScreen` — email + password sign-in
- [x] `SetPasswordScreen` — used after accepting an email invite; calls `auth:set-password`
- [x] `PinSetupScreen` — creates one admin cashier + one cashier cashier via `createCashier`
- [x] `DistributorOnboardingScreen` — searchable distributor list, checkbox selection, import progress
- [x] Auth state machine updated: `loading → auth → set-password → pin-setup → distributor-onboarding → login → pos`
- [x] `App.tsx` routes all six states to the correct screen
- [x] Deep link handler: `liquorpos://auth/callback#access_token=...&refresh_token=...` opens `SetPasswordScreen`
  - macOS: `app.on('open-url')`
  - Windows: `app.requestSingleInstanceLock()` + `app.on('second-instance')`
- [x] `seed.ts` emptied — no hardcoded products or distributors are inserted on a fresh database
- [x] SQLite migrations preserve legacy Stax/payment-key columns and hydrate the current Finix credential fields in `merchant_config`
- [x] Unit tests written for `AuthScreen`, `PinSetupScreen`, `DistributorOnboardingScreen` (renderer coverage ≥ 80%)

### Pending / Not Yet Tested

- [x] **End-to-end fresh onboarding flow verified** (2026-03-30) — Full flow tested: AuthScreen → SetPasswordScreen → PinSetupScreen → DistributorOnboardingScreen → LoginScreen → POS.

- [ ] **Supabase redirect URL not configured** — Add `liquorpos://auth/callback` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Required for email invite deep links to work.

- [x] **Email invite flow tested** (2026-03-30) — Invite email → deep link → SetPasswordScreen → completes onboarding.

- [x] **Minor cleanup**: legacy payment-provider naming removed from the Supabase auth path.

- [x] **IPC error prefix stripping** (2026-03-30) — Added `stripIpcPrefix()` utility in `utils/ipc-error.ts`. Applied in `useAuthStore`, `PinSetupScreen`, and `DistributorOnboardingScreen` so raw Electron IPC error prefixes are never shown to users.

---

## How to Invite a Merchant

Two flows are supported:

1. Manual Supabase dashboard invite: the user opens the email, sets a password in the app, and the desktop main process auto-creates the `merchants` row if `SUPABASE_SERVICE_ROLE_KEY` is available locally.
2. Provisioning script: use this when you want the auth user and `merchants` row created together before the user opens the invite.

```bash
npx tsx scripts/invite-merchant.ts --email owner@example.com --name "Test Store"
```

Optional:

- `--finix-merchant-id <id>` to override the default Finix merchant id used for local testing.
- Re-run the same command with an already invited email to repair a missing `merchants` row without sending a duplicate invite.

### Local testing without invite email

For non-email testing, `scripts/create-test-merchant.ts` still creates a confirmed auth user plus a `merchants` row directly.

---

## Overview

When a merchant first launches the app (or has no valid session), they go through a linear onboarding sequence:

```
Auth (email + password)  [or email invite → Set Password]
  → PIN Setup (admin account + one cashier account)
  → Distributor Onboarding (select distributors → import catalog items)
  → Login (PIN pad) → POS
```

On subsequent launches with a valid Supabase session, the app skips directly to whichever step is incomplete, or goes straight to the PIN login screen if fully set up.

---

## Auth State Machine

```
loading → auth → set-password → pin-setup → distributor-onboarding → login → pos
```

| State                    | Screen                        | Condition                                                              |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| `loading`                | Loading spinner               | App startup                                                            |
| `auth`                   | `AuthScreen`                  | No valid Supabase session                                              |
| `set-password`           | `SetPasswordScreen`           | App opened via email invite deep link; session set but no password yet |
| `pin-setup`              | `PinSetupScreen`              | Session valid, but no cashiers in local SQLite                         |
| `distributor-onboarding` | `DistributorOnboardingScreen` | Cashiers exist, but no products in local SQLite                        |
| `login`                  | `LoginScreen`                 | Fully set up — merchant enters cashier PIN                             |
| `pos`                    | `POSScreen`                   | Cashier authenticated                                                  |

Transition logic lives in `useAuthStore.ts` → `resolvePostAuthState()`.

---

## Backend: Supabase

### Tables

**`merchants`** — one row per merchant account (provisioned by the invite script / ISV tooling)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  finix_api_username text,
  finix_api_password text,
  merchant_name text NOT NULL,
  finix_merchant_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own merchant record"
  ON merchants FOR SELECT
  USING (auth.uid() = user_id);
```

RLS: users can only read their own row (`auth.uid() = user_id`).

**`catalog_distributors`** — master distributor list (populated from NYSLA CSVs)

```sql
CREATE TABLE catalog_distributors (
  distributor_id integer PRIMARY KEY,
  distributor_name text NOT NULL,
  distributor_permit_id text,
  county text,
  post_type text
);

ALTER TABLE catalog_distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catalog distributors"
  ON catalog_distributors FOR SELECT TO authenticated USING (true);
```

`post_type` values: `'LR'` (liquor) or `'WR'` (wine). RLS: read-only for all authenticated users.

**`catalog_products`** — master product catalog (~80K+ rows from NYSLA price lists)

```sql
CREATE TABLE catalog_products (
  id serial PRIMARY KEY,
  distributor_id integer REFERENCES catalog_distributors(distributor_id),
  nys_item text,
  ttb_id text,
  brand_name text,
  prod_name text NOT NULL,
  beverage_type text,
  bev_type_code text,
  item_type text,
  item_size text,
  unit_of_measure text,
  bottles_per_case integer,
  proof real,
  alcohol_pct real,
  vintage text,
  bot_price real,
  case_price real,
  post_type text
);

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catalog products"
  ON catalog_products FOR SELECT TO authenticated USING (true);
```

Column notes:

- `item_type` is populated from the CSV `beverage_type` column during upload
- `bot_price` = per-bottle cost; `case_price` = per-case cost
- `ttb_id` is used as `sku` when importing into the local products table

RLS: read-only for all authenticated users.

### Auth

- Email/password sign-in via Supabase Auth
- Email invite flow: ISV sends a manual Supabase invite or runs `scripts/invite-merchant.ts` → user clicks email link → app opens via `liquorpos://auth/callback` deep link → `SetPasswordScreen` → the app ensures the `merchants` row exists before continuing.
- Session tokens stored in `userData/supabase-auth.json` (custom file-based storage — Node.js has no localStorage)
- Auto-refresh on app start via `supabaseCheckSession()`

Important:

- The live `merchants` RLS allows read access for `auth.uid() = user_id` but blocks self-insert.
- To make manual invites frictionless, the desktop main process loads `.env` and repairs a missing `merchants` row with `SUPABASE_SERVICE_ROLE_KEY` during sign-in / set-password / session restore.
- If `SUPABASE_SERVICE_ROLE_KEY` is not available locally, manual invites still require pre-provisioning via `scripts/invite-merchant.ts`.

---

## IPC Channels

| Channel                | Handler                                                    | Returns                |
| ---------------------- | ---------------------------------------------------------- | ---------------------- |
| `auth:login`           | `supabaseSignIn` + fetch merchant                          | `AuthResult`           |
| `auth:logout`          | `supabaseSignOut`                                          | `void`                 |
| `auth:check-session`   | `supabaseCheckSession` + fetch merchant                    | `AuthResult \| null`   |
| `auth:set-session`     | `supabaseSetSession` — exchanges invite tokens for session | `{ email: string }`    |
| `auth:set-password`    | `supabaseSetPassword` — sets password, fetches merchant    | `AuthResult`           |
| `catalog:distributors` | `getCatalogDistributors`                                   | `CatalogDistributor[]` |
| `catalog:import`       | Fetch from Supabase + bulk insert SQLite                   | `ImportResult`         |

### `catalog:import` flow

1. Accept `distributorIds: number[]` from renderer
2. Fetch matching `catalog_products` from Supabase (paginated, 1000 rows/batch)
3. Create local `distributors` rows if not existing (`INSERT OR IGNORE`)
4. Map catalog fields → local `products` schema:
   - `sku`: `ttb_id?.trim() || 'CAT-{id}'`
   - `name`: `prod_name`
   - `size`: `item_size + unit_of_measure`
   - `item_type`: `item_type` (sourced from `beverage_type` in upload script)
   - `price` / `retail_price` / `in_stock`: 0 (merchant sets later)
   - `cost` / `case_cost`: `bot_price` / `case_price`
5. Bulk insert via `db.transaction()` with `INSERT OR IGNORE` (idempotent)
6. Return `{ imported: count, distributors_created: count }`

---

## New Pages

| Page                          | File                                    | Purpose                                          |
| ----------------------------- | --------------------------------------- | ------------------------------------------------ |
| `AuthScreen`                  | `pages/AuthScreen.tsx`                  | Email + password login form                      |
| `SetPasswordScreen`           | `pages/SetPasswordScreen.tsx`           | Set password after accepting email invite        |
| `PinSetupScreen`              | `pages/PinSetupScreen.tsx`              | Create admin account + one cashier account       |
| `DistributorOnboardingScreen` | `pages/DistributorOnboardingScreen.tsx` | Select distributors → import catalog into SQLite |

All four share `styles/auth.css` for layout.

---

## Service File

`src/main/services/supabase.ts` — Supabase client for the Electron main process:

- Custom file-based auth storage (no localStorage in Node); tokens saved to `userData/supabase-auth.json`
- Exports: `initializeSupabaseService`, `supabaseSignIn`, `supabaseSignOut`, `supabaseCheckSession`, `supabaseSetSession`, `supabaseSetPassword`, `getCatalogDistributors`, `getCatalogProductsByDistributors`
- Credentials: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are hardcoded constants (anon key is intentionally public; protected by RLS)
- `fetchAndSaveMerchant` saves the merchant's Finix credentials and merchant identifiers to the local `merchant_config` SQLite table

`src/main/services/merchant-provisioning.ts` — merchant provisioning helpers:

- `provisionMerchantInvite()` sends or repairs an invite and upserts the `merchants` row using the service role client
- `provisionMerchantForUser()` repairs a missing `merchants` row for an already-authenticated invited user
- `deriveMerchantNameFromEmail()` creates a readable default merchant name when none is provided

`scripts/invite-merchant.ts` — operational entry point for inviting merchants:

- Sends the Supabase invite email with `redirectTo: liquorpos://auth/callback`
- Upserts the matching `merchants` row before the user opens the invite
- Repairs existing auth users that are missing a `merchants` row

---

## Deep Link Handler

Registered protocol: `liquorpos://`

When the app receives `liquorpos://auth/callback#access_token=...&refresh_token=...&type=invite`:

1. Main process parses the hash fragment
2. Sends `auth:deep-link` IPC event to the renderer window
3. `App.tsx` listens via `window.api.onDeepLink(...)` and calls `handleInviteLink(accessToken, refreshToken)`
4. `useAuthStore.handleInviteLink` calls `auth:set-session` IPC → Supabase session is established
5. App transitions to `set-password` state → `SetPasswordScreen` shown

macOS: handled via `app.on('open-url')`.
Windows: handled via `app.requestSingleInstanceLock()` + `app.on('second-instance')`.

---

## Catalog Upload Script

`scripts/upload-catalog.ts` — run once to populate Supabase from NYSLA CSV files:

- Parses 709 CSVs from `data/lr/` (198 files) and `data/wr/` (511 files)
- Uses `csv-parse/sync` with `relax_quotes: true` and `relax_column_count: true` to handle malformed distributor names with embedded quotes
- Maps CSV `beverage_type` column → `item_type` in `catalog_products`
- Upserts unique distributors to `catalog_distributors` (on conflict do nothing)
- Batch-inserts all products to `catalog_products` (500 rows/batch)
- Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars

Run with:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/upload-catalog.ts
```

---

## SQLite Migrations

`schema.ts` runs these one-time migrations on every app start (idempotent):

- `migrateVendorsToDistributors` — renames the `vendors` table to `distributors` and updates all FK references
- `migrateStaxApiKey` — preserves compatibility with older local merchant config rows

---

## Out of Scope (Phase B)

- Cloud sync of transactions across registers
- Multi-register inventory sync via Supabase Realtime
- Offline queue + reconnection logic
- Web admin for merchant account management
- Merchant self-service sign-up (currently ISV manually creates accounts in Supabase dashboard)
- Admin portal for uploading updated NYSLA price lists (currently a manual script run)
- Price list refresh / re-import after initial onboarding (importing new distributor catalogs after setup is done)
