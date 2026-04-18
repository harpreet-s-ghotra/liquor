import { useState } from 'react'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClassName?: string
}

export function PasswordInput({
  className,
  inputClassName,
  ...inputProps
}: PasswordInputProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`auth-input-wrapper ${className ?? ''}`}>
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        className={`auth-input ${inputClassName ?? ''}`}
      />
      <button
        type="button"
        className="auth-toggle-btn"
        aria-label={visible ? 'Hide' : 'Show'}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
