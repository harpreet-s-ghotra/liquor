import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
import './success-modal.css'

const AUTO_CLOSE_MS = 5000

type SuccessModalProps = {
  isOpen: boolean
  title?: string
  message: string
  onDismiss: () => void
}

export function SuccessModal({
  isOpen,
  title = 'Success',
  message,
  onDismiss
}: SuccessModalProps): React.JSX.Element {
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(onDismiss, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [isOpen, onDismiss])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent
        className="success-modal"
        aria-label={title}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="success-modal__header">
          <div className="success-modal__icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34d399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <DialogTitle className="success-modal__title">{title}</DialogTitle>
        </DialogHeader>

        <div className="success-modal__body">
          <DialogDescription className="success-modal__message">{message}</DialogDescription>
        </div>

        <div className="success-modal__footer">
          <AppButton variant="success" size="lg" onClick={onDismiss} data-testid="success-modal-ok">
            OK
          </AppButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
