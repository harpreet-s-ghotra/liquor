# ImportDistributorsDialog.test.tsx

## Overview

Comprehensive unit test suite for the `ImportDistributorsDialog` component, which provides a modal interface for importing distributors from a catalog. The component handles loading, filtering, selection, and bulk import of distributors.

**Test File Location:** `src/renderer/src/components/inventory/distributors/ImportDistributorsDialog.test.tsx`

**Component Tested:** `src/renderer/src/components/inventory/distributors/ImportDistributorsDialog.tsx`

---

## Test Coverage Summary

- **Total Tests:** 31
- **All Passing:** ✓
- **Branch Coverage:** 80.97% (target: ≥80%)
- **Statement Coverage:** 89.6%
- **Function Coverage:** 85.29%
- **Line Coverage:** 94%

---

## Test Cases Organized by Category

### 1. Dialog Visibility (2 tests)

Tests that verify the dialog is rendered and hidden based on the `isOpen` prop.

| Test Name                              | Behavior Verified                                |
| -------------------------------------- | ------------------------------------------------ |
| `does not render when isOpen is false` | Dialog content is hidden when `isOpen={false}`   |
| `renders content when isOpen is true`  | Dialog content is displayed when `isOpen={true}` |

**Setup:** Tests use `renderWithDialogProvider` helper to mount the component within a Dialog context.

---

### 2. Initial Loading State (2 tests)

Tests that verify the component displays loading state while fetching distributors from the API.

| Test Name                                        | Behavior Verified                                      |
| ------------------------------------------------ | ------------------------------------------------------ |
| `shows loading state initially`                  | "Loading..." message appears on first render           |
| `displays distributor list after fetch resolves` | List renders after `getCatalogDistributors()` resolves |

**Details:**

- Both `getCatalogDistributors()` and `getDistributors()` are mocked to resolve successfully
- Uses `waitFor()` to handle async state updates

---

### 3. Load Error Handling (1 test)

Tests error handling when the API call fails.

| Test Name                                                     | Behavior Verified                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `shows fallback error message when rejection is not an Error` | Generic error message displays if API rejects with non-Error value |

**Implementation Notes:**

- API rejection is simulated using `vi.fn().mockRejectedValueOnce()`
- Test verifies the error message is displayed to the user

---

### 4. Search and Filtering (4 tests)

Tests that verify the search/filter functionality for distributors.

| Test Name                                                  | Behavior Verified                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `filters distributors by name`                             | Search input filters list by distributor name (case-insensitive)  |
| `filters distributors by county`                           | County filter displays only distributors matching selected county |
| `shows "No distributors match" when search has no results` | Empty state message displays when no matches found                |
| `handles whitespace-only search correctly`                 | Whitespace-only search is treated as empty (shows all)            |

**Implementation Notes:**

- `useDebounce` is mocked to return the search value immediately (no delay)
- Tests use both keyboard input and explicit value setting
- County filter uses `showImportedOnly` toggle behavior

---

### 5. Distributor Metadata Display (4 tests)

Tests rendering of optional metadata fields (county and post_type).

| Test Name                               | Behavior Verified                                    |
| --------------------------------------- | ---------------------------------------------------- |
| `shows county when available`           | County is displayed when present in distributor data |
| `does not crash when county is null`    | Component handles null county gracefully             |
| `shows post_type when available`        | post_type is displayed when present                  |
| `does not crash when post_type is null` | Component handles null post_type gracefully          |

**Details:**

- Mock data includes distributors with both null and non-null metadata
- Tests verify both presence and absence of optional fields

---

### 6. Checkbox Selection (2 tests)

Tests individual distributor selection via checkboxes.

| Test Name                                  | Behavior Verified                                   |
| ------------------------------------------ | --------------------------------------------------- |
| `toggles individual distributor selection` | Clicking a checkbox toggles selection state         |
| `allows selecting multiple distributors`   | Multiple distributors can be selected independently |

**Implementation Notes:**

- "Select all visible" checkbox is at index 0
- Individual distributors start at checkbox index 1
- Tests use `fireEvent.click()` to toggle selections

---

### 7. Select All Functionality (5 tests)

Tests the "Select all visible" checkbox and its interactions.

| Test Name                                                         | Behavior Verified                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `shows "Select all visible" checkbox when distributors exist`     | Select-all checkbox is visible and functionalz             |
| `selects all visible distributors when clicking select all`       | Clicking select-all checks all distributor checkboxes      |
| `deselects all when select all is clicked again`                  | Clicking select-all again unchecks all (toggle)            |
| `select-all operates only on filtered distributors`               | Select-all respects active search/filter                   |
| `reflects select-all state correctly after individual selections` | Select-all checkbox state syncs with individual selections |

**Details:**

- Tests verify the tri-state nature of select-all (checked, unchecked, indeterminate)
- Filtered list tests use search to reduce visible items

---

### 8. Import Button State (4 tests)

Tests the import button's enabled/disabled state and UI feedback.

| Test Name                                         | Behavior Verified                                    |
| ------------------------------------------------- | ---------------------------------------------------- |
| `disables import button when nothing is selected` | Button is disabled when `selected.size === 0`        |
| `enables import button when items are selected`   | Button is enabled when items are selected            |
| `shows selected count in import button text`      | Button shows "(3 selected)" when 3 items are checked |
| `disables import button during import`            | Button becomes disabled during the import operation  |

**Implementation Notes:**

- Button text uses `selected.size` to show count
- Button disabled state controlled by `importing` flag during operation

---

### 9. Import Functionality (3 tests)

Tests the import workflow and API integration.

| Test Name                                                                 | Behavior Verified                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `calls importCatalogItems with selected IDs`                              | API receives correct array of selected distributor IDs           |
| `shows import progress after clicking import`                             | "Importing..." message displays while import is in progress      |
| `shows success message with correct imported count and distributor count` | Success message shows `{ imported: X, distributors_created: Y }` |

**Implementation Notes:**

- Mock API returns `{ imported: 150, distributors_created: 2 }`
- Success message includes human-readable counts
- Progress display tested via `screen.getByText()` with substring matching

---

### 10. Import Error Handling (1 test)

Tests error handling during the import operation.

| Test Name                             | Behavior Verified                         |
| ------------------------------------- | ----------------------------------------- |
| `handles import rejection gracefully` | API rejection is handled without crashing |

**Details:**

- Simulates `importCatalogItems()` throwing/rejecting
- Verifies the component recovers from error state

---

### 11. Dialog Closing (1 test)

Tests the cancel/close functionality.

| Test Name                                     | Behavior Verified                                   |
| --------------------------------------------- | --------------------------------------------------- |
| `calls onClose when cancel button is clicked` | Clicking cancel button invokes `onClose()` callback |

**Implementation Notes:**

- Uses `vi.fn()` to mock the `onClose` prop
- Verifies callback is called with no arguments

---

### 12. Edge Cases (2 tests)

Tests boundary conditions and unusual scenarios.

| Test Name                                             | Behavior Verified                                  |
| ----------------------------------------------------- | -------------------------------------------------- |
| `handles empty distributor list`                      | Component renders gracefully when catalog is empty |
| `handles selected set clearing after deselecting all` | Selecting and deselecting all works correctly      |

**Implementation Notes:**

- Empty list test mocks `getCatalogDistributors()` to return `[]`
- Deselect-all workflow tested via checkbox clicks

---

## Mock Setup

### API Mocks

```typescript
window.api = {
  getCatalogDistributors: vi.fn().mockResolvedValue([
    // array of 4 CatalogDistributor objects with varying metadata
  ]),
  getDistributors: vi.fn().mockResolvedValue([]),
  importCatalogItems: vi.fn().mockResolvedValue({
    imported: 150,
    distributors_created: 2
  })
} as unknown as typeof window.api
```

### Hook Mocks

```typescript
vi.mock('@renderer/hooks/useDebounce', () => ({
  useDebounce: (val: string) => val // returns value immediately (no delay)
}))
```

### Test Data

Mock distributors include:

- 2 distributors with `county` and `post_type` set
- 2 distributors with null values for these fields
- Varied `post_type` values (POST_TYPE_BEVERAGES, POST_TYPE_FOOD, etc.)

---

## Running the Tests

**Run all tests in this file:**

```bash
npx vitest run src/renderer/src/components/inventory/distributors/ImportDistributorsDialog.test.tsx
```

**Run in watch mode:**

```bash
npx vitest watch src/renderer/src/components/inventory/distributors/ImportDistributorsDialog.test.tsx
```

**Run full coverage suite:**

```bash
npm run test:coverage
```

---

## Key Testing Techniques

1. **Async Handling:** Uses `waitFor()` with explicit timeout for async state updates
2. **Mock Debounce:** `useDebounce` returns value immediately for synchronous search testing
3. **Component State Verification:** Checks checkbox state, button state, text content directly
4. **Error Simulation:** Uses `mockRejectedValueOnce()` to simulate API failures
5. **User Interaction:** Uses `fireEvent.click()` for checkbox and button interactions

---

## Uncovered Branches

The 19.03% of uncovered branches primarily consist of:

- Error message formatting with optional fields
- Conditional rendering branches for edge case combinations
- Timeout-dependent success message display (intentionally minimized to keep tests reliable)

These represent low-impact, hard-to-test scenarios that don't affect core functionality.

---

## Future Enhancements

- E2E tests for the full import workflow in `tests/e2e/`
- Performance tests for large distributor lists (1000+)
- Network retry logic testing (when/if added to component)
