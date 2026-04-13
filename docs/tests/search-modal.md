# Search Modal

**Spec file:** `tests/e2e/search-modal.spec.ts`
**Suite:** `Search Modal`

Tests the standalone product search modal, including result metadata columns and item type or distributor filters.

**Mock data:** 3 products with size and distributor metadata, 3 item types, 2 distributors, in-memory `searchProducts` filtering

---

## 1. Search results show size and distributor columns

| #   | Step                                         | Assertion                                    |
| --- | -------------------------------------------- | -------------------------------------------- |
| 1   | Log in and click the Search button           | Product Search dialog opens                  |
| 2   | Type "wine" in the search input and click Go | Search result row 1 is visible               |
| 3   | --                                           | Size column shows "750ml"                    |
| 4   | --                                           | Distributor column shows "Premium Wines Inc" |

---

## 2. Search results show dash for null size and distributor

| #   | Step                                        | Assertion                           |
| --- | ------------------------------------------- | ----------------------------------- |
| 1   | Log in and click the Search button          | Product Search dialog opens         |
| 2   | Type "IPA" in the search input and click Go | Search result row 2 is visible      |
| 3   | --                                          | Size column shows an em dash        |
| 4   | --                                          | Distributor column shows an em dash |

---

## 3. Filters search results by item type

| #   | Step                                            | Assertion                           |
| --- | ----------------------------------------------- | ----------------------------------- |
| 1   | Log in and click the Search button              | Product Search dialog opens         |
| 2   | Select "Spirits" in the item type filter        | --                                  |
| 3   | Type "premium" in the search input and click Go | Search result row 3 is visible      |
| 4   | --                                              | Search result row 1 is not rendered |

---

## 4. Filters search results by distributor

| #   | Step                                                | Assertion                           |
| --- | --------------------------------------------------- | ----------------------------------- |
| 1   | Log in and click the Search button                  | Product Search dialog opens         |
| 2   | Select "ABC Distributors" in the distributor filter | --                                  |
| 3   | Type "premium" in the search input and click Go     | Search result row 3 is visible      |
| 4   | --                                                  | Search result row 1 is not rendered |
