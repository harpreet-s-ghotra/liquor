import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
import { AppModalHeader } from './AppModalHeader'
import { ConfirmIcon } from './modal-icons'
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
        <DialogTitle className="dialog__sr-only">Prompt</DialogTitle>
        <AppModalHeader icon={<ConfirmIcon />} label="Prompt" title={title} onClose={onCancel} />

        <div className="confirm-dialog__body">
          <DialogDescription className="confirm-dialog__message">{message}</DialogDescription>
        </div>

        <div className="confirm-dialog__footer">
          <AppButton
            variant="neutral"
            size="md"
            onClick={onCancel}
            data-testid="confirm-dialog-cancel-btn"
          >
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={variant}
            size="md"
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm-btn"
          >
            {confirmLabel}
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
