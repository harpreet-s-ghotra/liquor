import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { cn } from '@renderer/lib/utils'
import { AppButton } from './AppButton'
import './confirm-dialog.css'

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
        className="confirm-dialog"
        aria-label={title}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="confirm-dialog__header">
          <div
            className={cn(
              'confirm-dialog__icon',
              variant === 'danger'
                ? 'confirm-dialog__icon--danger'
                : 'confirm-dialog__icon--warning'
            )}
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
          <DialogTitle className="confirm-dialog__title">{title}</DialogTitle>
        </DialogHeader>

        <div className="confirm-dialog__body">
          <DialogDescription className="confirm-dialog__message">{message}</DialogDescription>
        </div>

        <div className="confirm-dialog__footer">
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
