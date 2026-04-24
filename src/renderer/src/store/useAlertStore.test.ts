import { act } from 'react-dom/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAlertStore } from './useAlertStore'

function flushTimers(): void {
  act(() => {
    vi.runAllTimers()
  })
}

describe('useAlertStore', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [] })
    vi.useFakeTimers()
  })

  it('shows and dismisses error alert', () => {
    useAlertStore.getState().showError('Error!')
    expect(useAlertStore.getState().alerts.length).toBe(1)
    expect(useAlertStore.getState().alerts[0].type).toBe('error')
    flushTimers()
    expect(useAlertStore.getState().alerts.length).toBe(0)
  })

  it('shows and dismisses success alert', () => {
    useAlertStore.getState().showSuccess('Success!')
    expect(useAlertStore.getState().alerts.length).toBe(1)
    expect(useAlertStore.getState().alerts[0].type).toBe('success')
    flushTimers()
    expect(useAlertStore.getState().alerts.length).toBe(0)
  })

  it('shows info and warning alerts', () => {
    useAlertStore.getState().showInfo('Info!')
    useAlertStore.getState().showWarning('Warn!')
    expect(useAlertStore.getState().alerts.length).toBe(2)
    expect(useAlertStore.getState().alerts[0].type).toBe('info')
    expect(useAlertStore.getState().alerts[1].type).toBe('warning')
    flushTimers()
    expect(useAlertStore.getState().alerts.length).toBe(0)
  })

  it('dismissAlert removes alert by id', () => {
    useAlertStore.getState().showError('Error!')
    const id = useAlertStore.getState().alerts[0].id
    useAlertStore.getState().dismissAlert(id)
    expect(useAlertStore.getState().alerts.length).toBe(0)
  })
})
