import { ElectronAPI } from '@electron-toolkit/preload'

type Product = {
  id: number
  sku: string
  name: string
  category: string
  price: number
  quantity: number
  tax_rate: number
}

type AppApi = {
  getProducts: () => Promise<Product[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: AppApi
  }
}
