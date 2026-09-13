import { createConnection } from 'node:net'
import os from 'node:os'
import {
  classifyKnownPorts,
  listKnownPorts,
  resolveScanHost,
  vercelScanNote,
} from './ports'
import { readListeningTcpPorts } from './listenTable'
import type { PortScanResult } from './types'

const TCP_TIMEOUT_MS = 250
const TCP_CONCURRENCY = 64

function envScanHost(): string {
  return resolveScanHost(process.env.VIRUSES_PORT_SCAN_HOST)
}

function probeTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port })
    let settled = false
    const finish = (open: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  }
  const size = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: size }, () => worker()))
  return results
}

export async function tcpProbeListeningPorts(
  host: string,
  ports: readonly number[]
): Promise<Map<number, string[]>> {
  const listening = new Map<number, string[]>()
  await mapPool(ports, TCP_CONCURRENCY, async (port) => {
    const open = await probeTcpPort(host, port, TCP_TIMEOUT_MS)
    if (open) listening.set(port, [host])
  })
  return listening
}

function summarize(
  listening: Map<number, string[]>,
  method: PortScanResult['method'],
  startedAt: number,
  host: string
): PortScanResult {
  const hostedOnVercel = Boolean(process.env.VERCEL)
  const ports = classifyKnownPorts(listKnownPorts(), listening)
  const openCount = ports.filter((row) => row.status === 'Open').length
  return {
    host,
    hostname: os.hostname(),
    platform: os.platform(),
    hostedOnVercel,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    method,
    total: ports.length,
    openCount,
    closedCount: ports.length - openCount,
    ports,
    note: vercelScanNote(hostedOnVercel),
  }
}

export async function scanKnownPorts(): Promise<PortScanResult> {
  const startedAt = Date.now()
  const host = envScanHost()
  try {
    const listening = await readListeningTcpPorts()
    return summarize(listening, 'os-listen-table', startedAt, host)
  } catch {
    const listening = await tcpProbeListeningPorts(host, listKnownPorts())
    return summarize(listening, 'tcp-connect', startedAt, host)
  }
}
