# Catalog Data Quality Analysis

> Deep analysis of NYSLA catalog data quality issues affecting the LiquorPOS inventory import pipeline.

**Date:** 2026-04-04
**Data source:** NYSLA Price Postings (April 2026), crawled via `scripts/nysla/crawl-lr-to-csv.cjs`
**Pipeline:** CSV files in `data/lr/` and `data/wr/` -> `scripts/upload-catalog.ts` (Supabase) -> `catalog:import` IPC handler (local SQLite)

---

## Summary of Findings

| Issue                                            | Severity | Impact                                                              |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------- |
| Row-level duplicates in CSV files                | High     | 21,016 excess rows in source data                                   |
| Duplicate distributors (same name, multiple IDs) | High     | Same products imported N times per permit ID                        |
| Products without usable TTB IDs                  | Medium   | 29,360 of 42,012 DB products use synthetic `CAT-` SKUs              |
| Name duplication in local DB                     | High     | 15,678 excess product rows (42,012 total, only 26,334 unique names) |
| Cryptic/abbreviated product names                | Low      | Poor UX in search and POS display                                   |
| Tax codes not assigned during import             | Medium   | 42,011 of 42,012 products have tax_1 = 0                            |

---

## 1. Duplicate Distributors

### Problem

The same distributor company has multiple NYSLA distributor IDs (different license/permit numbers). When products are imported, the `catalog:import` handler deduplicates distributors by name, but each permit ID in Supabase has its own product catalog. The same product appears once per permit ID, creating N copies in the local database.

### Data

**CSV files:** 196 LR files, 509 WR files (705 total)
**Unique distributor IDs (from filenames):** 563
**Unique distributor names (from CSV data):** 541
**Distributors with multiple IDs:** 17

#### Multi-ID Distributors

| Distributor Name                                    | IDs                    | Permits                                        | Notes                                                          |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| SOUTHERN GLAZER'S WINE AND SPIRITS OF NEW YORK, LLC | 880454, 880771, 893282 | 0009-21-115209, 0009-23-126783, 0009-23-124273 | 3 permits, 2 counties (Nassau, New York). Largest distributor. |
| ROBERT MAZZA INC                                    | 858037, 858038, 858039 | 0032-22-302362, 0031-22-303646, 0056-22-328191 | 3 permits, same county (Chautauqua)                            |
| RNDC New York LLC                                   | 897082, 924923         | 0009-22-215919, 0009-22-116043                 | 2 permits, different counties (Onondaga, New York)             |
| MAINSPRING LLC                                      | 862299, 862300         | 0052-23-326403, 0056-22-328701                 | 2 permits, same county (Erie)                                  |
| SOUTHERN TIER DISTILLING LLC                        | 858033, 858066         | 0052-21-313730, 0056-22-323976                 | 2 permits, same county (Chautauqua)                            |
| SHLOIMES SLIVOVITZ INC                              | 898471, 899418         | 0055-22-201590, 0054-21-208297                 | 2 permits, same county (Orange)                                |
| Tipping Cow Distillery LLC                          | 918129, 918133         | 0056-22-123094, 0052-23-126064                 | 2 permits, same county (Suffolk)                               |
| WOLFFER ESTATE VINEYARD INC                         | 914848, 916809         | 0032-16-100330, CM-22-00015                    | 2 permits, same county (Suffolk)                               |
| CONSTANTIA WINE COMPANY LLC                         | 1003831, 857637        | CM-23-00067, 0032-23-239731                    | 2 permits, same county (Cayuga)                                |
| SANI WINES CORP.                                    | 1083528, 1085428       | 0593-25-17398, 0007-25-123144                  | 2 permits, same county (Kings)                                 |
| GOTHAM SAKE LLC                                     | 872170, 995059         | 0031-23-133217, 0031-23-157663                 | 2 permits, same county (Kings)                                 |
| DEL VINO VINEYARDS INC                              | 916455, 916456         | 0032-21-122722, 0031-21-118140                 | 2 permits, same county (Suffolk)                               |
| LIVING ROOTS WINE & COMPANY LLC                     | 877372, 877408         | 0031-23-335503, 0007-23-320013                 | 2 permits, same county (Monroe)                                |
| BROOKLYN SPIRITS LLC                                | 871827, 871869         | —                                              | 2 IDs                                                          |
| GREEN FARMS II LLC                                  | 870410, 872428         | —                                              | 2 IDs                                                          |
| STOUTRIDGE VINEYARD LLC                             | 920093, 920339         | —                                              | 2 IDs                                                          |
| ROCK STREAM VINEYARDS LLC                           | 925447, 925452         | —                                              | 2 IDs                                                          |

Additionally, **146 distributors appear in BOTH the LR and WR folders**, with different product catalogs (LR = Liquor, WR = Wine/Beer). These represent the same company selling both liquor and wine products. Their product_ids are always distinct across LR and WR (zero overlap), but product names may overlap for combo/crossover items.

#### Near-Name Duplicates

One confirmed naming variant that creates a separate distributor entry:

- `MARTINS HONEY FARM & MEADERY LLC` (ID 1003877) vs. `MARTIN'S HONEY FARM AND MEADERY, LLC` (ID 912085) -- same business, different punctuation/abbreviation

### Root Cause

NYSLA issues separate permit numbers for different license types (e.g., 0009 = wholesale liquor, 0031 = farm winery, 0032 = winery, 0052 = farm distillery, 0056 = craft distillery, CM = custom). A single company may hold permits of different types or renew with a new permit number.

### Product Overlap (Southern Glazer's NYC Example)

The three SG NYC LR files contain:

- File 880454: 8,156 rows, 7,516 unique product_ids, 5,886 unique names
- File 893282: 8,156 rows, 7,493 unique product_ids, 5,871 unique names
- File 880771: 2,839 rows, 2,301 unique product_ids, 1,843 unique names

**Name overlap between files 880454 and 893282: 5,632 of ~5,880** (96%). These are essentially the same catalog posted under two different permit numbers. The product_ids are always different (0 overlap), so the current `INSERT OR IGNORE` on SKU creates duplicates for every product that lacks a TTB ID (uses `CAT-{product_id}`).

### Recommendation

**Deduplicate at import time using `(distributor_name, prod_name, item_size)` as a composite key.** Before inserting a product, check if a product with the same name, size, and local distributor_number already exists. If so, skip (or update the existing record with the latest pricing).

Alternatively, deduplicate at the Supabase level by adding a composite unique constraint to `catalog_products` on `(distributor_id_normalized, prod_name, item_size)` where `distributor_id_normalized` maps multiple permit IDs to the same canonical distributor.

---

## 2. Row-Level Duplicates in CSV Files

### Problem

Individual CSV files contain duplicate rows -- the same `product_id` appears multiple times within a single file.

### Data

- **301 CSV files** (out of 705) contain row-level duplicates
- **21,016 total excess rows** across all files
- **17,640 unique product_ids** are affected

Worst offenders:

| File                               | Excess Rows |
| ---------------------------------- | ----------- |
| wr/889872_WINEBOW_INC.csv          | 1,041       |
| wr/886691_USA_WINE_IMPORTS_INC.csv | 1,029       |
| wr/880454_SOUTHERN_GLAZER_S...csv  | 733         |
| wr/893282_SOUTHERN_GLAZER_S...csv  | 724         |
| wr/880771_SOUTHERN_GLAZER_S...csv  | 714         |
| wr/890116_WILSON_DANIELS...csv     | 713         |
| lr/893282_SOUTHERN_GLAZER_S...csv  | 664         |
| lr/880454_SOUTHERN_GLAZER_S...csv  | 641         |
| wr/869790_Empire_Merchants_LLC.csv | 582         |
| wr/891077_WORLD_WIDE_WINES...csv   | 563         |

### Root Cause

The NYSLA Price Postings website likely renders duplicate rows in its HTML tables (the crawl script scrapes the rendered DOM). This may be a display bug on the NYSLA side, or the same product is listed under multiple pricing tiers (combo/regular) that appear as separate rows with the same product_id.

### Recommendation

**Deduplicate CSV files at crawl time.** Add a `product_id` deduplication step to `crawl-lr-to-csv.cjs` that keeps only the first occurrence of each `product_id` per file. Alternatively, deduplicate in `upload-catalog.ts` before inserting into Supabase.

---

## 3. Duplicate Products in the Local SQLite Database

### Problem

The local database contains 42,012 products but only 26,334 unique product names -- meaning **15,678 products are duplicates by name** (37% of the database).

### Data

| Metric                               | Value  |
| ------------------------------------ | ------ |
| Total products in SQLite             | 42,012 |
| Unique product names                 | 26,334 |
| Excess rows (by name)                | 15,678 |
| Unique product names with duplicates | 6,500  |

Top duplicated products (all from Southern Glazer's):

| Product Name                       | Count |
| ---------------------------------- | ----- |
| CHAMUCOS TEQ ASST(4EA-ANE/REP/SIL) | 27    |
| CIROC VOD PASSION 60               | 26    |
| SVEDKA VODKA 80 PET                | 25    |
| LUXARDO MARAS ESPO BITT SANTO-     | 23    |
| DON JULIO TEQ BLANCO 80            | 23    |

These all come from two distributors: `SOUTHERN GLAZER'S WINE AND SPIRITS OF NEW YORK, LLC` (20,267 products) and `SOUTHERN GLAZER'S WINE AND SPIRITS OF UPSTATE NEW YORK LLC` (7,335 products).

### Root Cause

Three compounding factors:

1. **Multiple permit IDs per distributor**: SG NYC has 3 permit IDs, each with a nearly identical catalog. That alone creates 3x duplication.
2. **LR + WR separation**: SG NYC appears in both LR (liquor) and WR (wine) folders with separate product_ids.
3. **Row-level CSV duplicates**: Individual files have ~600-700 excess rows each.
4. **CAT-{product_id} SKU generation**: Products without a valid TTB ID (length < 8) get a synthetic `CAT-{product_id}` SKU. Since product_ids differ across permit IDs, the `UNIQUE` constraint on SKU does not prevent duplication.

The `INSERT OR IGNORE` in the import handler only catches exact SKU matches. With `CAT-` prefixed SKUs, every row becomes unique.

### Recommendation

Change the import deduplication strategy from SKU-based to composite-key-based:

```sql
-- Before insert, check for existing product
SELECT id FROM products
WHERE distributor_number = ? AND name = ? AND size = ?
LIMIT 1
```

If a match exists, update pricing instead of inserting a new row.

---

## 4. SKU / TTB ID Quality Issues

### Problem

The TTB ID field (used as SKU during import) is unreliable for a large portion of products. Only 30% of CSV rows have a proper TTB ID.

### Data from CSV Files (370,636 total rows)

| Pattern                              | LR Count | WR Count | Total   | %     |
| ------------------------------------ | -------- | -------- | ------- | ----- |
| Proper TTB ID (14+ digit number)     | 30,386   | 202,069  | 232,455 | 62.7% |
| Empty                                | 26,551   | 63,786   | 90,337  | 24.4% |
| `P` (Pending)                        | 19,685   | 23,147   | 42,832  | 11.6% |
| Other (brand names, addresses, etc.) | ~600     | ~3,900   | ~4,500  | 1.2%  |
| Short numeric (< 14 digits)          | ~310     | ~1,500   | ~1,810  | 0.5%  |

### Data from Local SQLite DB (42,012 products)

| SKU Type                                    | Count  | %     |
| ------------------------------------------- | ------ | ----- |
| `CAT-` prefix (synthetic, no usable TTB ID) | 29,360 | 69.9% |
| Proper TTB ID (14-digit)                    | 12,640 | 30.1% |
| `P` (Pending -- only 1 slipped through)     | 1      | 0.0%  |

### What `P` Means

`P` in the `ttb_id` field means **Pending TTB approval**. The product has been submitted to the Alcohol and Tobacco Tax and Trade Bureau (TTB) for a Certificate of Label Approval (COLA) but has not yet received one. This is common for new products.

Notably, `P` does NOT always correlate with `brand_reg=P` (pending brand registration). Of 8,157 products with `ttb_id=P` in one SG file, only 2,422 (30%) also had `brand_reg=P`. The two fields are independent approval statuses.

### Junk Values in ttb_id

The WR data contains particularly bad ttb_id values including:

- Full addresses: `"Wine Source Group LLC 104 West 40th street Suite 506 NY NY 10018"` (132 rows)
- Company names: `"Lionstone International..."`, `"Duclot La Vinicole LLC..."`
- Allocation notes: `"Max per account"`, `"Advance Interest"`
- Wine-specific codes: `SA`, `DA`, `RD` (likely NYSLA-specific status codes)
- Scientific notation overflow: `2.41660010004392E+27` (Excel corruption)

### Recommendation

1. **Keep the current CAT-{product_id} fallback** for products without valid TTB IDs, but combine it with name-based deduplication (see Issue 3).
2. **Store `nys_item` as an additional SKU.** 78.9% of products have both a TTB ID and an nys_item number. 20.4% have ONLY an nys_item (no TTB ID). This field could be stored as an additional_sku for barcode scanning.
3. **Validate ttb_id during import**: reject any value that is not purely numeric and at least 8 digits. The current `length >= 8` check is correct but should also require `isdigit()`.

---

## 5. NYS Item Number vs TTB ID

### Problem

Two identifier systems coexist in the NYSLA data: `nys_item` (NYSLA's own item number) and `ttb_id` (federal TTB COLA number). Currently only `ttb_id` is used for SKU generation; `nys_item` is not stored.

### Data

| Category               | Count   | % of 370,636 |
| ---------------------- | ------- | ------------ |
| Both TTB ID + nys_item | 292,348 | 78.9%        |
| TTB ID only            | 912     | 0.2%         |
| nys_item only          | 75,466  | 20.4%        |
| Neither                | 1,910   | 0.5%         |

The `nys_item` field is **not globally unique**. It is distributor-specific -- `(distributor_id, nys_item)` has 331,704 unique pairs but 20,118 of those pairs have duplicates (from row-level CSV duplicates and combo listings).

nys_item patterns:

- LR: 41% pure numeric, 55% alphanumeric (distributor internal codes like `US117043`, `PD101645`)
- WR: 34% pure numeric, 60% alphanumeric (codes like `RE16`, `MA16`, `MON-1960-19`)

### Recommendation

**Do not store `nys_item`.** It is not globally unique (distributor-specific), making it unsuitable as a SKU or additional SKU. Storing non-unique values in additional SKUs would cause false matches during barcode scanning or search. SKU must always be unique -- if `nys_item` cannot guarantee that, it has no value in the local database.

---

## 6. Bad Product Names

### Problem

Product names from the NYSLA data are abbreviated, cryptic, and sometimes misleading.

### Examples

**Leading dash (brand name issue):**

- `-196 CKTL VOD LEMON CAN 12PK` -- This is the **Suntory -196** brand (a Japanese vodka cocktail). The dash is part of the brand name, not a data error. The brand_name field correctly shows `-196 CKTL`. There are 72 products with this brand across 4 duplicate distributor entries. This is a legitimate product name.

**Cryptic abbreviations:**

- `CHAMUCOS TEQ ASST(4EA-ANE/REP/SIL)` -- "Chamucos Tequila Assortment (4 each Anejo/Reposado/Silver)"
- `LA MARCA/MNTNGRO 750ML 12P CMB 9B LA MAR PROS/ 3B MONT AMARO` -- combo pack
- `HENDRICKS GIN 1L/FLORA ADORA 750 2B CMB` -- combo of 2 bottles
- `NIKKA WSKY MIYA YOI TAKETSU-3` -- Nikka Whiskey Miyagikyo
- `DEKUYPER PEACHTREE SCHN 30 PET` -- DeKuyper Peachtree Schnapps 30 proof, PET bottle

**Common abbreviations in NYSLA names:**

- `TEQ` = Tequila, `VOD` = Vodka, `BBN` = Bourbon, `WSKY` = Whiskey
- `SCHN` = Schnapps, `CKTL` = Cocktail, `LIQ` = Liqueur
- `PET` = PET bottle, `CMB` = Combo, `ASST` = Assortment
- `SM` = Single Malt, `SC` = Scotch
- Numbers typically indicate proof (e.g., `80`, `60`, `70`)

**Short names (< 5 chars):** Only 1 product (`NUVO` by NUVO brand)

**Assortment/combo products:** 146 products contain `ASST` in the name

### Recommendation

1. **Do NOT auto-fix names during import.** The abbreviated names are the NYSLA standard and match what distributors use on invoices. Store owners will recognize them.
2. **Consider a display name field.** Add an optional `display_name` column that store owners can edit for POS receipt/display purposes while keeping the original NYSLA name for reference.
3. **The -196 brand is correct.** No special handling needed -- the dash is part of the official brand name (Suntory -196).

---

## 7. ItemForm Field Layout Analysis

### Current Layout

The ItemForm General Information section contains **20 fields** on the main section:

**Row 1:** Item Type (dropdown) | SKU | Size (dropdown)
**Row 2:** Brand (span 2) | Item Name (span 2)
**Row 3:** Per Bottle Cost | Per Case Cost | Proof | ABV %
**Row 4:** Vintage | TTB ID | Bottles Per Case | Price You Charge
**Row 5:** # In Stock | Tax Profile (dropdown) | Final w/ Tax (read-only) | Profit Margin (read-only, span 2)
**Row 6:** Discounts (read-only)

The inner tabs contain:

- **Case & Quantity:** Case Discount (percent/dollar toggle), Distributor dropdown
- **Additional SKUs:** SKU input + list
- **Special Pricing:** Quantity/Price/Duration rows
- **Sales History:** (placeholder)

### Field Classification

**Essential for daily POS use (must stay in General Info):**

- SKU, Item Name, Brand, Price You Charge, # In Stock, Tax Profile, Size, Item Type
- Final w/ Tax (computed), Profit Margin (computed)

**Important for ordering/inventory but not daily POS:**

- Per Bottle Cost, Per Case Cost, Bottles Per Case, Distributor, Case Discount
- Discounts (NYSLA, read-only)

**Reference/metadata (rarely edited):**

- Proof, ABV %, Vintage, TTB ID

### Recommendation

Move the following fields to the **Case & Quantity** tab or a new **Additional Info** tab:

- **Proof, ABV %, Vintage, TTB ID** -- These are reference fields imported from NYSLA. Store owners rarely edit them. Moving them frees up a full row in General Info.

Keep in General Info but consolidate:

- Move **Distributor** from Case & Quantity tab up to General Info (it is a primary product attribute, not a case setting).
- Move **Per Case Cost** and **Bottles Per Case** together with Case Discount in the Case & Quantity tab.

This would reduce General Info to ~14 fields (4 rows of 4) with a cleaner layout.

---

## 8. Tax Code Default Assignment

### Problem

Almost no products have a tax code assigned. Only 1 of 42,012 products has a non-zero `tax_1` value.

### Data

| tax_1 Value | Product Count |
| ----------- | ------------- |
| 0.0         | 42,011        |
| 0.08875     | 1             |

The `tax_codes` table has one entry: `Sales Tax` at 8.875% (NYC rate).

The `item_types` table has 19 entries (auto-populated from NYSLA beverage types during import), but all have `default_tax_rate = 0` and `default_profit_margin = 0`.

### Root Cause

1. The `catalog:import` handler does not set `tax_1` on imported products.
2. The `item_types` table is populated with correct category names but no default tax rates.
3. The ItemForm has auto-fill logic: selecting an item type fills in its `default_tax_rate`. But since all defaults are 0, this has no effect.

### How Tax Assignment Should Work

The item type -> tax rate mapping is already wired:

1. Admin sets `default_tax_rate` on each item type in the Item Types panel (e.g., "Whiskey" = 8.875%)
2. When creating/editing a product and selecting an item type, the form auto-fills the tax rate
3. The `catalog:import` handler should also apply the item type's default tax rate during import

### Recommendation

1. **Seed default tax rates on item_types during import.** Since all liquor/wine products in NY are subject to the same sales tax, set `default_tax_rate` to the store's configured rate for all beverage item types.
2. **Apply tax rate during catalog import.** After inserting products, update them:
   ```sql
   UPDATE products SET tax_1 = (
     SELECT it.default_tax_rate / 100 FROM item_types it WHERE it.name = products.item_type
   ) WHERE tax_1 = 0 OR tax_1 IS NULL
   ```
3. **Add a bulk "Apply Tax to All" action** in the Tax Codes panel that retroactively sets the tax rate on all products matching a given item type.

---

## 9. Overall Data Pipeline Metrics

### CSV Source Data

| Metric                                 | Value                 |
| -------------------------------------- | --------------------- |
| Total CSV files                        | 705 (196 LR + 509 WR) |
| Total CSV rows                         | 370,636               |
| Unique product_ids                     | 349,620               |
| Row-level duplicates (same product_id) | 21,016 excess         |
| Unique product names                   | 207,056               |
| Name-level duplicates                  | 163,580 excess        |
| Products with valid TTB ID             | 232,455 (62.7%)       |
| Products with TTB ID = P (pending)     | 42,832 (11.6%)        |
| Products with no TTB ID                | 90,337 (24.4%)        |

### Local SQLite Database (after import of ~8 distributors)

| Metric                             | Value          |
| ---------------------------------- | -------------- |
| Total products                     | 42,012         |
| Unique product names               | 26,334         |
| Duplicate products (by name)       | 15,678 (37%)   |
| Products with proper TTB ID as SKU | 12,640 (30.1%) |
| Products with synthetic CAT- SKU   | 29,360 (69.9%) |
| Distributors imported              | 8              |
| Products with tax assigned         | 1 (0.002%)     |

### Deduplication Priority

If all three deduplication fixes were applied:

1. **Row-level CSV dedup** (product_id): eliminates ~21K excess rows at source
2. **Multi-permit distributor merge**: eliminates products imported N times per permit. For SG NYC alone, this would reduce ~20K products to ~6K.
3. **Name+size composite dedup at import**: catches remaining cross-LR/WR duplicates

Conservative estimate: the 42,012 local products would reduce to ~24,000-28,000 after proper deduplication.

---

## 10. Proposed Action Plan

Grouped by priority. Each item references the issue number above.

### P0 -- Import pipeline fixes (do first, re-import after)

| #   | Action                                                                                                                         | Issue | Effort                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------- |
| 1   | **Deduplicate CSV rows at crawl time** by `product_id` -- keep first occurrence only                                           | 2     | Small -- edit `crawl-lr-to-csv.cjs`      |
| 2   | **Deduplicate at import time** using `(distributor_number, name, size)` composite check instead of SKU-only `INSERT OR IGNORE` | 1, 3  | Medium -- edit `catalog:import` handler  |
| 3   | **Validate ttb_id** -- only use as SKU if purely numeric and >= 8 digits; reject `P`, addresses, junk                          | 4     | Small -- edit `catalog:import` SKU logic |
| 4   | **Do not import products without a usable SKU if they also lack a meaningful name**                                            | 4     | Small -- skip filter in import           |

### P1 -- Tax code bulk assignment

| #   | Action                                                                                                                    | Issue | Effort |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| 5   | **Add "Apply Tax to All Items" button** in Tax Codes panel -- sets the selected tax rate on all products with `tax_1 = 0` | 8     | Medium |
| 6   | **Seed `default_tax_rate` on item_types** during first import based on the store's configured sales tax                   | 8     | Small  |
| 7   | **Apply item_type default_tax_rate during `catalog:import`** for newly inserted products                                  | 8     | Small  |

### P2 -- ItemForm UX cleanup

| #   | Action                                                                                                          | Issue | Effort |
| --- | --------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| 8   | **Move Proof, ABV%, Vintage, TTB ID to Additional Info tab** -- these are NYSLA reference fields, rarely edited | 7     | Medium |
| 9   | **Move Distributor up from Case & Quantity to General Info** -- it is a primary product attribute               | 7     | Small  |
| 10  | **Group Per Case Cost + Bottles Per Case with Case Discount** in Case & Quantity tab                            | 7     | Small  |

### P3 -- Nice-to-haves

| #   | Action                                                                                                      | Issue | Effort |
| --- | ----------------------------------------------------------------------------------------------------------- | ----- | ------ |
| 11  | **Add optional `display_name` column** for store owners to override NYSLA abbreviated names on receipts/POS | 6     | Medium |
| 12  | **Merge multi-permit distributors** in Supabase using a canonical distributor mapping table                 | 1     | Large  |

### Post-fix: Re-import

After P0 changes are implemented, the store owner should:

1. Clear local products table (or use a "re-import" option)
2. Re-import from their selected distributors
3. Apply bulk tax via the new P1 button
4. Expected result: ~24K-28K clean, deduplicated products with tax assigned
