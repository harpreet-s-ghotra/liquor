import type { InputHTMLAttributes } from 'react'
import { Input } from '@renderer/components/ui/input'
import { fieldConfigs, type FieldType } from './validation'

export type { FieldType } from './validation'

/* ─── Component props ─── */
type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

export type ValidatedInputProps = NativeInputProps & {
  /** Determines sanitization rules & default attributes */
  fieldType: FieldType
  /** Controlled value */
  value: string
  /** Fired with the (optionally sanitized) string */
  onChange: (value: string) => void
}

/* ─── Component ─── */
export function ValidatedInput({
  fieldType,
  value,
  onChange,
  className,
  inputMode,
  maxLength,
  ...rest
}: ValidatedInputProps): React.JSX.Element {
  const config = fieldConfigs[fieldType]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let next = e.target.value
    if (config.sanitize) {
      next = config.sanitize(next)
    }
    onChange(next)
  }

  return (
    <Input
      className={className}
      value={value}
      onChange={handleChange}
      inputMode={inputMode ?? config.inputMode}
      maxLength={maxLength ?? config.maxLength}
      {...rest}
    />
  )
}
