# Search Modal -- Open in Inventory

**Spec file:** `tests/e2e/search-open-in-inventory.spec.ts`
**Suite:** `Search modal - Open in Inventory`

Tests the bridge between the product search modal and the inventory modal: finding a product through search and opening it directly in inventory for editing.

**Mock data:** 1 product (Cabernet Sauvignon, WINE-001) with matching inventory detail

---

## 1. Opens the inventory modal with the correct item loaded

| # | Step | Assertion |
|---|------|-----------|
| 1 | Log in | POS screen loads |
| 2 | Click "Search" button | Product Search dialog opens |
| 3 | Type "Cabernet" in search input, click Go | -- |
| 4 | -- | Search result for item 1 is visible |
| 5 | Click the search result | Item selected |
| 6 | Click "Open in Inventory" | -- |
| 7 | -- | Product Search dialog closes |
| 8 | -- | Inventory Management dialog opens |
| 9 | -- | SKU field shows "WINE-001" |
| 10 | -- | Name field shows "Cabernet Sauvignon 750ml" |
| 11 | -- | Breadcrumb shows "Edit Record: WINE-001" |
