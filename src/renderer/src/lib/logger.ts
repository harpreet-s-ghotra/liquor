import log from 'electron-log/renderer'

export type ScopedLogger = {
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

function call(level: 'error' | 'warn' | 'info' | 'debug', scope: string, args: unknown[]): void {
  const fn = (log as unknown as Record<string, unknown>)[level]
  const tag = `[${scope}]`
  if (typeof fn === 'function') {
    ;(fn as (...a: unknown[]) => void).call(log, tag, ...args)
    return
  }
  // Fallback — some electron-log/renderer versions expose only `log()`.
  const generic = (log as unknown as { log?: (...a: unknown[]) => void }).log
  if (typeof generic === 'function') {
    generic.call(log, tag, ...args)
    return
  }
  // Last-resort console fallback so we never throw from the logger itself.
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'debug' : level](tag, ...args)
}

export function scoped(name: string): ScopedLogger {
  return {
    error: (...args) => call('error', name, args),
    warn: (...args) => call('warn', name, args),
    info: (...args) => call('info', name, args),
    debug: (...args) => call('debug', name, args)
  }
}

export default log
