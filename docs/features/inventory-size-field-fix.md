# Inventory Size Field — Display Bug + Free-Form Fix

**Status:** Complete
**Date:** 2026-04-23
**Scope:** Fix the Size field in `ItemForm` so it always displays the stored value, and let the operator enter any size (e.g. `233ML`, `1.75L`, `12OZ`) instead of being constrained to a hardcoded list of nine.

---

## Why This Looks Transient

The user reports: opening an item via the **Search Modal → Inventory** sometimes leaves Size blank, but opening the same record **directly from the Inventory list** shows the size populated.

Both paths actually call the same backend (`getInventoryProductDetail` in `products.repo.ts:250`) and produce identical `detail.size` values. So the data is fine. The bug is in the renderer:

`src/renderer/src/components/inventory/items/ItemForm.tsx:752-770` renders Size as a hardcoded `<select>`:

```tsx
<InventorySelect value={formState.size} ...>
  <option value="">None</option>
  {['50ML','187ML','200ML','500ML','750ML','1L','1.5L','2L','4L'].map((s) => (
    <option key={s} value={s}>{s}</option>
  ))}
</InventorySelect>
```

When the stored size string does not exactly match one of those nine options, the `<select>` cannot display it. The browser silently shows the first option (the empty `None`), so the field looks blank — even though `formState.size` still holds e.g. `"355ML"`. Save it back and you persist `""` instead, **silently losing the original size**.

Why does it look path-dependent? The Search Modal returns a wider product set, including catalog imports. Distributor catalog rows get their size built in `src/main/index.ts:693-696`:

```ts
const size =
  product.item_size && product.unit_of_measure
    ? `${product.item_size}${product.unit_of_measure}`
    : (product.item_size ?? null)
```

A query against `catalog_products` shows the actual variety:

| `item_size` | `unit_of_measure` | Concatenated value | In select? |
| ----------- | ----------------- | ------------------ | ---------- |
| 1.75        | L                 | `1.75L`            | No         |
| 355         | ML                | `355ML`            | No         |
| 720         | ML                | `720ML`            | No         |
| 12          | OZ                | `12OZ`             | No         |
| 100         | ML                | `100ML`            | No         |
| 375         | ml                | `375ml`            | No (case)  |
| 700         | mL                | `700mL`            | No (case)  |
| 1.5         | LT                | `1.5LT`            | No         |
| 750         | ML                | `750ML`            | Yes        |
| 1           | L                 | `1L`               | Yes        |

Roughly nine canonical values match; everything else is invisible in the dropdown. Items the user creates by hand from a known size therefore look fine; catalog-imported items often look broken. That is the "transient" pattern they're seeing.

---

## Target Behaviour

### 1. Size field becomes a combobox (free-form + suggestions)

Replace the `<select>` with a text input that:

- **Always echoes `formState.size` exactly as stored** — no silent truncation. If the DB has `"233ML"`, the field shows `"233ML"`.
- **Accepts any free-form value** — `233ML`, `1.75L`, `12OZ`, `Single`, etc. No client-side restriction beyond max length.
- **Shows the canonical suggestion list** in a dropdown when focused or while typing. The list is the existing nine values **plus** any other distinct sizes already used in the merchant's products (queried once on form mount). Suggestions filter as the user types.
- **Normalizes on blur / save** (see §2). What the user sees while typing is what they typed; we only canonicalize at the save boundary.
- **Reuses `SearchDropdown`** from `docs/features/keyboard-navigable-search-dropdown.md` once it lands. Until that ships, build it inline with a small local listbox; refactor when the shared component is ready. Either way, expose Up / Down / Enter keyboard nav (the user just asked for this elsewhere — applying the same pattern here is consistent).

### 2. Size normalization

Add `src/renderer/src/utils/size.ts`:

```ts
export const CANONICAL_SIZE_SUGGESTIONS = [
  '50ML',
  '187ML',
  '200ML',
  '250ML',
  '355ML',
  '375ML',
  '500ML',
  '700ML',
  '720ML',
  '750ML',
  '1L',
  '1.5L',
  '1.75L',
  '2L',
  '3L',
  '4L',
  '5L'
] as const

/**
 * Normalize a size string. Trims, uppercases units, removes spaces between
 * number and unit. Leaves unit-less values alone. Empty input → null.
 */
export function normalizeSize(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Match optional number + optional unit
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/)
  if (!m) return trimmed.toUpperCase() // free-form: just uppercase

  const [, num, rawUnit] = m
  if (!rawUnit) return num // pure number

  const unit = rawUnit.toUpperCase()
  const canonical =
    unit === 'ML' || unit === 'MILLILITER'
      ? 'ML'
      : unit === 'L' || unit === 'LT' || unit === 'LITER'
        ? 'L'
        : unit === 'OZ' || unit === 'OUNCE'
          ? 'OZ'
          : unit
  return `${num}${canonical}`
}
```

Apply normalization in two places:

- **`ItemForm.tsx` save path** (`saveInventoryItem` payload, around line 498) — wrap `formState.size` with `normalizeSize()`.
- **Catalog import** (`src/main/index.ts:693-696`) — replace the raw concat with `normalizeSize(\`${item_size}${unit_of_measure}\`)`. This stops bad sizes from entering the local DB on future imports. Existing rows untouched (see §4).

### 3. Backfill existing data (one-time)

A startup migration in `src/main/database/schema.ts` runs once:

- Reads every `products.size` that is non-null.
- Applies `normalizeSize` (importing the same util — extract it to `src/shared/utils/size.ts` so both main and renderer can import it).
- Writes back if the normalized value differs.
- Logs a count of rows touched via the existing scoped logger.

Idempotent — safe to re-run.

### 4. Keep the field visible even when stale

Even after normalization, some rows will hold sizes that aren't in `CANONICAL_SIZE_SUGGESTIONS` (e.g. `233ML`, `40OZ`). The combobox **must** still display them. Two rules in the suggestion list:

- If `formState.size` (normalized) is non-empty and not already in the canonical list, prepend it as the first suggestion. So the user sees their actual value at the top.
- The merchant's distinct-sizes-in-use list (queried via a new IPC `inventory:list-sizes-in-use`) is merged into the suggestion array, deduped, sorted by frequency desc.

### 5. Clearing the value

Today `<option value="">None</option>` is the only way to clear. With a free-form input, "clear" means: empty the input and blur. Save sends `null` (matches `normalizeSize('')`). Provide a small `×` button inside the input wrapper as an affordance — same pattern as the search inputs.

---

## Architecture Changes

### Shared utility (new)

`src/shared/utils/size.ts` — owns `normalizeSize`, `CANONICAL_SIZE_SUGGESTIONS`. Both main (catalog import + schema migration) and renderer (form save + suggestion list) import from here. Aligns with CLAUDE.md "Types — Single Source of Truth" and the same principle for utilities.

### Backend

1. `src/main/index.ts:693-696` — apply `normalizeSize` on catalog import.
2. `src/main/database/schema.ts` — add a one-time backfill block, modeled after the `stax_transaction_id` migration at line 140 (idempotent, runs at startup).
3. New repo function `getDistinctSizesInUse(): string[]` in `products.repo.ts`:
   ```sql
   SELECT size, COUNT(*) AS n
   FROM products
   WHERE size IS NOT NULL AND TRIM(size) != ''
   GROUP BY size
   ORDER BY n DESC, size ASC
   LIMIT 100;
   ```
4. New IPC `inventory:list-sizes-in-use` → expose via preload.

### Renderer

1. Add `useEffect` in `ItemForm` to fetch the merchant's distinct sizes once on mount; cache in component state.
2. Replace lines 752-770 with the new combobox. Use `SearchDropdown` if available, else inline.
3. On save, run `normalizeSize(formState.size)` before sending to `saveInventoryItem`.
4. Display normalized value in the field after a successful save (write the normalized result back into `formState.size` so the user sees the cleaned value).

### Types / IPC

- `src/preload/index.d.ts` — add `listSizesInUse(): Promise<string[]>`.
- No shared type changes — `size: string | null` already covers free-form.

---

## Tests

### Util (`src/shared/utils/size.test.ts`)

- `normalizeSize('750ml')` → `'750ML'`
- `normalizeSize(' 1.75 L ')` → `'1.75L'`
- `normalizeSize('1.5LT')` → `'1.5L'`
- `normalizeSize('700 mL')` → `'700ML'`
- `normalizeSize('12oz')` → `'12OZ'`
- `normalizeSize('Single')` → `'SINGLE'` (free-form: just uppercase)
- `normalizeSize('')` → `null`
- `normalizeSize(null)` → `null`
- `normalizeSize('233ml')` → `'233ML'` — non-canonical numeric stays intact

### Repo (`products.repo.test.ts`)

- `getDistinctSizesInUse` — returns sizes ordered by frequency desc.
- Catalog import (existing test, extend) — imports `item_size='1.75', unit_of_measure='L'` and stores `size='1.75L'`. Imports `'375', 'ml'` and stores `'375ML'`.

### Schema migration (`schema.test.ts` — likely needs new file)

- Seed a row with `size='750ml'`, run `applySchema`, assert it becomes `'750ML'`.
- Re-run — no further changes (idempotent).

### Renderer (`ItemForm.test.tsx`)

- Loading an item with `size='233ML'` shows `'233ML'` in the input (regression test for the silent-blank bug).
- Typing `'42oz'` and blurring → field shows `'42OZ'` (normalization on save fed back into form state).
- Suggestions list includes the canonical set + the merchant's in-use sizes from the IPC mock.
- ArrowDown / ArrowUp navigates suggestions; Enter selects.
- Clear (`×`) button empties the field; save sends `null`.

### E2E

Add one Playwright path: open Search Modal → search a catalog-imported item with a non-canonical size (e.g. `'355ML'`) → click "Open in Inventory" → assert the Size input value is `'355ML'`.

---

## File Touch List

New:

- `src/shared/utils/size.ts`
- `src/shared/utils/size.test.ts`

Edited:

- `src/main/index.ts` (catalog import)
- `src/main/database/schema.ts` (backfill migration)
- `src/main/database/products.repo.ts` (`getDistinctSizesInUse`)
- `src/main/database/products.repo.test.ts`
- `src/preload/index.ts`, `src/preload/index.d.ts`
- `src/renderer/src/components/inventory/items/ItemForm.tsx`
- `src/renderer/src/components/inventory/items/ItemForm.test.tsx`
- `src/renderer/src/components/inventory/items/item-form.css` (small style for the new input + clear button)
- `src/renderer/src/components/common/InventoryInput.tsx` — only if a small `withClearButton` variant lands here. Otherwise inline.

Docs:

- This file.
- Add row to `docs/README.md`.
- Update `docs/ai/inventory-map.md` to reference the new IPC channel and the size util.

---

## Risks

- **Bad data already in production.** The backfill normalizes case + units; it does not invent missing units. A row with `size='1.75'` (no unit) stays `'1.75'` because we cannot guess. Acceptable — the operator can edit.
- **Normalization mis-mapping.** `LT` → `L` and `mL` → `ML` are safe in this domain (US liquor retail). Re-check before shipping if the catalog ever serves non-US units (`CL`, `DL`, …); add cases as needed.
- **Combobox keyboard nav before `SearchDropdown` lands.** Do not block on the shared component — implement inline first if the search-dropdown change ships later. Lower bar: at minimum, free-form input + suggestion `<datalist>` is enough to ship the data fix; full keyboard nav is the polish on top.
- **Distinct-sizes IPC chatter.** Cache the result in component state, refetch only when the modal re-opens. One round trip per modal open, ~100 rows max.

---

## Verification

1. `npx prettier --write .`
2. `npm run lint`
3. `npx stylelint "src/**/*.css"`
4. `npm run typecheck`
5. `npm run test:coverage` — must stay ≥ 80%.
6. `npm run test:e2e`.
7. Manual:
   - Search a catalog item with a non-canonical size → open in Inventory → Size field shows the actual value, not blank.
   - Type `233ml` into Size → blur → field shows `233ML`. Save. Reopen — still `233ML`.
   - Type `750ml` → Size dropdown highlights `750ML` suggestion → Enter → field becomes `750ML`.
   - Click `×` → field clears → save → DB row has `size = NULL`.
   - Restart app → run schema migration → grep main process log for the "size backfill: N rows updated" line.

---

## Out of Scope

- Multi-unit conversions (showing fluid ounces alongside ML).
- Per-merchant editable suggestion list.
- A separate `size_unit` column. Keeping `size` as a single string is fine for retail use; splitting would balloon the schema and the UI for no operator benefit.
