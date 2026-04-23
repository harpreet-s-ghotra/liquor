import { useCallback, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { AppModalHeader } from '@renderer/components/common/AppModalHeader'
import { ManagerIcon } from '@renderer/components/common/modal-icons'
import { CashierPanel } from './cashiers/CashierPanel'
import { RegisterPanel } from './registers/RegisterPanel'
import { MerchantInfoPanel } from './merchant/MerchantInfoPanel'
import { ReorderDashboard } from './reorder/ReorderDashboard'
import { PurchaseOrderPanel } from './purchase-orders/PurchaseOrderPanel'
import { DataHistoryPanel } from './history/DataHistoryPanel'
import type { ReorderProduct } from '@renderer/types/pos'
import './manager-modal.css'

const MANAGER_TABS = [
  'cashiers',
  'registers',
  'merchant-info',
  'reorder',
  'purchase-orders',
  'data-history'
] as const
type ManagerTab = (typeof MANAGER_TABS)[number]

const TAB_LABELS: Record<ManagerTab, string> = {
  cashiers: 'Cashiers',
  registers: 'Registers',
  'merchant-info': 'Merchant Info',
  reorder: 'Reorder Dashboard',
  'purchase-orders': 'Purchase Orders',
  'data-history': 'Data History'
}

type ManagerModalProps = {
  isOpen: boolean
  onClose: () => void
}

const LAST_TAB_KEY = 'manager-modal-last-tab'

function readLastTab(): ManagerTab {
  try {
    const saved = localStorage.getItem(LAST_TAB_KEY)
    return MANAGER_TABS.includes(saved as ManagerTab) ? (saved as ManagerTab) : 'cashiers'
  } catch {
    return 'cashiers'
  }
}

export function ManagerModal({ isOpen, onClose }: ManagerModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ManagerTab>(readLastTab)
  const [prefillItems, setPrefillItems] = useState<ReorderProduct[] | null>(null)
  const [prefillDistributor, setPrefillDistributor] = useState<number | null>(null)
  const [prefillUnitThreshold, setPrefillUnitThreshold] = useState(10)

  const handleTabChange = useCallback((tab: ManagerTab): void => {
    setActiveTab(tab)
    try {
      localStorage.setItem(LAST_TAB_KEY, tab)
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleCreateOrder = useCallback(
    (items: ReorderProduct[], distributor: number | 'unassigned' | null, unitThreshold: number) => {
      setPrefillItems(items)
      setPrefillDistributor(typeof distributor === 'number' ? distributor : null)
      setPrefillUnitThreshold(unitThreshold)
      handleTabChange('purchase-orders')
    },
    [handleTabChange]
  )

  const handlePrefillConsumed = useCallback(() => {
    setPrefillItems(null)
    setPrefillDistributor(null)
    setPrefillUnitThreshold(10)
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

        <AppModalHeader
          icon={<ManagerIcon />}
          label="Manager"
          title={TAB_LABELS[activeTab]}
          onClose={onClose}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(tab) => handleTabChange(tab as ManagerTab)}
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
              prefillDistributor={prefillDistributor}
              prefillUnitThreshold={prefillUnitThreshold}
              onPrefillConsumed={handlePrefillConsumed}
            />
          </TabsContent>
          <TabsContent value="data-history" className="manager-modal__tab-content">
            <DataHistoryPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
