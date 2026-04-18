# Printer Settings

**Spec file:** `tests/e2e/printer-settings.spec.ts`
**Suite:** `Printer Settings Modal`

Tests printer modal access, configuration controls, and print-sample state behavior.

**Mock data:** 3 printers (USB, Network, Thermal), default receipt config, active session and POS shell APIs

---

## 1. Opens printer settings modal from header settings button

| #   | Step                         | Assertion                           |
| --- | ---------------------------- | ----------------------------------- |
| 1   | Click header settings button | Settings dropdown is visible        |
| 2   | Click Printer Settings       | Printer Settings heading is visible |
| 3   | --                           | Receipt Printer section is visible  |

---

## 2. Displays available printers in dropdown

| #   | Step                        | Assertion                     |
| --- | --------------------------- | ----------------------------- |
| 1   | Open Printer Settings modal | Modal heading is visible      |
| 2   | --                          | USB Printer option exists     |
| 3   | --                          | Network Printer option exists |
| 4   | --                          | Thermal Printer option exists |

---

## 3. Updates printer status when printer is selected

| #   | Step                        | Assertion                         |
| --- | --------------------------- | --------------------------------- |
| 1   | Open Printer Settings modal | Printer Status section is visible |
| 2   | Select USB Printer          | Connected status text is visible  |

---

## 4. Allows editing store name and footer message

| #   | Step                                   | Assertion                            |
| --- | -------------------------------------- | ------------------------------------ |
| 1   | Open Printer Settings modal            | Text inputs are visible              |
| 2   | Fill Store Name as My Liquor Store     | Store Name input keeps entered value |
| 3   | Fill Footer as Thank you for shopping! | Footer input keeps entered value     |

---

## 5. Allows adjusting font size with increment/decrement buttons

| #   | Step                        | Assertion                  |
| --- | --------------------------- | -------------------------- |
| 1   | Open Printer Settings modal | Font size starts at 10 pt  |
| 2   | Click increment once        | Font size shows 11 pt      |
| 3   | Click increment again       | Font size shows 12 pt      |
| 4   | Click decrement once        | Font size returns to 11 pt |

---

## 6. Allows adjusting receipt margins (padding)

| #   | Step                        | Assertion                |
| --- | --------------------------- | ------------------------ |
| 1   | Open Printer Settings modal | Y padding starts at 4 pt |
| 2   | Increment Y padding         | Y padding shows 6 pt     |
| 3   | Check X padding value       | X padding starts at 4 pt |
| 4   | Increment X padding         | X padding shows 6 pt     |

---

## 7. Toggles Always Print checkbox

| #   | Step                        | Assertion                          |
| --- | --------------------------- | ---------------------------------- |
| 1   | Open Printer Settings modal | Always Print checkbox is unchecked |
| 2   | Click Always Print          | Checkbox becomes checked           |
| 3   | Click Always Print again    | Checkbox becomes unchecked         |

---

## 8. Saves receipt configuration

| #   | Step                        | Assertion                                 |
| --- | --------------------------- | ----------------------------------------- |
| 1   | Open Printer Settings modal | Modal is visible                          |
| 2   | Select Network Printer      | Printer selection updates                 |
| 3   | Fill Store Name and Footer  | Fields hold updated values                |
| 4   | Click Save Settings         | Printer Settings Saved heading is visible |
| 5   | --                          | Save confirmation message is visible      |

---

## 9. Print sample button disabled state changes based on printer selection

| #   | Step                        | Assertion                       |
| --- | --------------------------- | ------------------------------- |
| 1   | Open Printer Settings modal | Print Sample button is visible  |
| 2   | Select blank printer option | Print Sample button is disabled |

---

## 10. Print sample button is enabled when printer is connected

| #   | Step                                | Assertion                      |
| --- | ----------------------------------- | ------------------------------ |
| 1   | Open Printer Settings modal         | Printer selector is visible    |
| 2   | Select USB Printer and wait briefly | Print Sample button is enabled |

---

## 11. Allows selecting different sample receipt types

| #   | Step                                         | Assertion                         |
| --- | -------------------------------------------- | --------------------------------- |
| 1   | Open Printer Settings and select USB Printer | Sample type selector is available |
| 2   | --                                           | basic option exists               |
| 3   | --                                           | with-promo option exists          |
| 4   | --                                           | many-items option exists          |
| 5   | --                                           | with-message option exists        |
| 6   | Select with-promo                            | Selector value becomes with-promo |

---

## 12. Resets all settings to defaults

| #   | Step                                           | Assertion                   |
| --- | ---------------------------------------------- | --------------------------- |
| 1   | Open Printer Settings modal                    | Modal is visible            |
| 2   | Change store name, font size, and always print | Values differ from defaults |
| 3   | Click Reset to Defaults                        | Store name is cleared       |
| 4   | --                                             | Font size returns to 10 pt  |
| 5   | --                                             | Always Print is unchecked   |

---

## 13. Closes modal with dismiss button

| #   | Step                        | Assertion                               |
| --- | --------------------------- | --------------------------------------- |
| 1   | Open Printer Settings modal | Printer Settings heading is visible     |
| 2   | Click Dismiss               | Printer Settings heading is not visible |
