import { createConnection } from 'node:net'
import os from 'node:os'
import { PORT_MAX, PORT_MIN, resolveScanHost, rowsFromListenMap, vercelScanNote } from './ports'
import { classifyConnectionDirection, readLocalPortSnapshot } from './listenTable'
import type { PortScanResult } from './types'

const TCP_TIMEOUT_MS = 120
const TCP_CONCURRENCY = 256

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

async function tcpProbeAllLocalPorts(host: string): Promise<Map<number, string[]>> {
  const listening = new Map<number, string[]>()
  const ports: number[] = new Array(PORT_MAX)
  for (let port = PORT_MIN; port <= PORT_MAX; port += 1) {
    ports[port - 1] = port
  }
  await mapPool(ports, TCP_CONCURRENCY, async (port) => {
    const open = await probeTcpPort(host, port, TCP_TIMEOUT_MS)
    if (open) listening.set(port, [host])
  })
  return listening
}

function summarize(
  listeningTcp: Map<number, string[]>,
  listeningUdp: Map<number, string[]>,
  rawConnections: Parameters<typeof classifyConnectionDirection>[0][],
  method: PortScanResult['method'],
  startedAt: number,
  host: string
): PortScanResult {
  const hostedOnVercel = Boolean(process.env.VERCEL)
  const tcpRows = rowsFromListenMap(listeningTcp, 'tcp')
  const udpRows = rowsFromListenMap(listeningUdp, 'udp')
  const ports = tcpRows.concat(udpRows)
  const connections = rawConnections.map((conn) => classifyConnectionDirection(conn, listeningTcp))
  let outboundCount = 0
  let inboundSessionCount = 0
  for (let i = 0; i < connections.length; i += 1) {
    if (connections[i].direction === 'outbound') outboundCount += 1
    else inboundSessionCount += 1
  }
  const total = PORT_MAX
  const tcpOpenCount = tcpRows.length
  return {
    host,
    hostname: os.hostname(),
    platform: os.platform(),
    hostedOnVercel,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    method,
    portMin: PORT_MIN,
    portMax: PORT_MAX,
    total,
    openCount: tcpOpenCount,
    closedCount: total - tcpOpenCount,
    tcpOpenCount,
    udpOpenCount: udpRows.length,
    outboundCount,
    inboundSessionCount,
    ports,
    connections,
    note: vercelScanNote(hostedOnVercel),
  }
}

export async function scanAllLocalPorts(): Promise<PortScanResult> {
  const startedAt = Date.now()
  const host = envScanHost()
  try {
    const snapshot = await readLocalPortSnapshot()
    return summarize(
      snapshot.listeningTcp,
      snapshot.listeningUdp,
      snapshot.connections,
      'os-listen-table',
      startedAt,
      host
    )
  } catch {
    if (process.env.VERCEL) {
      return summarize(new Map(), new Map(), [], 'os-listen-table', startedAt, host)
    }
    const listening = await tcpProbeAllLocalPorts(host)
    return summarize(listening, new Map(), [], 'tcp-connect', startedAt, host)
  }
}

/** @deprecated use scanAllLocalPorts */
export async function scanKnownPorts(): Promise<PortScanResult> {
  return scanAllLocalPorts()
}
