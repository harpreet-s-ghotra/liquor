import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
import { AppModalHeader } from './AppModalHeader'
import { SuccessIcon } from './modal-icons'
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
        <DialogTitle className="dialog__sr-only">Success dialog</DialogTitle>
        <AppModalHeader icon={<SuccessIcon />} label="Notice" title={title} onClose={onDismiss} />

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
