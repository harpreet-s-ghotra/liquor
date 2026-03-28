# Terminal Card Payments (Stax)

**Spec file:** `tests/e2e/stax-payments.spec.ts`
**Suite:** `Terminal Card Payments`

Tests credit/debit payments via a physical card terminal (Stax integration). No card entry form exists in the UI -- the terminal handles all card interaction. Tests cover success, decline, timeout, and split payment scenarios.

**Mock data:** 3 products, configurable `chargeTerminal` and `chargeWithCard` mocks (success/decline/timeout, adjustable latency)

---

## 1. Credit payment via terminal processes successfully

| #   | Step                        | Assertion                                  |
| --- | --------------------------- | ------------------------------------------ |
| 1   | Log in, add product to cart | --                                         |
| 2   | Click Credit (action panel) | "Processing test card..." processing shown |
| 3   | -- (terminal approves)      | Payment complete screen                    |
| 4   | --                          | Paid list shows "visa" and "4242"          |
| 5   | Click OK                    | Modal closes                               |

---

## 2. Debit payment via terminal processes successfully

| #   | Step                             | Assertion                                     |
| --- | -------------------------------- | --------------------------------------------- |
| 1   | Log in, add product, click Debit | Processing shown                              |
| 2   | -- (terminal approves)           | Payment complete                              |
| 3   | --                               | Paid list shows "Debit", "mastercard", "3222" |
| 4   | Click OK                         | Modal closes                                  |

---

## 3. Terminal decline shows error

| #   | Step                                             | Assertion                            |
| --- | ------------------------------------------------ | ------------------------------------ |
| 1   | Log in (decline mock), add product, click Credit | --                                   |
| 2   | -- (terminal declines)                           | Error shown: "Card declined"         |
| 3   | --                                               | Payment complete screen is NOT shown |

---

## 4. Terminal timeout shows error

| #   | Step                                             | Assertion                                       |
| --- | ------------------------------------------------ | ----------------------------------------------- |
| 1   | Log in (timeout mock), add product, click Credit | --                                              |
| 2   | -- (terminal times out)                          | Error shown: "No response from the card reader" |

---

## 5. Dismiss button clears error and allows retry

| #   | Step                                             | Assertion                                          |
| --- | ------------------------------------------------ | -------------------------------------------------- |
| 1   | Log in (decline mock), add product, click Credit | Card error visible                                 |
| 2   | Click Dismiss                                    | Error cleared                                      |
| 3   | --                                               | Credit and Debit buttons still enabled (can retry) |

---

## 6. Cancel is disabled while terminal is processing

| #   | Step                                                | Assertion                 |
| --- | --------------------------------------------------- | ------------------------- |
| 1   | Log in (5s latency mock), add product, click Credit | Processing shown          |
| 2   | --                                                  | Cancel button is disabled |

---

## 7. Split payment: cash tender + terminal card

| #   | Step                               | Assertion                                           |
| --- | ---------------------------------- | --------------------------------------------------- |
| 1   | Log in, add product, click Pay Now | Payment modal open                                  |
| 2   | Click $10 cash tender              | "$10.00 Cash" in paid list                          |
| 3   | Click Credit                       | Terminal processes remaining                        |
| 4   | --                                 | Payment complete; paid list shows "visa" and "4242" |

---

## 8. No card entry form exists -- terminal handles card details

Verifies the UI does not render any manual card input fields.

| #   | Step                              | Assertion                                   |
| --- | --------------------------------- | ------------------------------------------- |
| 1   | Log in, add product, click Credit | --                                          |
| 2   | --                                | No `card-entry-form` test ID in DOM         |
| 3   | --                                | No "Card Number" or "Card CVV" inputs exist |

---

## 9. Payment complete returns card details via OK button

| #   | Step                              | Assertion                                        |
| --- | --------------------------------- | ------------------------------------------------ |
| 1   | Log in, add product, click Credit | Terminal processes                               |
| 2   | -- (approved)                     | Paid list shows "Credit", "visa", "\*\*\*\*4242" |
| 3   | Click OK                          | Modal closes                                     |
