# Authentication Error Handling

**Spec file:** `tests/e2e/auth-error-handling.spec.ts`
**Suite:** `Authentication Error Handling`

Tests login PIN validation feedback, retry behavior, and keypad UX constraints.

**Mock data:** 2 cashiers, merchant config, PIN validator with invalid-attempt and lockout behavior

---

## 1. Rejects single invalid PIN entry with error message

| #   | Step              | Assertion                         |
| --- | ----------------- | --------------------------------- |
| 1   | Open login screen | PIN keypad is visible             |
| 2   | Enter 5, 6, 7, 8  | Invalid PIN error text is visible |

---

## 2. Shows invalid-pin feedback after wrong PIN

| #   | Step                          | Assertion                           |
| --- | ----------------------------- | ----------------------------------- |
| 1   | Open login and enter 5,6,7,8  | Invalid PIN error text is visible   |
| 2   | Click clear button if present | Entry can be reset for next attempt |

---

## 3. Allows valid PIN after failed attempts

| #   | Step                                 | Assertion                        |
| --- | ------------------------------------ | -------------------------------- |
| 1   | Enter wrong PIN 5,6,7,8              | Invalid PIN feedback is shown    |
| 2   | Clear PIN if clear button is visible | Input is ready for retry         |
| 3   | Enter valid PIN 1,2,3,4              | POS ticket panel becomes visible |

---

## 4. Stays on PIN login after repeated invalid entries

| #   | Step                                              | Assertion                         |
| --- | ------------------------------------------------- | --------------------------------- |
| 1   | Enter wrong PIN 5,6,7,8 three times               | Enter PIN heading remains visible |
| 2   | Clear between attempts when clear button is shown | Login does not advance to POS     |

---

## 5. Shows PIN entry fields on login screen

| #   | Step              | Assertion                        |
| --- | ----------------- | -------------------------------- |
| 1   | Open login screen | PIN keypad is visible            |
| 2   | --                | Keys 0 through 9 are all visible |

---

## 6. Shows PIN entry instead of password field on login

| #   | Step              | Assertion                              |
| --- | ----------------- | -------------------------------------- |
| 1   | Open login screen | PIN keypad is visible                  |
| 2   | --                | Email or username input is not visible |

---

## 7. Pins are touch-friendly with large buttons

| #   | Step              | Assertion                         |
| --- | ----------------- | --------------------------------- |
| 1   | Open login screen | First PIN key is visible          |
| 2   | --                | First key height is at least 50px |

---

## 8. Successful PIN leads to POS screen

| #   | Step                         | Assertion                 |
| --- | ---------------------------- | ------------------------- |
| 1   | Open login and enter 1,2,3,4 | Ticket panel is visible   |
| 2   | --                           | POS shell remains visible |
