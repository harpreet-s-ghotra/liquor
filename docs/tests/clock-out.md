# Clock Out

**Spec file:** `tests/e2e/clock-out.spec.ts`
**Suite:** `Clock Out`

Tests the clock out workflow: opening the session modal via F3 or the Clock In/Out button, viewing sessions, confirming clock out with PIN entry, viewing the end-of-day report, printing the report, and navigating back.

**Mock data:** 1 product (Cabernet Sauvignon), 1 active session, 1 closed session, sample clock-out report with department sales, payment method breakdown, and cash reconciliation

---

## 1. F3 opens the clock out modal with session list

| #   | Step             | Assertion                                |
| --- | ---------------- | ---------------------------------------- |
| 1   | Log in, press F3 | "Sessions" heading is visible            |
| 2   | --               | Session list (`session-list`) is visible |
| 3   | --               | "Active" status label is visible         |
| 4   | --               | "Closed" status label is visible         |

---

## 2. Clicking Clock In/Out button opens the modal

| #   | Step                                              | Assertion                                |
| --- | ------------------------------------------------- | ---------------------------------------- |
| 1   | Log in, click "Clock In/Out" button in bottom bar | "Sessions" heading is visible            |
| 2   | --                                                | Session list (`session-list`) is visible |

---

## 3. Clock Out button shows PIN entry

| #   | Step                                     | Assertion                                                     |
| --- | ---------------------------------------- | ------------------------------------------------------------- |
| 1   | Log in, press F3                         | Session list visible                                          |
| 2   | Click Clock Out button (`clock-out-btn`) | "Confirm Clock Out" heading is visible                        |
| 3   | --                                       | PIN entry (`pin-entry`) is visible                            |
| 4   | --                                       | Text "Enter your PIN or an admin PIN to clock out" is visible |

---

## 4. Full clock-out flow: PIN entry -> report

| #   | Step                                  | Assertion                                        |
| --- | ------------------------------------- | ------------------------------------------------ |
| 1   | Log in, press F3                      | Session list visible                             |
| 2   | Click Clock Out button                | PIN entry visible                                |
| 3   | Enter PIN 1-2-3-4 via pin pad buttons | --                                               |
| 4   | -- (auto-submits)                     | "End of Day Report" heading is visible           |
| 5   | --                                    | Clock-out report (`clock-out-report`) is visible |
| 6   | --                                    | "Spirits" department visible in report           |
| 7   | --                                    | "Wine" department visible in report              |
| 8   | --                                    | "Cash Reconciliation" section visible            |
| 9   | --                                    | "Print Report" button is visible                 |
| 10  | --                                    | "Close" button is visible                        |

---

## 5. Print Report button works

| #   | Step                                                 | Assertion                                                       |
| --- | ---------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Log in, press F3, click Clock Out, enter PIN 1-2-3-4 | "End of Day Report" visible                                     |
| 2   | Click "Print Report" button                          | "Print Report" button is still visible (reverts after printing) |

---

## 6. View Report on closed session shows read-only report

| #   | Step                                                        | Assertion                                        |
| --- | ----------------------------------------------------------- | ------------------------------------------------ |
| 1   | Log in, press F3                                            | Session list visible                             |
| 2   | Click "View Report" on closed session (`view-report-btn-2`) | "End of Day Report" heading is visible           |
| 3   | --                                                          | Clock-out report (`clock-out-report`) is visible |

---

## 7. Close button returns to POS screen

| #   | Step                 | Assertion                                       |
| --- | -------------------- | ----------------------------------------------- |
| 1   | Log in, press F3     | Session list visible                            |
| 2   | Click "Close" button | Session list is no longer visible               |
| 3   | --                   | Product tiles are visible (POS screen restored) |

---

## 8. PIN Cancel returns to session list

| #   | Step                              | Assertion                      |
| --- | --------------------------------- | ------------------------------ |
| 1   | Log in, press F3, click Clock Out | PIN entry visible              |
| 2   | Click "Cancel" button             | "Sessions" heading is visible  |
| 3   | --                                | PIN entry is no longer visible |

---

## 9. Re-opening modal after clock-out shows active session

| #   | Step                                                 | Assertion                                                               |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Log in, press F3, click Clock Out, enter PIN 1-2-3-4 | "End of Day Report" is visible                                          |
| 2   | Click "Close" button                                 | Session list is no longer visible                                       |
| 3   | Press F3                                             | Session list (`session-list`) is visible                                |
| 4   | --                                                   | "Active" status label is visible in session list (auto-created session) |
