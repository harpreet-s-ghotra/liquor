# AuthScreen Test Suite

**Test File:** `src/renderer/src/pages/AuthScreen.test.tsx`
**Component:** `src/renderer/src/pages/AuthScreen.tsx`

## Overview

The AuthScreen test suite covers the email/password login form component. It verifies form rendering, input validation, submission handling, error display, and loading states. The component uses `useAuthStore` to manage authentication state and display errors.

## Test Coverage

- **Statements:** 96.15%
- **Branches:** 94.44%
- **Functions:** 100%
- **Lines:** 100%

## Test Cases

### Rendering Tests

1. **Renders email input, password input, and Sign In button**
   - Verifies all form elements are rendered
   - Checks for correct placeholder text
   - Confirms button is present

### Input Validation Tests

2. **Disables button when email is empty**
   - Button disabled when only password is filled

3. **Disables button when password is empty**
   - Button disabled when only email is filled

4. **Disables button when both inputs are empty**
   - Initial state has disabled button

5. **Enables button when both email and password are filled**
   - Button becomes enabled once both inputs have values

### Email Input Behavior

6. **Trims whitespace from email before calling emailLogin**
   - Whitespace around email is removed on submission
   - emailLogin receives trimmed email address

### Submission Tests

7. **Calls emailLogin with email and password on button click**
   - emailLogin called with correct arguments
   - Verified with vi.fn() mock

8. **Calls emailLogin when Enter key is pressed**
   - Both password and email fields support Enter to submit
   - Calls same emailLogin function

### Error Handling Tests

9. **Shows error message from store**
   - Error state from useAuthStore is displayed
   - Error message appears in red div

10. **Clears error when email input changes**
    - Error disappears when user modifies email field
    - Error cleared via clearError() action

11. **Clears error when password input changes**
    - Error disappears when user modifies password field

### Loading State Tests

12. **Shows loading state while submitting**
    - Button text changes to "Signing in..."
    - Visible while emailLogin promise is pending

13. **Disables inputs during submission**
    - Email and password inputs become disabled
    - Prevents user input while submitting

14. **Disables button during submission**
    - Button becomes disabled and shows loading text
    - Prevents double-submission

15. **Does not submit when button is already loading**
    - emailLogin called only once despite multiple clicks
    - Guarded by isLoading flag

### Recovery Tests

16. **Recovers from loading state when submission completes**
    - Button returns to "Sign In" after successful submission
    - Inputs re-enabled after completion

### Focus Tests

17. **Focuses email input on render**
    - Email input has autofocus attribute
    - Receives focus on component mount

## Mock Setup

The test file uses the following mock pattern:

```typescript
const mockEmailLogin = vi.fn()

beforeEach(() => {
  useAuthStore.setState({
    appState: 'auth',
    merchantConfig: null,
    error: null,
    currentCashier: null,
    currentSessionId: null,
    loginAttempts: 0,
    lockoutUntil: null
  })

  useAuthStore.setState({ emailLogin: mockEmailLogin } as unknown as Partial<...>)
})

afterEach(() => {
  vi.restoreAllMocks()
})
```

This pattern directly mocks the Zustand store action without hitting the real IPC layer.

## Test Patterns Used

- **userEvent.setup()** for realistic user interactions
- **waitFor()** for async operations
- **screen queries** for accessible element selection
- **vi.fn()** for mocking Zustand actions
- **beforeEach/afterEach** for test isolation

## Key Assertions

- Button enable/disable state based on input values
- Error message visibility and clearing
- Loading state text and disabled states
- emailLogin call arguments
- Component focuses on email input

## Edge Cases Covered

- Empty inputs on initial render
- Whitespace trimming in email
- Enter key submission
- Multiple click prevention during loading
- Error clearing on input change
- Auto-focus on mount

## Dependencies

- React 19 + React Testing Library
- Zustand (useAuthStore)
- Vitest for test runner
- userEvent for user interactions
