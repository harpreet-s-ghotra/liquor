import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AppButton } from './AppButton'
import { AppModalHeader } from './AppModalHeader'
import { Input } from '@renderer/components/ui/input'
import { ConfirmIcon } from './modal-icons'
import './confirm-dialog.css'

type PromptDialogProps = {
  isOpen: boolean
  title: string
  message: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  initialValue?: string
  /** Cap on the typed value. Defaults to 200 chars. */
  maxLength?: number
  onConfirm: (value: string) => void
  onCancel: () => void
}

const DEFAULT_MAX_LENGTH = 200

/**
 * Single-line text prompt — used for low-friction inputs like a hold note.
 * Confirm always fires (blank value allowed); the caller decides what to do
 * with an empty string.
 *
 * Internally the inner controller is keyed on `isOpen` so each open is a fresh
 * mount with `initialValue` already in place — avoids the "value briefly shows
 * the previous run" flash and the setState-in-effect lint warning.
 */
export function PromptDialog(props: PromptDialogProps): React.JSX.Element {
  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent
        className="confirm-dialog"
        aria-label={props.title}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="dialog__sr-only">Prompt</DialogTitle>
        <AppModalHeader
          icon={<ConfirmIcon />}
          label="Prompt"
          title={props.title}
          onClose={props.onCancel}
        />
        {props.isOpen ? <PromptDialogBody key="open" {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function PromptDialogBody({
  message,
  placeholder,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  initialValue = '',
  maxLength = DEFAULT_MAX_LENGTH,
  onConfirm,
  onCancel
}: PromptDialogProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Body is keyed on the dialog being open, so this fires exactly once per open.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleSubmit = (): void => {
    onConfirm(value)
  }

  return (
    <>
      <div className="confirm-dialog__body">
        <DialogDescription className="confirm-dialog__message">{message}</DialogDescription>
        <Input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          data-testid="prompt-dialog-input"
        />
      </div>

      <div className="confirm-dialog__footer">
        <AppButton variant="neutral" size="md" onClick={onCancel}>
          {cancelLabel}
        </AppButton>
        <AppButton
          variant="default"
          size="md"
          onClick={handleSubmit}
          data-testid="prompt-dialog-confirm-btn"
        >
          {confirmLabel}
        </AppButton>
      </div>
    </>
  )
}
