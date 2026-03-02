import type { ButtonHTMLAttributes } from 'react'
import './app-button.css'

type AppButtonVariant = 'default' | 'success' | 'danger' | 'warning' | 'neutral'
type AppButtonSize = 'sm' | 'md' | 'lg'

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant
  size?: AppButtonSize
}

export function AppButton({
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: AppButtonProps): React.JSX.Element {
  const classes = ['app-btn', `app-btn--${variant}`, `app-btn--${size}`, className]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} {...props} />
}
