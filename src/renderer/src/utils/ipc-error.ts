/**
 * Strip the Electron IPC error prefix from error messages before displaying to users.
 *
 * Electron wraps IPC handler errors with:
 *   "Error invoking remote method '<channel>': Error: <actual message>"
 *
 * This extracts just the actual message.
 */
export function stripIpcPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}
