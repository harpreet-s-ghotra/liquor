import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import type { HeldTransaction } from '../../../../shared/types'

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
      <DialogContent
        className="w-[480px] flex flex-col p-0 overflow-hidden rounded-2xl bg-(--bg-panel) border border-(--border-default) shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.4)]"
        aria-label="Transaction Hold Lookup"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--border-default) bg-[#2d3133]">
          <h2 className="text-[15px] font-black text-[#e8ecf0] m-0">Transaction Hold Lookup</h2>
          {heldTransactions.length > 0 && (
            <>
              <span className="ml-auto text-[0.75rem] font-bold text-(--text-muted)">
                {heldTransactions.length} on hold
              </span>
              <button
                type="button"
                className="text-[0.75rem] font-bold px-2.5 py-1 rounded-(--radius) border border-[#dc2626] text-[#dc2626] bg-transparent cursor-pointer"
                style={{ minHeight: 28 }}
                onClick={onClearAll}
                data-testid="hold-clear-all-btn"
              >
                Clear All
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5 p-3 max-h-[480px] overflow-y-auto">
          {heldTransactions.length === 0 ? (
            <p
              className="text-[0.9375rem] text-(--text-muted) text-center py-8 m-0"
              data-testid="hold-lookup-empty"
            >
              No transactions on hold.
            </p>
          ) : (
            heldTransactions.map((held) => (
              <div
                key={held.id}
                className="flex items-center gap-0 w-full min-h-14 rounded-(--radius) border border-(--border-soft) overflow-hidden"
                style={{ background: 'var(--bg-surface-soft)' }}
                data-testid={`hold-row-${held.hold_number}`}
              >
                <button
                  type="button"
                  className="flex items-center gap-4 flex-1 min-h-14 px-4 bg-transparent border-0 cursor-pointer text-left"
                  onClick={() => onRecall(held)}
                >
                  <span className="text-[1.0625rem] font-black text-(--text-primary) min-w-[5rem]">
                    Hold #{held.hold_number}
                  </span>
                  <span className="text-[0.875rem] text-(--text-muted)">
                    {held.item_count} item{held.item_count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[0.875rem] font-bold text-(--text-primary) ml-auto">
                    ${held.total.toFixed(2)}
                  </span>
                  <span className="text-[0.8125rem] text-(--text-muted) min-w-[3.5rem] text-right">
                    {formatTime(held.held_at)}
                  </span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center w-10 min-h-14 bg-transparent border-0 border-l border-l-(--border-soft) cursor-pointer text-(--text-muted)"
                  style={{ flexShrink: 0 }}
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
