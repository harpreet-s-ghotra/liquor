# Refunds

**Spec file:** `tests/e2e/refunds.spec.ts`
**Suite:** `Refund Workflow`

Tests the sales-history recall flow used to load past transactions back into the ticket and complete returns.

**Mock data:** recent transaction list with transaction numbers and line items for recall

---

## 1. Opens Sales History modal via F7 shortcut

| #   | Step                                  | Assertion                        |
| --- | ------------------------------------- | -------------------------------- |
| 1   | Click bottom-bar Sales History button | Sales History heading is visible |

---

## 2. Displays past transactions in the list

| #   | Step                     | Assertion                               |
| --- | ------------------------ | --------------------------------------- |
| 1   | Open Sales History modal | Sales History heading is visible        |
| 2   | --                       | Transaction TXN-20260328-001 is visible |
| 3   | --                       | Transaction TXN-20260328-002 is visible |

---

## 3. Expands a transaction to show details

| #   | Step                               | Assertion                                |
| --- | ---------------------------------- | ---------------------------------------- |
| 1   | Open Sales History modal           | Sales History heading is visible         |
| 2   | Click transaction TXN-20260328-001 | Cabernet Sauvignon 750ml line is visible |
| 3   | --                                 | Craft IPA 6-Pack line is visible         |

---

## 4. Shows Recall for Return button on expanded transaction

| #   | Step                                           | Assertion                         |
| --- | ---------------------------------------------- | --------------------------------- |
| 1   | Open Sales History and expand TXN-20260328-001 | Recall button test id is visible  |
| 2   | --                                             | Recall for Return text is visible |

---

## 5. Recalling a transaction loads it into the ticket panel for return

| #   | Step                                           | Assertion                                   |
| --- | ---------------------------------------------- | ------------------------------------------- |
| 1   | Open Sales History and expand TXN-20260328-001 | Recall action is available                  |
| 2   | Click Recall for Return                        | Sales History heading is no longer visible  |
| 3   | --                                             | Ticket panel shows Cabernet Sauvignon 750ml |
| 4   | --                                             | Ticket panel shows Craft IPA 6-Pack         |

---

## 6. Recalled invoice disappears from main screen after refund completes

| #   | Step                                           | Assertion                          |
| --- | ---------------------------------------------- | ---------------------------------- |
| 1   | Open Sales History and recall TXN-20260328-001 | Recall banner is visible           |
| 2   | Click Return All                               | Recall banner contains Returning   |
| 3   | Click Process Refund                           | Refund payment modal is visible    |
| 4   | Click Cash (Exact)                             | Payment complete state is visible  |
| 5   | Click payment OK                               | Recall banner is no longer visible |
| 6   | --                                             | Ticket panel line items count is 0 |
