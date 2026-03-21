export const INVENTORY_TABS = ['items', 'departments', 'tax-codes', 'vendors'] as const
export type InventoryTab = (typeof INVENTORY_TABS)[number]
