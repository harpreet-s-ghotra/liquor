import { useState } from 'react'
import { AppButton } from '@renderer/components/common/AppButton'
import { TabBar } from '@renderer/components/common/TabBar'
import { ItemForm } from './items/ItemForm'
import { DepartmentPanel } from './departments/DepartmentPanel'
import { TaxCodePanel } from './tax-codes/TaxCodePanel'
import { VendorPanel } from './vendors/VendorPanel'
import './inventory-modal.css'

type InventoryModalProps = {
  isOpen: boolean
  onClose: () => void
}

const topTabs = [
  { id: 'items', label: 'Items' },
  { id: 'departments', label: 'Departments' },
  { id: 'tax-codes', label: 'Tax Codes' },
  { id: 'vendors', label: 'Vendors' }
]

export function InventoryModal({ isOpen, onClose }: InventoryModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState('items')

  if (!isOpen) {
    return null
  }

  return (
    <div className="inventory-modal-backdrop">
      <div
        className="inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory Management"
      >
        {/* Header */}
        <div className="inventory-modal-header">
          <h3>Inventory Management</h3>
          <div className="inventory-header-actions">
            <AppButton size="md" variant="danger" onClick={onClose}>
              Close
            </AppButton>
          </div>
        </div>

        {/* Top-level tab bar */}
        <TabBar tabs={topTabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content */}
        <div className="inventory-modal-body" role="tabpanel">
          {activeTab === 'items' && <ItemForm />}
          {activeTab === 'departments' && <DepartmentPanel />}
          {activeTab === 'tax-codes' && <TaxCodePanel />}
          {activeTab === 'vendors' && <VendorPanel />}
        </div>
      </div>
    </div>
  )
}
