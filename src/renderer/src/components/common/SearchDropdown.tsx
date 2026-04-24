import type { ReactNode, RefObject } from 'react'
import { InventoryInput } from '@renderer/components/common/InventoryInput'
import { useSearchDropdown } from '@renderer/hooks/useSearchDropdown'
import { cn } from '@renderer/lib/utils'
import './search-dropdown.css'

type SearchDropdownProps<TItem> = {
  value: string
  onValueChange: (value: string) => void
  results: TItem[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (item: TItem) => void
  onSubmit?: () => void
  renderOption: (item: TItem, isHighlighted: boolean) => ReactNode
  getOptionKey: (item: TItem) => string | number
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  className?: string
  inputClassName?: string
  listboxClassName?: string
  optionClassName?: string
  disabled?: boolean
  ariaLabel: string
  listboxLabel?: string
  inputVariant?: 'plain' | 'inventory'
  listboxPlacement?: 'bottom' | 'top'
}

export function SearchDropdown<TItem>({
  value,
  onValueChange,
  results,
  isOpen,
  onOpenChange,
  onSelect,
  onSubmit,
  renderOption,
  getOptionKey,
  placeholder,
  inputRef,
  className,
  inputClassName,
  listboxClassName,
  optionClassName,
  disabled = false,
  ariaLabel,
  listboxLabel,
  inputVariant = 'plain',
  listboxPlacement = 'bottom'
}: SearchDropdownProps<TItem>): React.JSX.Element {
  const { highlightIndex, handleKeyDown, getInputProps, getOptionProps, listboxId } =
    useSearchDropdown({
      results,
      isOpen,
      onSelect,
      onOpenChange,
      onEnterWithoutHighlight: onSubmit
    })

  const inputProps = getInputProps()

  return (
    <div className={cn('search-dropdown', className)}>
      {inputVariant === 'inventory' ? (
        <InventoryInput
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) onOpenChange(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
          disabled={disabled}
          aria-label={ariaLabel}
          {...inputProps}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) onOpenChange(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
          disabled={disabled}
          aria-label={ariaLabel}
          {...inputProps}
        />
      )}

      {isOpen && results.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={listboxLabel}
          className={cn(
            'search-dropdown__listbox',
            listboxPlacement === 'top'
              ? 'search-dropdown__listbox--top'
              : 'search-dropdown__listbox--bottom',
            listboxClassName
          )}
        >
          {results.map((item, index) => {
            const optionProps = getOptionProps(index)
            return (
              <li
                key={getOptionKey(item)}
                {...optionProps}
                className={cn(
                  'search-dropdown__option',
                  index === highlightIndex && 'search-dropdown__option--highlighted',
                  optionClassName
                )}
              >
                {renderOption(item, index === highlightIndex)}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
