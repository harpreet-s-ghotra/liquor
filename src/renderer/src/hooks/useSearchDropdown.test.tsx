import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchDropdown } from './useSearchDropdown'

describe('useSearchDropdown', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('moves highlight with arrow keys and wraps', () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    const results = ['a', 'b']
    const { result } = renderHook(() =>
      useSearchDropdown({
        results,
        isOpen: true,
        onSelect,
        onOpenChange
      })
    )

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(0)

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(1)

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(0)

    act(() => {
      result.current.handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(1)
  })

  it('supports home, end, enter, escape, and reset on results change', () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    const onEnterWithoutHighlight = vi.fn()
    const initialResults = ['a', 'b', 'c']
    const nextResults = ['x', 'y']
    const { result, rerender } = renderHook(
      ({ results, isOpen }) =>
        useSearchDropdown({
          results,
          isOpen,
          onSelect,
          onOpenChange,
          onEnterWithoutHighlight
        }),
      {
        initialProps: {
          results: initialResults,
          isOpen: true
        }
      }
    )

    act(() => {
      result.current.handleKeyDown({ key: 'End', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(2)

    act(() => {
      result.current.handleKeyDown({ key: 'Home', preventDefault: vi.fn() } as never)
    })
    expect(result.current.highlightIndex).toBe(0)

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as never)
    })
    expect(onSelect).toHaveBeenCalledWith('a')
    expect(onOpenChange).toHaveBeenCalledWith(false)

    rerender({ results: nextResults, isOpen: true })
    expect(result.current.highlightIndex).toBe(-1)

    act(() => {
      result.current.handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as never)
    })
    expect(onEnterWithoutHighlight).toHaveBeenCalled()

    act(() => {
      result.current.handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as never)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)

    rerender({ results: nextResults, isOpen: false })
    expect(result.current.highlightIndex).toBe(-1)
  })
})
