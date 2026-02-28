export type Product = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  quantity: number
  tax_rate: number
}

export type CartItem = Product & {
  kind?: 'product'
  itemDiscountPercent?: number
  lineQuantity: number
}

export type TransactionDiscountItem = {
  id: number
  kind: 'transaction-discount'
  name: string
  lineQuantity: 1
  price: number
  discountRate: number
}

export type CartLineItem = CartItem | TransactionDiscountItem
