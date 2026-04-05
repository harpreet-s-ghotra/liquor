import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
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
        <DialogHeader className="error-modal__header">
          <div className="error-modal__icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <DialogTitle className="error-modal__title">{title}</DialogTitle>
        </DialogHeader>

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
