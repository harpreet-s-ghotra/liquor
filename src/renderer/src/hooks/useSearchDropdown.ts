import { useEffect, useId, useReducer } from 'react'

type UseSearchDropdownOptions<TItem> = {
  results: TItem[]
  isOpen: boolean
  onSelect: (item: TItem) => void
  onOpenChange: (open: boolean) => void
  onEnterWithoutHighlight?: () => void
}

type InputAriaProps = {
  role: 'combobox'
  'aria-expanded': boolean
  'aria-controls': string
  'aria-autocomplete': 'list'
  'aria-activedescendant': string | undefined
}

type OptionProps = {
  id: string
  role: 'option'
  'aria-selected': boolean
  onMouseEnter: () => void
  onMouseDown: (event: React.MouseEvent) => void
}

type HighlightAction = { type: 'set'; index: number } | { type: 'reset' }

function highlightReducer(_state: number, action: HighlightAction): number {
  if (action.type === 'reset') return -1
  return action.index
}

export function useSearchDropdown<TItem>({
  results,
  isOpen,
  onSelect,
  onOpenChange,
  onEnterWithoutHighlight
}: UseSearchDropdownOptions<TItem>): {
  highlightIndex: number
  setHighlightIndex: (index: number) => void
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  getOptionProps: (index: number) => OptionProps
  getInputProps: () => InputAriaProps
  listboxId: string
} {
  const [highlightIndex, dispatchHighlight] = useReducer(highlightReducer, -1)
  const listboxId = useId()
  const resultsLength = results.length

  // Reset on open/close or when the list size changes. A debounced refetch
  // that returns the same-size list must NOT drop the user's highlight.
  useEffect(() => {
    dispatchHighlight({ type: 'reset' })
  }, [isOpen, resultsLength])

  useEffect(() => {
    if (highlightIndex < 0) return
    const option = document.getElementById(`${listboxId}-option-${highlightIndex}`)
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, listboxId])

  const selectAtIndex = (index: number): void => {
    const item = results[index]
    if (item == null) return
    onSelect(item)
    onOpenChange(false)
    dispatchHighlight({ type: 'reset' })
  }

  const moveHighlight = (direction: 1 | -1): void => {
    if (results.length === 0) return
    if (!isOpen) onOpenChange(true)

    dispatchHighlight({
      type: 'set',
      index:
        highlightIndex === -1
          ? direction === 1
            ? 0
            : results.length - 1
          : (highlightIndex + direction + results.length) % results.length
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveHighlight(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        moveHighlight(-1)
        return
      case 'Home':
        if (results.length === 0) return
        event.preventDefault()
        if (!isOpen) onOpenChange(true)
        dispatchHighlight({ type: 'set', index: 0 })
        return
      case 'End':
        if (results.length === 0) return
        event.preventDefault()
        if (!isOpen) onOpenChange(true)
        dispatchHighlight({ type: 'set', index: results.length - 1 })
        return
      case 'Enter':
        if (highlightIndex >= 0) {
          event.preventDefault()
          selectAtIndex(highlightIndex)
          return
        }
        onEnterWithoutHighlight?.()
        return
      case 'Escape':
        event.preventDefault()
        onOpenChange(false)
        dispatchHighlight({ type: 'reset' })
        return
      case 'Tab':
        onOpenChange(false)
        dispatchHighlight({ type: 'reset' })
        return
      default:
        return
    }
  }

  const getOptionProps = (index: number): OptionProps => ({
    id: `${listboxId}-option-${index}`,
    role: 'option',
    'aria-selected': index === highlightIndex,
    onMouseEnter: () => dispatchHighlight({ type: 'set', index }),
    onMouseDown: (event) => {
      event.preventDefault()
      selectAtIndex(index)
    }
  })

  const getInputProps = (): InputAriaProps => ({
    role: 'combobox',
    'aria-expanded': isOpen,
    'aria-controls': listboxId,
    'aria-autocomplete': 'list',
    'aria-activedescendant':
      highlightIndex >= 0 ? `${listboxId}-option-${highlightIndex}` : undefined
  })

  return {
    highlightIndex,
    setHighlightIndex: (index: number) => dispatchHighlight({ type: 'set', index }),
    handleKeyDown,
    getOptionProps,
    getInputProps,
    listboxId
  }
}
