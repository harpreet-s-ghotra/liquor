import { appendFile, mkdir, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import type { TelemetryEventInput, TelemetryEventType } from '../../shared/types'
import { isSensitiveKey } from '../../shared/redact'

type TelemetryRecord = {
  ts: string
  app_version: string
  platform: NodeJS.Platform
  type: TelemetryEventType
  name: string
  payload: Record<string, unknown>
}

const PERF_DEFAULT_SAMPLE_RATE = 0.1
const MAX_QUEUE_SIZE = 2000
const MAX_PAYLOAD_KEYS = 25
const MAX_LOG_BYTES = 10 * 1024 * 1024

let telemetryPath: string | null = null
let queue: TelemetryRecord[] = []
let flushInterval: NodeJS.Timeout | null = null
let activeFlush: Promise<void> | null = null

function shouldSample(event: TelemetryEventInput): boolean {
  const rate = event.sampleRate ?? (event.type === 'performance' ? PERF_DEFAULT_SAMPLE_RATE : 1)
  if (event.type === 'error') return true
  return Math.random() < Math.min(1, Math.max(0, rate))
}

function normalizeValue(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') return value.slice(0, 300)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(normalizeValue)
  return String(value).slice(0, 300)
}

function sanitizePayload(payload?: Record<string, unknown>): Record<string, unknown> {
  if (!payload) return {}

  const out: Record<string, unknown> = {}
  const entries = Object.entries(payload).slice(0, MAX_PAYLOAD_KEYS)

  for (const [key, value] of entries) {
    if (isSensitiveKey(key)) {
      out[key] = '[redacted]'
    } else {
      out[key] = normalizeValue(value)
    }
  }

  return out
}

function ensureQueueLimit(): void {
  if (queue.length <= MAX_QUEUE_SIZE) return
  queue = queue.slice(queue.length - MAX_QUEUE_SIZE)
}

export async function initializeTelemetry(userDataPath: string): Promise<void> {
  const telemetryDir = join(userDataPath, 'telemetry')
  await mkdir(telemetryDir, { recursive: true })
  telemetryPath = join(telemetryDir, 'events.jsonl')

  if (flushInterval) clearInterval(flushInterval)
  flushInterval = setInterval(() => {
    void flushTelemetry()
  }, 30_000)
}

export function trackTelemetryEvent(event: TelemetryEventInput): void {
  if (!telemetryPath) return
  if (!event.name || !event.type) return
  if (!shouldSample(event)) return

  queue.push({
    ts: new Date().toISOString(),
    app_version: process.env.npm_package_version ?? 'unknown',
    platform: process.platform,
    type: event.type,
    name: event.name,
    payload: sanitizePayload(event.payload)
  })

  ensureQueueLimit()

  if (event.type === 'error' || queue.length >= 50) {
    void flushTelemetry()
  }
}

async function enforceFileSizeLimit(path: string): Promise<void> {
  try {
    const fileStat = await stat(path)
    if (fileStat.size <= MAX_LOG_BYTES) return
    await writeFile(path, '', 'utf8')
  } catch {
    // File may not exist yet; ignore
  }
}

export async function flushTelemetry(): Promise<void> {
  if (!telemetryPath || queue.length === 0) return
  if (activeFlush) {
    await activeFlush
    return
  }

  const path = telemetryPath
  activeFlush = (async () => {
    const batch = queue.splice(0, 200)
    try {
      await enforceFileSizeLimit(path)
      const lines = batch.map((event) => JSON.stringify(event)).join('\n') + '\n'
      await appendFile(path, lines, 'utf8')
    } catch {
      // If write fails, keep app flow unaffected; drop this batch to avoid memory growth.
    }
  })().finally(() => {
    activeFlush = null
  })

  await activeFlush
}

export async function shutdownTelemetry(): Promise<void> {
  if (flushInterval) {
    clearInterval(flushInterval)
    flushInterval = null
  }
  await flushTelemetry()
}
