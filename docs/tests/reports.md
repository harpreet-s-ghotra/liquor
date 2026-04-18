# Reports

**Spec file:** `tests/e2e/reports.spec.ts`
**Suite:** `Sales Reports`

Tests opening the reports modal, switching report tabs, and visibility of summary/export controls.

**Mock data:** summary metrics, one product-analysis row, one tax row, and comparison payloads

---

## 1. Opens Reports modal via F5 shortcut bar button

| #   | Step                            | Assertion                             |
| --- | ------------------------------- | ------------------------------------- |
| 1   | Click bottom-bar Reports button | Sales Reports title is visible        |
| 2   | --                              | Sales Summary tab label is visible    |
| 3   | --                              | Product Analysis tab label is visible |
| 4   | --                              | Tax Report tab label is visible       |
| 5   | --                              | Comparisons tab label is visible      |

---

## 2. Displays summary cards with data

| #   | Step               | Assertion                           |
| --- | ------------------ | ----------------------------------- |
| 1   | Open Reports modal | Sales Reports title is visible      |
| 2   | --                 | Gross Sales card label is visible   |
| 3   | --                 | Net Sales card label is visible     |
| 4   | --                 | Tax Collected card label is visible |
| 5   | --                 | Transactions card label is visible  |

---

## 3. Switches to Product Analysis tab

| #   | Step                       | Assertion                          |
| --- | -------------------------- | ---------------------------------- |
| 1   | Open Reports modal         | Sales Reports title is visible     |
| 2   | Click Product Analysis tab | Top Products by Revenue is visible |
| 3   | --                         | Test Wine row is visible           |

---

## 4. Switches to Tax Report tab

| #   | Step                 | Assertion                        |
| --- | -------------------- | -------------------------------- |
| 1   | Open Reports modal   | Sales Reports title is visible   |
| 2   | Click Tax Report tab | Tax Code table header is visible |
| 3   | --                   | Rate table header is visible     |

---

## 5. Switches to Comparisons tab and shows Compare button

| #   | Step                  | Assertion                       |
| --- | --------------------- | ------------------------------- |
| 1   | Open Reports modal    | Sales Reports title is visible  |
| 2   | Click Comparisons tab | Period A range label is visible |
| 3   | --                    | Period B range label is visible |
| 4   | --                    | Compare button is visible       |

---

## 6. Shows export buttons on summary tab

| #   | Step               | Assertion                      |
| --- | ------------------ | ------------------------------ |
| 1   | Open Reports modal | Sales Reports title is visible |
| 2   | --                 | Download PDF button is visible |
| 3   | --                 | Download CSV button is visible |
