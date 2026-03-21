import type { ButtonHTMLAttributes } from 'react'
import { Button, type ButtonProps } from '@renderer/components/ui/button'

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
  return (
    <Button
      type={type}
      variant={variant as ButtonProps['variant']}
      size={size as ButtonProps['size']}
      className={className}
      {...props}
    />
  )
}
