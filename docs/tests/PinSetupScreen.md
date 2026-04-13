# Obsolete Test Doc

This file has no corresponding Playwright spec in `tests/e2e`.

It is a legacy unit-test document and should be removed from `docs/tests/` when file deletion is available.

1. **Renders admin and cashier account sections**
   - Both account sections present with correct headings
   - Admin Account and Cashier Account labels visible

2. **Renders all required input fields**
   - 2 name fields (admin and cashier)
   - 4 PIN fields (admin pin + confirm, cashier pin + confirm)
   - All with correct placeholder text

3. **Renders Create Accounts button**
   - Primary action button present
   - Shows "Create Accounts" label

### Admin Name Validation

4. **Shows error when admin name is empty**
   - Validation error: "Admin name is required"
   - Triggered on submit without admin name

### Admin PIN Validation

5. **Shows error when admin PIN is not 4 digits**
   - Validation error: "Admin PIN must be 4 digits"
   - Requires exactly PIN_LENGTH (4) digits

6. **Shows error when admin PINs do not match**
   - Validation error: "Admin PINs do not match"
   - First PIN input must equal confirmation PIN

### Cashier Name Validation

7. **Shows error when cashier name is empty**
   - Validation error: "Cashier name is required"
   - Triggered on submit without cashier name

### Cashier PIN Validation

8. **Shows error when cashier PIN is not 4 digits**
   - Validation error: "Cashier PIN must be 4 digits"
   - Requires exactly PIN_LENGTH (4) digits

9. **Shows error when cashier PINs do not match**
   - Validation error: "Cashier PINs do not match"
   - First PIN input must equal confirmation PIN

### Cross-Field Validation

10. **Shows error when admin and cashier PINs are the same**
    - Validation error: "Admin and cashier PINs must be different"
    - Ensures security by requiring different PINs

### Submission Tests

11. **Calls createCashier twice and completeSetup on valid submit**
    - First call: `createCashier({ name: 'Admin', pin: '1234', role: 'admin' })`
    - Second call: `createCashier({ name: 'Cashier', pin: '5678', role: 'cashier' })`
    - Then calls `completeSetup()`
    - Calls happen in correct sequence

12. **Trims whitespace from names before submission**
    - Input " Admin " becomes "Admin"
    - Input " John " becomes "John"
    - Whitespace trimming happens before API call

### Input Masking Tests

13. **Does not allow non-numeric input in PIN fields**
    - Input "abc123xyz" becomes "123"
    - Only digits are accepted
    - Non-digit characters filtered out

14. **Limits PIN input to 4 digits**
    - Input "123456" becomes "1234"
    - Enforced by maxLength and handlePinInput filter

### Loading State Tests

15. **Shows loading state during submission**
    - Button text changes to "Creating accounts..."
    - Visible while API calls are pending

16. **Disables inputs during submission**
    - All 6 input fields become disabled
    - Prevents user input while submitting

### Error Handling Tests

17. **Handles createCashier errors gracefully**
    - Error message displayed: "Failed to create admin"
    - Component remains functional after error

18. **Handles generic error when createCashier throws non-Error**
    - Non-Error rejection handled
    - Generic message displayed: "Failed to create accounts"

### Recovery Tests

19. **Returns to normal state after error**
    - Button re-enabled after error
    - Inputs re-enabled
    - User can retry submission

### Focus Tests

20. **Focuses admin name input on render**
    - Admin name input has autofocus attribute
    - Receives focus on component mount

## Mock Setup

The test file uses the following mock pattern:

```typescript
const mockCreateCashier = vi.fn()
const mockCompleteSetup = vi.fn()

beforeEach(() => {
  ;(window as any).api = {
    createCashier: mockCreateCashier
  }

  useAuthStore.setState({
    appState: 'pin-setup',
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null
  })

  useAuthStore.setState({ completeSetup: mockCompleteSetup } as unknown as Partial<...>)
})

afterEach(() => {
  delete (window as any).api
  vi.restoreAllMocks()
})
```

## Test Patterns Used

- **userEvent.setup()** for user interactions
- **waitFor()** for async state updates
- **screen queries** for accessible element selection
- **getAllByPlaceholderText()** for duplicate field selection
- **vi.fn()** for API mocking
- **beforeEach/afterEach** for test isolation

## Key Assertions

- Error messages displayed for validation failures
- API calls made with correct arguments
- Loading state during submission
- Inputs disabled during submission
- Error recovery and retry capability
- PIN field filtering and length limits
- Whitespace trimming

## Edge Cases Covered

- All validation rules (empty, length, matching, uniqueness)
- PIN input filtering (non-numeric, max length)
- Double submission prevention via disabled state
- Whitespace normalization in names
- Error handling and recovery
- Async operation completion tracking

## Constants Used

- `PIN_LENGTH = 4` from `src/shared/constants`
- Imported in component from shared constants

## Dependencies

- React 19 + React Testing Library
- Zustand (useAuthStore)
- Vitest for test runner
- userEvent for user interactions
- window.api.createCashier (mocked)
