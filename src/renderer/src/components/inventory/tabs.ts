export const INVENTORY_TABS = ['items', 'item-types', 'tax-codes', 'distributors'] as const
export type InventoryTab = (typeof INVENTORY_TABS)[number]
