export const INVENTORY_TABS = ['items', 'departments', 'tax-codes', 'distributors'] as const
export type InventoryTab = (typeof INVENTORY_TABS)[number]
