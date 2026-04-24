# Catalog Admin — Local Operator Tool

A standalone Vite + React dashboard for reviewing merchant product edits against the central NYSLA catalog and selectively promoting curated values back to `catalog_products`.

**Local-only v1.** Runs on `127.0.0.1:5181`. Never deployed, never bundled into the POS app.

---

## Quick Start

```bash
# 1. Install dependencies
cd tools/catalog-admin
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env and fill in VITE_SUPABASE_SERVICE_ROLE_KEY
# (get it from app.supabase.com → Settings → API → service_role secret)

# 3. Launch (or from repo root: npm run admin)
npm run dev
# Opens at http://127.0.0.1:5181
```

---

## Prerequisites

| Requirement                 | Details                                         |
| --------------------------- | ----------------------------------------------- |
| Node.js ≥ 20                | Same as the main app                            |
| Supabase service-role key   | From project settings — keep it local           |
| Super-user Supabase account | `app_metadata.is_super_user = true` must be set |

### Setting super-user access

In the Supabase dashboard → Authentication → Users → select the operator account → edit:

```json
{
  "app_metadata": {
    "is_super_user": true
  }
}
```

Or via the Supabase CLI:

```bash
npx supabase db execute --remote --sql "
  UPDATE auth.users
     SET raw_app_meta_data = raw_app_meta_data || '{\"is_super_user\": true}'::jsonb
   WHERE email = 'operator@checkoutmain.co';
"
```

---

## Workflow

1. Sign in with the operator Supabase account.
2. Pick a merchant from the dropdown.
3. The dashboard loads all `merchant_products` for that merchant and joins them to `catalog_products` via `ttb_id`.
4. If multiple catalog rows share a `ttb_id`, the tool picks the best match using normalized size and canonical distributor id.
5. Diffs are computed per field: **SKU, Barcode, Size, Cost**.
6. Use the filter bar to focus on a single field type.
7. **Promote** — writes the merchant's value into the curated overlay column (`curated_sku`, `curated_barcode`, `curated_size`, `curated_cost`), appends a row to `catalog_curation_log`, and bumps `catalog_revision`.
8. **Clear curated value** — nulls the curated override, logs the revert, bumps revision.
9. **Bulk promote** — promotes all rows of the active field filter where the catalog column is currently empty.

---

## Diff Statuses

| Status             | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `differs`          | Merchant value and catalog value are different                    |
| `no_catalog_match` | No `catalog_products` row matches the merchant product's `ttb_id` |

---

## Curated Fields

| Field   | Catalog source column                                           | Curated column                     |
| ------- | --------------------------------------------------------------- | ---------------------------------- |
| SKU     | (none — catalog has no native SKU)                              | `catalog_products.curated_sku`     |
| Barcode | (none — catalog has no barcode)                                 | `catalog_products.curated_barcode` |
| Size    | `catalog_products.item_size`                                    | `catalog_products.curated_size`    |
| Cost    | (none — `bot_price` is NYSLA posted pricing, not merchant cost) | `catalog_products.curated_cost`    |

Rows where the catalog has never had a comparable value are treated as catalog-enrichment candidates, not live diffs. The review table only shows true mismatches against an existing catalog baseline or curated override.

Retail prices are **never** promoted from merchant to catalog.

---

## Catalog Revision

Every promote or clear action increments `catalog_revision.revision_id` via the `bump_catalog_revision()` Postgres function. Store-side clients can poll this to detect catalog updates.

---

## Audit Log

Every field-level change (promote or clear) writes a row to `catalog_curation_log`:

| Column               | Value                              |
| -------------------- | ---------------------------------- |
| `catalog_product_id` | catalog product being updated      |
| `field`              | sku / barcode / size / cost        |
| `old_value`          | prior effective value              |
| `new_value`          | new value (NULL on clear)          |
| `source_merchant_id` | which merchant's data was promoted |
| `updated_by`         | operator email                     |
| `updated_at`         | timestamp                          |

---

## Security Notes

- `VITE_SUPABASE_SERVICE_ROLE_KEY` must not be committed to the repo.
- `.env` is excluded from git by the root `.gitignore`.
- The service-role key should only be present on the operator workstation.
- Do not copy `.env` to shared machines, CI, or any cloud environment.
- The tool binds only to `127.0.0.1` (not `0.0.0.0`), so it is never accessible over the network.

---

## Key Rotation

When the service-role key is rotated:

1. Generate a new key in Supabase → Settings → API.
2. Update `.env` on the operator workstation.
3. Restart the dev server.

No code changes needed — the key is injected from the env file only.
