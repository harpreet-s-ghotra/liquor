import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
import { AppModalHeader } from './AppModalHeader'
import { ErrorIcon } from './modal-icons'
import './error-modal.css'

type ErrorModalProps = {
  isOpen: boolean
  title?: string
  message: string
  onDismiss: () => void
}

export function ErrorModal({
  isOpen,
  title = 'Error',
  message,
  onDismiss
}: ErrorModalProps): React.JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent
        className="error-modal"
        aria-label={title}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Error dialog</DialogTitle>
        <AppModalHeader icon={<ErrorIcon />} label="Alert" title={title} onClose={onDismiss} />

        <div className="error-modal__body">
          <DialogDescription className="error-modal__message">{message}</DialogDescription>
        </div>

        <div className="error-modal__footer">
          <AppButton variant="danger" size="lg" onClick={onDismiss} data-testid="error-modal-ok">
            OK
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
