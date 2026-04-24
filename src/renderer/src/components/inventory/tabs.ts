export const INVENTORY_TABS = [
  'items',
  'item-types',
  'tax-codes',
  'distributors',
  'reorder',
  'purchase-orders'
] as const
export type InventoryTab = (typeof INVENTORY_TABS)[number]
