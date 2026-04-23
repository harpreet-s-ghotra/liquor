import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  flushTelemetry,
  initializeTelemetry,
  shutdownTelemetry,
  trackTelemetryEvent
} from './telemetry'

let tempPath: string | null = null

afterEach(async () => {
  await shutdownTelemetry()
  if (tempPath) {
    await rm(tempPath, { recursive: true, force: true })
    tempPath = null
  }
})

describe('telemetry service', () => {
  it('writes telemetry records to local jsonl file', async () => {
    tempPath = await mkdtemp(join(tmpdir(), 'telemetry-test-'))
    await initializeTelemetry(tempPath)

    trackTelemetryEvent({
      type: 'behavior',
      name: 'test_event',
      payload: { step: 'started' },
      sampleRate: 1
    })

    // wait a bit for any automatic flush to finish
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushTelemetry()
    
    const file = join(tempPath, 'telemetry', 'events.jsonl')
    const content = await readFile(file, 'utf8')
    expect(content).toContain('"name":"test_event"')
    expect(content).toContain('"step":"started"')
  })

  it('redacts sensitive payload fields', async () => {
    tempPath = await mkdtemp(join(tmpdir(), 'telemetry-test-'))
    await initializeTelemetry(tempPath)

    trackTelemetryEvent({
      type: 'error',
      name: 'payment_error',
      payload: {
        card_number: '4111111111111111',
        password: 'secret',
        message: 'failed'
      },
      sampleRate: 1
    })

    // wait a bit for any automatic flush to finish
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushTelemetry()

    const file = join(tempPath, 'telemetry', 'events.jsonl')
    const content = await readFile(file, 'utf8')
    expect(content).toContain('"card_number":"[redacted]"')
    expect(content).toContain('"password":"[redacted]"')
    expect(content).toContain('"message":"failed"')
  })
})
