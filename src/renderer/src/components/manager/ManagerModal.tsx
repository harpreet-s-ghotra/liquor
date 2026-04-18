import { useCallback, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { CashierPanel } from './cashiers/CashierPanel'
import { RegisterPanel } from './registers/RegisterPanel'
import { MerchantInfoPanel } from './merchant/MerchantInfoPanel'
import { ReorderDashboard } from './reorder/ReorderDashboard'
import { PurchaseOrderPanel } from './purchase-orders/PurchaseOrderPanel'
import type { LowStockProduct } from '../../../../shared/types'
import './manager-modal.css'

const MANAGER_TABS = [
  'cashiers',
  'registers',
  'merchant-info',
  'reorder',
  'purchase-orders'
] as const
type ManagerTab = (typeof MANAGER_TABS)[number]

const TAB_LABELS: Record<ManagerTab, string> = {
  cashiers: 'Cashiers',
  registers: 'Registers',
  'merchant-info': 'Merchant Info',
  reorder: 'Reorder Dashboard',
  'purchase-orders': 'Purchase Orders'
}

type ManagerModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function ManagerModal({ isOpen, onClose }: ManagerModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ManagerTab>('cashiers')
  const [prefillItems, setPrefillItems] = useState<LowStockProduct[] | null>(null)

  const handleCreateOrder = useCallback((items: LowStockProduct[]) => {
    setPrefillItems(items)
    setActiveTab('purchase-orders')
  }, [])

  const handlePrefillConsumed = useCallback(() => {
    setPrefillItems(null)
  }, [])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="manager-modal"
        aria-label="Manager"
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Manager</DialogTitle>

        {/* Header */}
        <div className="manager-modal__header">
          <div className="manager-modal__header-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="manager-modal__header-breadcrumb">
            <span className="manager-modal__header-label">Manager</span>
            <span className="manager-modal__header-separator">/</span>
            <span className="manager-modal__header-title">{TAB_LABELS[activeTab]}</span>
          </div>
          <button type="button" onClick={onClose} className="manager-modal__close-btn">
            Close
          </button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(tab) => setActiveTab(tab as ManagerTab)}
          className="manager-modal__tabs"
        >
          <div className="manager-modal__tab-bar">
            <TabsList className="manager-modal__tab-list">
              {MANAGER_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="manager-modal__tab-trigger">
                  {TAB_LABELS[tab]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="cashiers" className="manager-modal__tab-content">
            <CashierPanel />
          </TabsContent>
          <TabsContent value="registers" className="manager-modal__tab-content">
            <RegisterPanel />
          </TabsContent>
          <TabsContent value="merchant-info" className="manager-modal__tab-content">
            <MerchantInfoPanel />
          </TabsContent>
          <TabsContent value="reorder" className="manager-modal__tab-content">
            <ReorderDashboard onCreateOrder={handleCreateOrder} />
          </TabsContent>
          <TabsContent value="purchase-orders" className="manager-modal__tab-content">
            <PurchaseOrderPanel
              prefillItems={prefillItems}
              onPrefillConsumed={handlePrefillConsumed}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
