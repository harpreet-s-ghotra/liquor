# BusinessSetupScreen Tests

## Overview

Comprehensive unit test suite for the `BusinessSetupScreen` component, which handles business information collection during the Finix merchant onboarding flow.

**Test File:** `src/renderer/src/pages/BusinessSetupScreen.test.tsx`  
**Component:** `src/renderer/src/pages/BusinessSetupScreen.tsx`  
**Coverage:** 100% (44 tests)

## Test Categories

### 1. Rendering Tests (5 tests)

Tests that verify the component renders all form sections and fields correctly.

| Test                                            | Purpose                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `renders form sections and labels`              | Verifies both "Business Information" and "Owner / Principal" sections render with all labels         |
| `renders owner section fields`                  | Confirms all owner/principal fields are present (first name, last name, email, phone, DOB, SSN, EIN) |
| `renders submit button`                         | Verifies the "Activate Payment Processing" button is present                                         |
| `renders business type select with all options` | Confirms select dropdown includes all 4 business types                                               |
| `renders state select with all US states`       | Verifies all 51 US states/territories are available in the state select                              |

### 2. Validation Tests (17 tests)

Tests that verify all required field validations work correctly.

| Field             | Test                                          | Expected Error                         |
| ----------------- | --------------------------------------------- | -------------------------------------- |
| Business Name     | `shows error when business name is empty`     | "Business name is required"            |
| Doing Business As | `shows error when doing business as is empty` | "Doing business as is required"        |
| Business Phone    | `shows error when business phone is empty`    | "Business phone is required"           |
| Address Line 1    | `shows error when address line 1 is empty`    | "Address line 1 is required"           |
| City              | `shows error when city is empty`              | "City is required"                     |
| State             | `shows error when state is not selected`      | "State is required"                    |
| ZIP Code          | `shows error when ZIP code is not 5 digits`   | "ZIP code must be 5 digits"            |
| First Name        | `shows error when first name is empty`        | "Owner first name is required"         |
| Last Name         | `shows error when last name is empty`         | "Owner last name is required"          |
| Email             | `shows error when email is empty`             | "Owner email is required"              |
| Phone             | `shows error when owner phone is empty`       | "Owner phone is required"              |
| Birth Month       | `shows error when birth month is invalid`     | "Valid birth month is required (1-12)" |
| Birth Day         | `shows error when birth day is invalid`       | "Valid birth day is required (1-31)"   |
| Birth Year        | `shows error when birth year is invalid`      | "Valid birth year is required"         |
| SSN Last 4        | `shows error when SSN last 4 is not 4 digits` | "SSN last 4 must be exactly 4 digits"  |
| EIN               | `shows error when EIN is not 9 digits`        | "EIN must be exactly 9 digits"         |

### 3. Input Formatting Tests (12 tests)

Tests that verify numeric input filtering and field length limits.

#### Numeric-Only Input (6 tests)

- `allows only numeric input in ZIP code field` — Filters out letters, keeps only digits
- `allows only numeric input in birth month field`
- `allows only numeric input in birth day field`
- `allows only numeric input in birth year field`
- `allows only numeric input in SSN last 4 field`
- `allows only numeric input in EIN field`

#### Max Length Limits (6 tests)

- `limits ZIP code to 5 digits`
- `limits birth month to 2 digits`
- `limits birth day to 2 digits`
- `limits birth year to 4 digits`
- `limits SSN last 4 to 4 digits`
- `limits EIN to 9 digits`

### 4. Successful Submission Tests (4 tests)

Tests that verify successful form submission and API interaction.

| Test                                                                       | Behavior                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `calls finixProvisionMerchant with correctly shaped input on valid submit` | Verifies API is called with the exact expected data shape including address object structure     |
| `calls completeBusinessSetup after successful finixProvisionMerchant`      | Confirms auth store action is called after successful API response                               |
| `trims whitespace from text fields before submission`                      | Verifies all text fields are trimmed before submission (handles user copy-paste with whitespace) |
| `omits address line 2 if empty during submission`                          | Confirms optional address line 2 is excluded from API payload when empty                         |

### 5. Loading State Tests (2 tests)

Tests that verify UI correctly shows loading state during submission.

| Test                                    | Behavior                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `shows loading state during submission` | Button text changes to "Activating payments..." during request             |
| `disables inputs during submission`     | All form fields and selects are disabled to prevent concurrent submissions |

### 6. Error Handling Tests (4 tests)

Tests that verify error states and user feedback.

| Test                                                                 | Behavior                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `shows error when finixProvisionMerchant throws`                     | Error message displays when API call fails                                    |
| `strips IPC prefix from error messages`                              | Electron IPC error prefix is removed before display (user sees plain message) |
| `handles generic error when finixProvisionMerchant throws non-Error` | Gracefully handles non-Error objects as exceptions                            |
| `clears error on new submission attempt`                             | Error message is cleared when user submits again                              |
| `re-enables inputs after error during submission`                    | Form becomes interactive again after error (enables retry)                    |

## Test Patterns

### Mock Setup

```typescript
beforeEach(() => {
  ;(window as any).api = {
    finixProvisionMerchant: mockFinixProvisionMerchant
  }

  useAuthStore.setState({
    completeBusinessSetup: mockCompleteBusinessSetup
  })
})
```

### User Interaction Pattern

```typescript
const user = userEvent.setup()
await user.type(inputElement, 'value')
await user.selectOptions(selectElement, 'option-value')
await user.click(submitButton)
```

### API Assertion Pattern

```typescript
await waitFor(() => {
  expect(mockFinixProvisionMerchant).toHaveBeenCalledWith({
    business_name: 'Test Business LLC'
    // ... full payload
  })
})
```

## Data Types

### BusinessInfoInput (expected API shape)

```typescript
{
  business_name: string
  doing_business_as: string
  business_type: 'INDIVIDUAL_SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'LIMITED_LIABILITY_COMPANY' | 'CORPORATION'
  business_phone: string
  business_address: {
    line1: string
    line2?: string  // Optional if empty
    city: string
    region: string (2-letter state code)
    postal_code: string (5 digits)
    country: 'US'
  }
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: { year: number; month: number; day: number }
  tax_id: string (4 digits — SSN last 4)
  business_tax_id: string (9 digits — EIN)
}
```

## Edge Cases Tested

1. **Whitespace Handling** — Leading/trailing spaces are trimmed from text fields
2. **Optional Fields** — Address line 2 is omitted from payload if empty
3. **Non-Error Objects** — Gracefully handles rejected promises with non-Error values
4. **IPC Error Prefix** — Strips Electron IPC wrapper from error messages
5. **Field Interaction** — Validations run independently; partial forms show appropriate errors
6. **Retry Logic** — Users can correct errors and resubmit without page reload

## Running the Tests

### Run all tests

```bash
npm run test:watch -- BusinessSetupScreen.test.tsx --run
```

### Watch mode (development)

```bash
npm run test:watch -- BusinessSetupScreen.test.tsx
```

### With coverage

```bash
npm run test:watch -- BusinessSetupScreen.test.tsx --coverage --run
```

### Coverage result

**Component coverage: 100%** (statements, branches, functions, lines)

## Key Implementation Details

- **Validation:** Client-side validation runs on submit button click; error message cleared on retry
- **API Payload:** Whitespace trimmed, optional fields excluded if empty
- **Loading State:** Button text and disabled state change during submission; all inputs disabled
- **Error Handling:** IPC errors have prefix stripped via `stripIpcPrefix()` utility
- **Auth Flow:** After successful merchant provisioning, calls `completeBusinessSetup()` to transition auth state

## Related Files

- Component: [src/renderer/src/pages/BusinessSetupScreen.tsx](src/renderer/src/pages/BusinessSetupScreen.tsx)
- Auth Store: [src/renderer/src/store/useAuthStore.ts](src/renderer/src/store/useAuthStore.ts)
- IPC Error Utility: [src/renderer/src/utils/ipc-error.ts](src/renderer/src/utils/ipc-error.ts)
- Shared Types: [src/shared/types/index.ts](src/shared/types/index.ts)
