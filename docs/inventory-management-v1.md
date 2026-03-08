# Inventory Management V1 (Desktop Popup)

## Goal
Implement a backend-driven inventory management popup opened from `F2 - Inventory` in the POS footer.

No inventory item values should be hardcoded in the frontend. All item list/search/detail values must come from backend APIs backed by SQLite.

## Scope (V1)
When user clicks `F2 - Inventory`:
- Open a management popup overlay.
- Allow creating a new inventory item.
- Allow searching existing inventory items.
- Allow selecting an item from results to view/edit form values.

## Required Item Fields (Save)
Required:
- `SKU (ItemNum)`
- `Name`
- `Department`
- `Cost`
- `Price Charged`
- `In Stock`

Also included in V1 UI:
- `Tax 1`
- `Tax 2`
- `Special Pricing` section
- `Sales History` section
- `Additional SKUs` list for an item

## UX Requirements
### Open/Close
- `F2 - Inventory` button opens popup.
- Popup has close action.

### Search
- Search input in popup.
- Results list populated from backend.
- Selecting a row loads that item details in form.

### Add Item
- Empty form mode for new item.
- Save validates required fields.
- Save persists to SQLite through backend API.
- Saved item appears in search results.

### Additional SKUs
- Per-item list of alternate SKUs.
- Add/remove entries in the popup.
- Persist through backend.

### Sales History
- Read-only section populated from backend.
- Shows recent transaction lines for selected item.
- If none, show explicit empty state.

### Special Pricing
- Minimal section in V1:
  - `Enabled` toggle
  - `Special Price` numeric value
- Persist through backend.

## Data Contract (V1)
### Product fields used by popup
- `item_number`
- `sku`
- `item_name`
- `dept_id`
- `cost`
- `retail_price` (price charged)
- `in_stock`
- `tax_1`
- `tax_2`
- `special_pricing_enabled`
- `special_price`

### Additional SKU model
- `id`
- `product_id`
- `alt_sku`

### Sales history model
- `transaction_id`
- `created_at`
- `quantity`
- `unit_price`
- `total_price`

## Backend Requirements
- Add IPC endpoints for:
  - list/search inventory
  - get single inventory item details
  - create/update inventory item
  - save additional SKUs
  - fetch sales history
- SQLite remains source of truth.

## Frontend Requirements
- Remove browser preview hardcoded product fallback.
- If backend product load fails, show backend-error state instead of mock item data.

## Out of Scope (V1)
- Full tabbed management UI from reference image.
- Complex special-pricing rules/schedules.
- Bulk CSV import/export UI.
- Sales analytics beyond recent transactional lines.
- Multi-store or permission workflows.
- ability to hold an invoice.
- ability to return an item.
- Have size properties for an item, eg, 50ml, 187ml, 375ml, 750ml, 1500ml 1 gallon, other custom sizes. This will be a global property assiable to all items.
- inventory screen, should show values like price with tax, gross margin, net margin.
- We need an option to add alerts to inventory maintaince, below a certain threshold for an item, we should get a low stock alert. Still need to decide the UI and workflow for these alerts.