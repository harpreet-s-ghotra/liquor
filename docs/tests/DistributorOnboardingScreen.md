# DistributorOnboardingScreen Test Suite

**Test File:** `src/renderer/src/pages/DistributorOnboardingScreen.test.tsx`
**Component:** `src/renderer/src/pages/DistributorOnboardingScreen.tsx`

## Overview

The DistributorOnboardingScreen test suite covers the distributor selection and catalog import flow. It verifies loading states, list rendering, search/filter functionality, multi-select behavior, import operations, and error handling.

## Test Coverage

- **Statements:** 93.75%
- **Branches:** 91.11%
- **Functions:** 95%
- **Lines:** 98.11%

## Test Cases

### Initial Loading Tests

1. **Shows loading state initially**
   - "Loading distributors..." message displayed
   - Visible while getCatalogDistributors promise pending

2. **Displays distributor list after loading**
   - All distributor names rendered
   - List shown after API resolves

3. **Shows county and post_type in distributor rows**
   - County names appear in distributor rows
   - Post type (Wholesaler, Supplier, etc.) displayed
   - Multiple instances of same county shown correctly

### Empty State Tests

4. **Shows empty state when no distributors returned**
   - "No distributors match your search." message displayed
   - List hidden when empty

### Error Handling Tests

5. **Shows load error when getCatalogDistributors fails**
   - Error message from API exception displayed
   - Error preserved in loadError state

6. **Handles non-Error rejection gracefully**
   - Non-Error rejection caught
   - Generic message displayed: "Failed to load distributors"

### Button State Tests

7. **Disables Import button when no distributor is selected**
   - Import button disabled initially
   - Disabled when no selections

8. **Enables Import button when a distributor is selected**
   - Button becomes enabled after selection
   - Remains enabled while selections exist

9. **Shows selected count in Import button**
   - Button text shows: "Import (1)" with 1 selected
   - Updates as selections change

### Individual Selection Tests

10. **Toggles individual distributor selection**
    - Checkbox can be checked and unchecked
    - Selection state toggles correctly

11. **Allows selecting multiple distributors**
    - Multiple checkboxes can be selected
    - Button updates count: "Import (2)", "Import (3)"

### Select All Tests

12. **Toggles Select all checkbox to check all visible distributors**
    - "Select all visible" checkbox checks all items
    - Updates count to match total visible

13. **Unchecks Select all when deselecting a distributor**
    - Select all becomes unchecked if any item deselected
    - Reflects partial selection state

14. **Checks Select all when all are selected individually**
    - Select all auto-checks when all items selected manually
    - Maintains consistency

### Search/Filter Tests

15. **Filters distributors by search term**
    - Search "Premium" shows only Premium Spirits Inc
    - Other distributors hidden
    - Debounced search (200ms)

16. **Filters distributors by county**
    - Search "Kings County" shows only matching distributor
    - Case-insensitive search

17. **Shows no results when search matches nothing**
    - Empty state message displayed
    - No distributors shown

18. **Clears search results when clearing search input**
    - Full list restored after clearing input
    - All distributors visible again

### Import Operation Tests

19. **Calls importCatalogItems with selected IDs on import**
    - Function called with array of selected distributor IDs
    - Correct IDs passed: [1, 2]

20. **Shows success progress message during import**
    - Progress message: "Importing items from N distributor(s)..."
    - Visible during import operation

21. **Shows loading state on Import button during import**
    - Button text becomes "Importing..."
    - Button disabled during operation

22. **Disables checkboxes during import**
    - All checkboxes disabled while importing
    - Prevents selection changes mid-import

23. **Disables search input during import**
    - Search field disabled during import
    - Prevents search modifications

24. **Shows success message after successful import**
    - Success message: "Imported 150 items from 2 new distributor(s)."
    - Displayed after API resolves

25. **Calls completeOnboarding after successful import with delay**
    - completeOnboarding called 1.2 seconds after import
    - Allows user to see success message

### Import Error Tests

26. **Shows error message when import fails**
    - Error message from API exception displayed
    - "Import failed due to network error"

27. **Handles generic error when import fails with non-Error**
    - Non-Error rejection caught
    - Generic message: "Import failed"

28. **Re-enables UI after import error**
    - Import button re-enabled
    - Search input re-enabled
    - Checkboxes re-enabled
    - Can retry import

### Skip Button Tests

29. **Calls completeOnboarding when Skip button is clicked**
    - completeOnboarding called directly
    - No import performed

30. **Disables Skip button during import**
    - Skip button disabled while importing
    - Prevents navigation during operation

### Badge/Count Tests

31. **Shows selected count badge**
    - "0 selected" shown initially
    - "1 selected" after first selection
    - Updates dynamically

## Mock Setup

The test file uses the following mock pattern:

```typescript
const mockGetCatalogDistributors = vi.fn()
const mockImportCatalogItems = vi.fn()
const mockCompleteOnboarding = vi.fn()

beforeEach(() => {
  ;(window as any).api = {
    getCatalogDistributors: mockGetCatalogDistributors,
    importCatalogItems: mockImportCatalogItems
  }

  useAuthStore.setState({
    appState: 'distributor-onboarding',
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null
  })

  useAuthStore.setState({ completeOnboarding: mockCompleteOnboarding } as unknown as Partial<...>)
})

afterEach(() => {
  delete (window as any).api
  vi.restoreAllMocks()
})
```

## Mock Data

```typescript
const mockDistributors: CatalogDistributor[] = [
  {
    distributor_id: 1,
    distributor_name: 'Premium Spirits Inc',
    distributor_permit_id: 'PERMIT-001',
    county: 'New York County',
    post_type: 'Wholesaler'
  },
  {
    distributor_id: 2,
    distributor_name: 'Classic Wine Distributors',
    distributor_permit_id: 'PERMIT-002',
    county: 'Kings County',
    post_type: 'Supplier'
  },
  {
    distributor_id: 3,
    distributor_name: 'Local Craft Beverages',
    distributor_permit_id: 'PERMIT-003',
    county: 'New York County',
    post_type: 'Producer'
  }
]
```

## Test Patterns Used

- **userEvent.setup()** for user interactions
- **waitFor()** with timeout for debounced searches
- **screen queries** for accessible element selection
- **vi.fn()** for API mocking
- **beforeEach/afterEach** for test isolation

## Key Assertions

- Loading and empty states
- List rendering and filtering
- Checkbox selection toggling
- API calls with correct arguments
- Error messages and recovery
- Button/input disabled states
- Search debouncing
- Count badge updates

## Edge Cases Covered

- Empty distributor list
- API loading errors
- API rejection errors (non-Error)
- No selection when trying to import
- Multiple selections
- Search filtering (name and county)
- Case-insensitive search
- Debounce timing for search
- UI state during import
- Error state recovery
- Success message display with delay
- All vs individual selection consistency

## Debouncing

Search input uses `useDebounce` hook with 200ms delay. Tests account for this delay by using `waitFor()` to wait for filtered results.

## Dependencies

- React 19 + React Testing Library
- Zustand (useAuthStore)
- Vitest for test runner
- userEvent for user interactions
- window.api.getCatalogDistributors (mocked)
- window.api.importCatalogItems (mocked)
- CatalogDistributor type from shared types
