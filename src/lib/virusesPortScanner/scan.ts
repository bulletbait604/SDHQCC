import { createConnection } from 'node:net'
import os from 'node:os'
import { localIpv4Addresses } from './hostIps'
import { CLOUD_SCAN_USER_MESSAGE } from './localScan'
import { PORT_MAX, PORT_MIN, resolveScanHost, rowsFromListenMap } from './ports'
import { classifyConnectionDirection, collectSnapshotPids, readLocalPortSnapshot } from './listenTable'
import { readProcessMap } from './processInfo'
import type { ListenEntry } from './ports'
import type { PortScanResult, ProcessInfo } from './types'

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

async function tcpProbeAllLocalPorts(host: string): Promise<Map<number, ListenEntry>> {
  const listening = new Map<number, ListenEntry>()
  const ports: number[] = new Array(PORT_MAX)
  for (let port = PORT_MIN; port <= PORT_MAX; port += 1) {
    ports[port - 1] = port
  }
  await mapPool(ports, TCP_CONCURRENCY, async (port) => {
    const open = await probeTcpPort(host, port, TCP_TIMEOUT_MS)
    if (open) listening.set(port, { addresses: [host], pids: [] })
  })
  return listening
}

function assertNotCloudHost(): void {
  if (process.env.VERCEL) {
    throw new Error(CLOUD_SCAN_USER_MESSAGE)
  }
}

async function summarize(
  listeningTcp: Map<number, ListenEntry>,
  listeningUdp: Map<number, ListenEntry>,
  rawConnections: Parameters<typeof classifyConnectionDirection>[0][],
  method: PortScanResult['method'],
  startedAt: number,
  byPid: Map<number, ProcessInfo>
): Promise<PortScanResult> {
  const lanIps = localIpv4Addresses()
  const host = lanIps[0] || envScanHost()
  const tcpRows = rowsFromListenMap(listeningTcp, 'tcp', byPid)
  const udpRows = rowsFromListenMap(listeningUdp, 'udp', byPid)
  const ports = tcpRows.concat(udpRows)
  const connections = rawConnections.map((conn) =>
    classifyConnectionDirection(conn, listeningTcp, conn.pid == null ? null : byPid.get(conn.pid) || null)
  )
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
    publicIp: null,
    lanIps,
    hostedOnVercel: false,
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
  }
}

export async function scanAllLocalPorts(): Promise<PortScanResult> {
  assertNotCloudHost()
  const startedAt = Date.now()
  const probeHost = envScanHost()
  try {
    const snapshot = await readLocalPortSnapshot()
    const byPid = await readProcessMap(collectSnapshotPids(snapshot))
    return summarize(
      snapshot.listeningTcp,
      snapshot.listeningUdp,
      snapshot.connections,
      'os-listen-table',
      startedAt,
      byPid
    )
  } catch {
    const listening = await tcpProbeAllLocalPorts(probeHost)
    return summarize(listening, new Map(), [], 'tcp-connect', startedAt, new Map())
  }
}

/** @deprecated use scanAllLocalPorts */
export async function scanKnownPorts(): Promise<PortScanResult> {
  return scanAllLocalPorts()
}
