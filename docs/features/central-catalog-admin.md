# Central Catalog Admin Dashboard

**Status:** Planned feature spec — local-only v1
**Date:** 2026-04-18
**Scope:** Merchant → catalog diff review, curated-field promotion, single-operator local access, Supabase super-user gating, audit trail

---

## Overview

The Central Catalog Admin Dashboard is a **local-only maintenance tool** for reviewing product changes made by merchants and selectively promoting those better values back into the shared catalog.

This dashboard is **not part of the store POS app**, is **not deployed to the cloud**, and is **not intended for general merchant access**. In v1, it runs only on the maintainer workstation and is used by a single trusted operator.

The data flow is strictly:

`merchant_products` → review diffs → promote curated values into `catalog_products` → push reviewed catalog updates back to stores.

Prices are explicitly excluded from central-to-store curation.

---

## Goals

- Let Checkoutmain & Co. review merchant-side fixes against the main catalog.
- Keep the tool local to a single workstation for the initial rollout.
- Require explicit super-user authorization before any catalog reads or writes.
- Preserve an audit trail for every promoted or cleared curated value.
- Keep service credentials out of the repo and off shared machines.

## Non-Goals

- Multi-user admin access.
- Public hosting or remote browser access.
- Embedding the dashboard inside the Electron POS app.
- Automatic promotion of merchant changes without review.
- Syncing retail prices from the catalog back to merchants.

---

## Local-Only Access Model

### Runtime Location

- The dashboard lives in `tools/catalog-admin/` as a standalone Vite + React app.
- It is launched locally with `npm run admin`.
- It binds to `127.0.0.1` only.
- It is installed and run only on the current maintainer workstation.
- It is not packaged with Electron, not published, and not exposed over LAN/WAN.

### Operator Policy

- For v1, only one operator uses the dashboard.
- That operator is the maintainer running the tool from this computer.
- If another machine needs access later, that becomes a separate feature with its own security review.

---

## Authorization Model

The dashboard is protected by **two layers**:

1. **Workstation restriction** — the tool is only installed and run on the approved local machine.
2. **Supabase super-user check** — the signed-in Supabase account must be marked as a super user before the dashboard loads merchant data or allows promote actions.

### Super-User Decision

For v1, the operator account should be marked in Supabase with:

- `auth.users.app_metadata.is_super_user = true`

The dashboard checks this flag at startup and again before any write action.

If the flag is missing:

- merchant selection is disabled
- diff data is not loaded
- promote / clear curated value actions are blocked

### Why This Model

- It keeps operator identity tied to a real Supabase user account.
- Audit rows can record the operator email instead of a generic service identity.
- It avoids creating a second admin-auth system just for this tool.

---

## Secret Handling

The dashboard requires privileged Supabase access for curated catalog writes, but the credentials must remain local and tightly scoped.

### Rules

- The required credentials are already managed as Supabase secrets.
- They must not be committed to the repo.
- They must not be copied to shared `.env` files for team-wide use.
- They must only be injected into the dashboard's local launch environment on this workstation.
- The service-role key is used only by the local dashboard process and never exposed to merchants or store devices.

### Required Values

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- any additional local-only admin bootstrap values needed by the tool

### Logging Rules

- Never log secret values.
- Never render secret values in the UI.
- Audit logs should capture operator identity and mutation details, not credentials.

---

## Core Workflow

1. Launch the dashboard locally on the maintainer workstation.
2. Sign in with the Supabase operator account.
3. Verify `app_metadata.is_super_user = true`.
4. Select a merchant from the merchant picker.
5. Load product diffs between that merchant's `merchant_products` and the central `catalog_products`.
6. Filter to targeted change types such as SKU, barcode, size, cost, or alt SKU differences.
7. Promote selected merchant values into curated catalog fields.
8. Write an audit row for every accepted or cleared field.
9. Bump `catalog_revision` so downstream store clients can review the change.

---

## UI Scope

### Main Screen

- merchant picker
- searchable diff table
- field-level status (`match`, `differs`, `merchant_has_value_catalog_missing`, `no_catalog_match`)
- quick filters for common field types
- per-row promote action
- per-field clear curated value action
- bulk actions for safe mass promotion patterns

### Field Coverage

Curated fields in scope:

- SKU
- barcode / UPC
- size
- cost
- alternate SKUs

Out of scope:

- retail price
- store-specific inventory counts
- merchant-only merchandising preferences

---

## Data Writes and Audit

Promoting a field does all of the following in one logical operation:

1. update the curated field on `catalog_products`
2. record the prior and new values in `catalog_curation_log`
3. stamp operator identity and source merchant
4. bump `catalog_revision`

Clearing a curated value follows the same pattern, but writes `NULL` to the curated field and records the revert in the audit log.

### Audit Fields

Every promoted or cleared value should capture:

- catalog product id
- field name
- old value
- new value
- source merchant id
- operator email
- timestamp

---

## Security Constraints

- Local-only first release.
- No cloud deployment.
- No public route.
- No shared admin password.
- No merchant-facing access.
- No price propagation from catalog to stores.
- No write access unless both workstation policy and super-user check pass.

If local-only is ever relaxed, the security model must be redesigned before rollout.

---

## Relationship to Other Features

- This dashboard is the admin-side half of central catalog curation.
- Store-side review and apply flows remain separate POS functionality.
- The detailed implementation plan for the broader catalog pipeline lives in `docs/features/inventory-improvements-plan.md`.

This document narrows that broader plan into the concrete operating model for the admin dashboard itself.

---

## Implementation Notes

- Keep the initial implementation intentionally narrow.
- Build it as a standalone local tool, not an Electron screen.
- Prefer explicit review actions over automation.
- Use the operator's Supabase identity for authorization and audit.
- Treat single-machine operation as a product requirement for v1, not merely an informal convention.

---

## Open Follow-Ups

- Decide whether the workstation restriction remains policy-only or later becomes a machine-identity check.
- Decide whether the super-user check should eventually move from `app_metadata` to a dedicated admin table.
- Add a dedicated implementation README under `tools/catalog-admin/` once the tool exists.
- Document the store-side `Catalog Updates` review panel separately when that work begins.
