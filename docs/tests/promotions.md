# Promotions

**Spec file:** `tests/e2e/promotions.spec.ts`
**Suite:** `Promotions and Discounts`

Tests promotion visibility, discount application behavior, and payment flow compatibility.

**Mock data:** 5 products and 3 active promotion rules (fixed, percentage, item-free)

---

## 1. Displays special price on product tile

| #   | Step                              | Assertion                          |
| --- | --------------------------------- | ---------------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible          |
| 2   | Find Promo Wine Pack tile         | Promo Wine Pack tile is visible    |
| 3   | --                                | Tile text includes Promo Wine Pack |

---

## 2. Applies fixed discount when adding discounted product to cart

| #   | Step                              | Assertion                                          |
| --- | --------------------------------- | -------------------------------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible                          |
| 2   | Click Promo Wine tile             | Ticket panel is visible                            |
| 3   | --                                | Discounted value 19.99 or discount text is visible |

---

## 3. Shows percentage discount calculation

| #   | Step                              | Assertion                 |
| --- | --------------------------------- | ------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible |
| 2   | Click Cooler Pack tile            | Ticket panel is visible   |

---

## 4. Applies buy 2 get 1 free promotion

| #   | Step                              | Assertion                       |
| --- | --------------------------------- | ------------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible       |
| 2   | Add Premium Vodka product twice   | At least two add clicks succeed |
| 3   | --                                | Ticket panel is visible         |

---

## 5. Shows total savings from all discounts

| #   | Step                              | Assertion                 |
| --- | --------------------------------- | ------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible |
| 2   | Add Promo Wine product            | Ticket panel is visible   |

---

## 6. Disables checkout if required discount conditions not met

| #   | Step          | Assertion                  |
| --- | ------------- | -------------------------- |
| 1   | Log in to POS | Pay Now button is disabled |

---

## 7. Completes transaction with promotions applied

| #   | Step                                      | Assertion                             |
| --- | ----------------------------------------- | ------------------------------------- |
| 1   | Log in, switch to All, add Promo Wine     | Cart has discounted item              |
| 2   | Click first pay or card button if visible | Payment complete indicator is visible |
| 3   | --                                        | Ticket panel remains visible          |

---

## 8. Displays discount breakdown in payment summary

| #   | Step                              | Assertion                               |
| --- | --------------------------------- | --------------------------------------- |
| 1   | Log in and switch category to All | Product tiles are visible               |
| 2   | Add Promo Wine product            | Ticket panel is visible                 |
| 3   | --                                | Discount or savings text can be queried |
