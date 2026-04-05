import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function sanitizeNodeOptions(value) {
  if (!value) return undefined

  const sanitized = value
    .replace(
      /(^|\s)--localstorage-file(?:=(?:"[^"]*"|'[^']*'|\S+)|\s+(?:"[^"]*"|'[^']*'|\S+))?/g,
      ' '
    )
    .trim()

  return sanitized || undefined
}

const env = { ...process.env }
const sanitizedNodeOptions = sanitizeNodeOptions(env.NODE_OPTIONS)
env.NODE_NO_WARNINGS = '1'

if (sanitizedNodeOptions) {
  env.NODE_OPTIONS = sanitizedNodeOptions
} else {
  delete env.NODE_OPTIONS
}

const vitestPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))
const args = [vitestPath, ...process.argv.slice(2)]

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env
})

process.exit(result.status ?? 1)
