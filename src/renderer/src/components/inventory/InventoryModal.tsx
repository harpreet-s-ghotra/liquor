import { useCallback, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { Button } from '@renderer/components/ui/button'
import { ItemForm, type ItemFormHandle, type ItemFormButtonState } from './items/ItemForm'
import { DepartmentPanel } from './departments/DepartmentPanel'
import { TaxCodePanel } from './tax-codes/TaxCodePanel'
import { VendorPanel } from './vendors/VendorPanel'

type InventoryModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function InventoryModal({ isOpen, onClose }: InventoryModalProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('items')
  const itemFormRef = useRef<ItemFormHandle>(null)
  const [itemBtnState, setItemBtnState] = useState<ItemFormButtonState>({
    canNew: false,
    canSave: true
  })
  const handleItemButtonState = useCallback(
    (state: ItemFormButtonState) => setItemBtnState(state),
    []
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[min(82rem,100%)] h-[min(96vh,56rem)] grid gap-3 grid-rows-[auto_1fr] p-3"
        aria-label="Inventory Management"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle>Inventory Management</DialogTitle>
          <div className="inline-flex gap-2">
            <Button size="md" variant="danger" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Tab content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="grid grid-rows-[auto_1fr] min-h-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="tax-codes">Tax Codes</TabsTrigger>
              <TabsTrigger value="vendors">Vendors</TabsTrigger>
            </TabsList>
            {activeTab === 'items' && (
              <div className="flex gap-2">
                <Button
                  size="md"
                  onClick={() => itemFormRef.current?.handleNewItem()}
                  disabled={!itemBtnState.canNew}
                >
                  New Item
                </Button>
                <Button
                  size="md"
                  variant="success"
                  onClick={() => itemFormRef.current?.handleSave()}
                  disabled={!itemBtnState.canSave}
                >
                  Save Item
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="items" className="min-h-0 overflow-hidden">
            <ItemForm ref={itemFormRef} onButtonStateChange={handleItemButtonState} />
          </TabsContent>
          <TabsContent value="departments" className="min-h-0 overflow-hidden">
            <DepartmentPanel />
          </TabsContent>
          <TabsContent value="tax-codes" className="min-h-0 overflow-hidden">
            <TaxCodePanel />
          </TabsContent>
          <TabsContent value="vendors" className="min-h-0 overflow-hidden">
            <VendorPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
