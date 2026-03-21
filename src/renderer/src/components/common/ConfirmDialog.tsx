import { Dialog, DialogContent } from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'

type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="w-[420px] flex flex-col p-0 overflow-hidden rounded-2xl bg-(--bg-panel) border border-(--border-default) shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.4)]"
        aria-label={title}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--border-default) bg-[#2d3133]">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${variant === 'danger' ? 'bg-[rgba(127,29,29,0.4)]' : 'bg-[rgba(194,65,12,0.4)]'}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={variant === 'danger' ? '#ef4444' : '#fb923c'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="text-[15px] font-black text-[#e8ecf0] m-0">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-[14px] text-(--text-primary) m-0 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <AppButton variant="neutral" size="md" onClick={onCancel}>
            {cancelLabel}
          </AppButton>
          <AppButton variant={variant} size="md" onClick={onConfirm}>
            {confirmLabel}
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
