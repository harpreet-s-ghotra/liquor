import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import type { HeldTransaction } from '../../../../shared/types'
import './hold-lookup-modal.css'

type HoldLookupModalProps = {
  isOpen: boolean
  heldTransactions: HeldTransaction[]
  onRecall: (held: HeldTransaction) => void
  onDelete: (held: HeldTransaction) => void
  onClearAll: () => void
  onClose: () => void
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function HoldLookupModal({
  isOpen,
  heldTransactions,
  onRecall,
  onDelete,
  onClearAll,
  onClose
}: HoldLookupModalProps): React.JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="hold-lookup" aria-label="Transaction Hold Lookup">
        {/* Header */}
        <div className="hold-lookup__header">
          <h2 className="hold-lookup__title">Transaction Hold Lookup</h2>
          {heldTransactions.length > 0 && (
            <>
              <span className="hold-lookup__count">{heldTransactions.length} on hold</span>
              <button
                type="button"
                className="hold-lookup__clear-all"
                onClick={onClearAll}
                data-testid="hold-clear-all-btn"
              >
                Clear All
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div className="hold-lookup__body">
          {heldTransactions.length === 0 ? (
            <p className="hold-lookup__empty" data-testid="hold-lookup-empty">
              No transactions on hold.
            </p>
          ) : (
            heldTransactions.map((held) => (
              <div
                key={held.id}
                className="hold-lookup__item"
                data-testid={`hold-row-${held.hold_number}`}
              >
                <button
                  type="button"
                  className="hold-lookup__item-btn"
                  onClick={() => onRecall(held)}
                >
                  <span className="hold-lookup__item-number">Hold #{held.hold_number}</span>
                  <span className="hold-lookup__item-count">
                    {held.item_count} item{held.item_count !== 1 ? 's' : ''}
                  </span>
                  <span className="hold-lookup__item-total">${held.total.toFixed(2)}</span>
                  <span className="hold-lookup__item-time">{formatTime(held.held_at)}</span>
                </button>
                <button
                  type="button"
                  className="hold-lookup__delete-btn"
                  onClick={() => onDelete(held)}
                  data-testid={`hold-delete-${held.hold_number}`}
                  aria-label={`Delete Hold #${held.hold_number}`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
                      stroke="currentColor"
                      strokeWidth="1.33"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
