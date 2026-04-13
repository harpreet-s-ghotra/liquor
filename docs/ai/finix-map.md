# Finix Integration Map

> All files involved in Finix payment processing. Read before any payment or refund work.

## Flow Overview

```
AuthScreen / invite flow → Supabase session → merchant config saved locally

Onboarding:
PinSetupScreen → BusinessSetupScreen → provisionFinixMerchant → DistributorOnboarding

Phase A (active):
POSScreen → PaymentModal → finixChargeCard → saveTransaction

Refunds:
POSScreen → finixRefundTransfer → saveRefundTransaction

Phase B (planned):
POSScreen → finixChargeTerminal / finixCreateDevice / finixListDevices
```

## File Inventory

### Backend

| File                                                   | Key exports                                                              | Purpose                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `src/main/services/finix.ts`                           | `verifyMerchant`, `chargeWithCard`, `refundTransfer`, `listDevices`      | Finix API access for charges, refunds, verification, devices |
| `src/main/database/merchant-config.repo.ts`            | `getMerchantConfig`, `saveMerchantConfig`, `clearMerchantConfig`         | Finix credential + merchant metadata persistence             |
| `src/main/database/transactions.repo.ts`               | `saveTransaction`, `saveRefundTransaction`, `getRecentTransactions`      | Persists Finix authorization/transfer references             |
| `src/main/services/supabase.ts`                        | `fetchAndSaveMerchant`, `provisionFinixMerchant`, `supabaseCheckSession` | Pulls merchant config and provisions Finix merchants         |
| `supabase/functions/provision-finix-merchant/index.ts` | Edge Function                                                            | Creates Finix Identity + Merchant, updates DB                |
| `supabase/functions/get-finix-config/index.ts`         | Edge Function                                                            | Returns Finix credentials from Vault                         |

### IPC Channels

| Channel                    | Status            | Purpose                                |
| -------------------------- | ----------------- | -------------------------------------- |
| `merchant:get-config`      | Active            | Load stored merchant config            |
| `merchant:verify-finix`    | Active            | Verify merchant Finix credentials      |
| `finix:provision-merchant` | Active            | Auto-provision Finix Identity+Merchant |
| `finix:charge:card`        | Active            | Process Finix Phase A card payments    |
| `finix:refund:transfer`    | Active            | Refund a prior Finix transfer          |
| `finix:devices:list`       | Planned (Phase B) | List card readers                      |
| `finix:devices:create`     | Planned (Phase B) | Create/register devices                |
| `finix:charge:terminal`    | Planned (Phase B) | Process payment on a physical terminal |

### Renderer

| File                                  | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `pages/POSScreen.tsx`                 | Main POS flow, sale save, refund initiation            |
| `pages/BusinessSetupScreen.tsx`       | Business info form for Finix merchant provisioning     |
| `components/payment/PaymentModal.tsx` | Payment method selection and Finix Phase A charge flow |
| `store/useAuthStore.ts`               | Auth/session bootstrap into POS                        |
| `App.tsx`                             | Deep-link consumption and auth-state routing           |

### Shared Types

| Type                      | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `MerchantConfig`          | Finix credentials, merchant identifiers, company name                   |
| `BusinessInfoInput`       | Business info for Finix Identity creation during onboarding             |
| `ProvisionMerchantResult` | Result of merchant provisioning (finix_merchant_id, merchant_name)      |
| `FinixCardInput`          | Phase A card charge input                                               |
| `FinixChargeResult`       | Charge response including authorization and transfer ids                |
| `SavedTransaction`        | Local transaction with `finix_authorization_id` and `finix_transfer_id` |

### Tests

| Test                                       | Covers                                  |
| ------------------------------------------ | --------------------------------------- |
| `pages/BusinessSetupScreen.test.tsx`       | Business setup form and provisioning    |
| `store/useAuthStore.test.ts`               | Auth state machine incl. business-setup |
| `components/payment/PaymentModal.test.tsx` | Finix payment flow                      |
| `pages/POSScreen.test.tsx`                 | Refund flow and transaction saving      |
| `tests/e2e/finix-payments.spec.ts`         | Finix Phase A payment E2E               |
| `tests/e2e/transactions.spec.ts`           | Checkout and payment modal behavior     |

### Docs

| Doc                                    | Content                                          |
| -------------------------------------- | ------------------------------------------------ |
| `docs/features/finix-integration.md`   | Account model, credentials, phases, refunds      |
| `docs/features/supabase-onboarding.md` | Auth and merchant provisioning with Finix config |
| `docs/features/returns-and-refunds.md` | Refund flow using original Finix transfer ids    |

## API Details

- Base URL: `https://finix.sandbox-payments.example` via the configured Finix service helpers
- Phase A uses sandbox test cards exposed through `PaymentModal`
- Successful charges persist both `authorization_id` and `transfer_id`
- Refunds are performed against the original `transfer_id`
