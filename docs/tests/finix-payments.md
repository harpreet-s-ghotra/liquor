# Finix Card Payments

**Spec file:** `tests/e2e/finix-payments.spec.ts`
**Suite:** `Finix Card Payments`

Tests credit and debit payments through the current Finix Phase A flow. The payment modal uses sandbox test cards in dev/E2E, so no manual card-entry form is rendered. Tests cover success, decline, timeout, retry, and split payment scenarios.

**Mock data:** 3 products, configurable `finixChargeCard` mock (success/decline/timeout, adjustable latency)

---

## 1. Credit payment processes successfully

| #   | Step                        | Assertion                         |
| --- | --------------------------- | --------------------------------- |
| 1   | Log in, add product to cart | --                                |
| 2   | Click Credit                | "Processing payment..." is shown  |
| 3   | --                          | Payment complete screen appears   |
| 4   | --                          | Paid list shows "visa" and "4242" |
| 5   | Click OK                    | Modal closes                      |

---

## 2. Debit payment processes successfully

| #   | Step                                     | Assertion                                     |
| --- | ---------------------------------------- | --------------------------------------------- |
| 1   | Log in, add product to cart, click Debit | Processing then complete                      |
| 2   | --                                       | Paid list shows "Debit", "mastercard", "4444" |
| 3   | Click OK                                 | Modal closes                                  |

---

## 3. Decline shows error

| #   | Step                                   | Assertion                     |
| --- | -------------------------------------- | ----------------------------- |
| 1   | Log in with decline mock, click Credit | --                            |
| 2   | --                                     | Error shown: "Card declined"  |
| 3   | --                                     | Payment complete is not shown |

---

## 4. Timeout shows error

| #   | Step                                   | Assertion                                       |
| --- | -------------------------------------- | ----------------------------------------------- |
| 1   | Log in with timeout mock, click Credit | --                                              |
| 2   | --                                     | Error shown: "No response from the card reader" |

---

## 5. Dismiss clears error and allows retry

| #   | Step                                   | Assertion           |
| --- | -------------------------------------- | ------------------- |
| 1   | Log in with decline mock, click Credit | Card error visible  |
| 2   | Click Retry                            | Error clears        |
| 3   | Retry credit                           | Payment can restart |

---

## 6. Cancel is disabled while payment is processing

| #   | Step                                | Assertion                 |
| --- | ----------------------------------- | ------------------------- |
| 1   | Log in with slow mock, click Credit | Processing shown          |
| 2   | --                                  | Cancel button is disabled |

---

## 7. Split payment: cash tender plus card

| #   | Step                    | Assertion                                |
| --- | ----------------------- | ---------------------------------------- |
| 1   | Log in, add product     | --                                       |
| 2   | Open Pay Now, click $10 | "$10.00 Cash" appears in paid list       |
| 3   | Click Credit            | Remaining balance charges through Finix  |
| 4   | --                      | Payment completes with visa "4242" shown |

---

## 8. No manual card entry form is rendered

Verifies the UI does not render any manual card input fields during the sandbox-card flow.

| #   | Step                 | Assertion                                   |
| --- | -------------------- | ------------------------------------------- |
| 1   | Log in, click Credit | No `card-entry-form` exists in the DOM      |
| 2   | --                   | No "Card Number" or "Card CVV" inputs exist |

---

## 9. Payment complete returns card details via OK button

| #   | Step                        | Assertion                                        |
| --- | --------------------------- | ------------------------------------------------ |
| 1   | Log in, add product to cart | --                                               |
| 2   | Click Credit                | Payment completes                                |
| 3   | --                          | Paid list shows "Credit", "visa", "\*\*\*\*4242" |
| 4   | Click OK                    | Modal closes                                     |
