import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { PortConnection, PortProto, ProcessInfo } from './types'
import { PORT_MAX, PORT_MIN, type ListenEntry } from './ports'

const execFileAsync = promisify(execFile)

export type RawConnection = Omit<PortConnection, 'direction' | 'process'>

export type PortSnapshot = {
  listeningTcp: Map<number, ListenEntry>
  listeningUdp: Map<number, ListenEntry>
  connections: RawConnection[]
}

const TCP_TRAFFIC_STATES = [
  'ESTABLISHED',
  'SYN_SENT',
  'SYN_RECEIVED',
  'SYN_RECV',
  'FIN_WAIT_1',
  'FIN_WAIT_2',
  'CLOSE_WAIT',
  'CLOSING',
  'LAST_ACK',
]

export function isTcpTrafficState(state: string): boolean {
  const normalized = state.trim().toUpperCase().replace(/-/g, '_')
  return TCP_TRAFFIC_STATES.indexOf(normalized) !== -1
}

function addListen(map: Map<number, ListenEntry>, port: number, address: string, pid: number | null) {
  if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) return
  const bind = address.trim() || '*'
  const existing = map.get(port)
  if (!existing) {
    map.set(port, { addresses: [bind], pids: pid == null ? [] : [pid] })
    return
  }
  if (!existing.addresses.includes(bind)) existing.addresses.push(bind)
  if (pid != null && existing.pids.indexOf(pid) === -1) existing.pids.push(pid)
}

export function parseLocalAddress(local: string): { address: string; port: number } | null {
  const trimmed = local.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('[')) {
    const match = trimmed.match(/^\[([^\]]+)\]:(\d+)$/)
    if (!match) return null
    const port = Number.parseInt(match[2], 10)
    if (!Number.isInteger(port)) return null
    return { address: match[1], port }
  }

  const colon = trimmed.lastIndexOf(':')
  if (colon <= 0) return null
  const port = Number.parseInt(trimmed.slice(colon + 1), 10)
  if (!Number.isInteger(port)) return null
  return { address: trimmed.slice(0, colon), port }
}

function parsePid(raw: string | undefined): number | null {
  if (!raw) return null
  const pid = Number.parseInt(raw, 10)
  return Number.isInteger(pid) && pid >= 0 ? pid : null
}

function parseRemote(raw: string): { address: string; port: number | null } {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '*:*' || trimmed === '*.*' || trimmed === '0.0.0.0:0' || trimmed === '[::]:0') {
    return { address: '*', port: null }
  }
  const parsed = parseLocalAddress(trimmed)
  if (!parsed) return { address: trimmed, port: null }
  return { address: parsed.address, port: parsed.port === 0 ? null : parsed.port }
}

function addressesOnly(map: Map<number, ListenEntry>): Map<number, string[]> {
  const out = new Map<number, string[]>()
  map.forEach((entry, port) => {
    out.set(port, entry.addresses)
  })
  return out
}

/** Windows `netstat -ano` LISTENING TCP rows. */
export function parseWindowsNetstat(stdout: string): Map<number, string[]> {
  return addressesOnly(parseWindowsNetstatSnapshot(stdout).listeningTcp)
}

export function parseWindowsNetstatSnapshot(stdout: string): PortSnapshot {
  const listeningTcp = new Map<number, ListenEntry>()
  const listeningUdp = new Map<number, ListenEntry>()
  const connections: RawConnection[] = []

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    const cols = trimmed.split(/\s+/)
    if (cols.length < 3) continue
    const protoRaw = cols[0].toUpperCase()
    const proto: PortProto | null = protoRaw === 'TCP' ? 'tcp' : protoRaw === 'UDP' ? 'udp' : null
    if (!proto) continue
    const local = parseLocalAddress(cols[1])
    if (!local) continue

    if (proto === 'tcp') {
      const state = (cols[3] || '').toUpperCase()
      if (state === 'LISTENING') {
        addListen(listeningTcp, local.port, local.address, parsePid(cols[4]))
        continue
      }
      if (isTcpTrafficState(state)) {
        const remote = parseRemote(cols[2])
        connections.push({
          proto,
          localAddress: local.address,
          localPort: local.port,
          remoteAddress: remote.address,
          remotePort: remote.port,
          state,
          pid: parsePid(cols[4]),
        })
      }
      continue
    }

    addListen(listeningUdp, local.port, local.address, parsePid(cols[3]))
  }

  return { listeningTcp, listeningUdp, connections }
}

function ipv4FromLittleEndianHex(hex: string): string {
  const n = Number.parseInt(hex, 16)
  if (!Number.isFinite(n)) return hex
  return `${n & 255}.${(n >> 8) & 255}.${(n >> 16) & 255}.${(n >> 24) & 255}`
}

const PROC_TCP_ESTABLISHED = '01'
const PROC_TCP_SYN_SENT = '02'
const PROC_TCP_LISTEN = '0A'
const PROC_UDP_LISTEN = '07'

/** Linux `/proc/net/tcp` and `/proc/net/tcp6` — state 0A is LISTEN. */
export function parseProcNetTcp(content: string, family: 'ipv4' | 'ipv6'): Map<number, string[]> {
  return addressesOnly(parseProcNetSnapshot(content, family, 'tcp').listeningTcp)
}

export function parseProcNetSnapshot(
  content: string,
  family: 'ipv4' | 'ipv6',
  proto: PortProto
): PortSnapshot {
  const listeningTcp = new Map<number, ListenEntry>()
  const listeningUdp = new Map<number, ListenEntry>()
  const connections: RawConnection[] = []
  const listenMap = proto === 'tcp' ? listeningTcp : listeningUdp
  const lines = content.split(/\r?\n/).slice(1)

  for (const line of lines) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4) continue
    const state = cols[3]
    const [hexAddr, hexPort] = cols[1].split(':')
    if (!hexAddr || !hexPort) continue
    const port = Number.parseInt(hexPort, 16)
    if (!Number.isInteger(port)) continue
    const address = family === 'ipv4' ? ipv4FromLittleEndianHex(hexAddr) : hexAddr.toLowerCase()

    if (proto === 'tcp' && state === PROC_TCP_LISTEN) {
      addListen(listenMap, port, address, null)
      continue
    }
    if (proto === 'udp' && (state === PROC_UDP_LISTEN || state === '00')) {
      addListen(listenMap, port, address, null)
      continue
    }
    if (proto === 'tcp' && (state === PROC_TCP_ESTABLISHED || state === PROC_TCP_SYN_SENT)) {
      const rem = cols[2].split(':')
      const remotePort = rem[1] ? Number.parseInt(rem[1], 16) : NaN
      const remoteAddress = rem[0]
        ? family === 'ipv4'
          ? ipv4FromLittleEndianHex(rem[0])
          : rem[0].toLowerCase()
        : '*'
      connections.push({
        proto,
        localAddress: address,
        localPort: port,
        remoteAddress,
        remotePort: Number.isInteger(remotePort) && remotePort > 0 ? remotePort : null,
        state: state === PROC_TCP_SYN_SENT ? 'SYN_SENT' : 'ESTABLISHED',
        pid: null,
      })
    }
  }

  return { listeningTcp, listeningUdp, connections }
}

function mergeListenMaps(into: Map<number, ListenEntry>, from: Map<number, ListenEntry>) {
  from.forEach((entry, port) => {
    for (let i = 0; i < entry.addresses.length; i += 1) {
      addListen(into, port, entry.addresses[i], null)
    }
    for (let j = 0; j < entry.pids.length; j += 1) {
      addListen(into, port, entry.addresses[0] || '*', entry.pids[j])
    }
  })
}

function mergeSnapshots(into: PortSnapshot, from: PortSnapshot) {
  mergeListenMaps(into.listeningTcp, from.listeningTcp)
  mergeListenMaps(into.listeningUdp, from.listeningUdp)
  for (let i = 0; i < from.connections.length; i += 1) {
    into.connections.push(from.connections[i])
  }
}

async function snapshotWindows(): Promise<PortSnapshot> {
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseWindowsNetstatSnapshot(stdout)
}

async function snapshotLinuxProc(): Promise<PortSnapshot> {
  const snapshot: PortSnapshot = {
    listeningTcp: new Map(),
    listeningUdp: new Map(),
    connections: [],
  }
  mergeSnapshots(snapshot, parseProcNetSnapshot(await readFile('/proc/net/tcp', 'utf8'), 'ipv4', 'tcp'))
  try {
    mergeSnapshots(snapshot, parseProcNetSnapshot(await readFile('/proc/net/tcp6', 'utf8'), 'ipv6', 'tcp'))
  } catch {
    /* tcp6 is optional */
  }
  try {
    mergeSnapshots(snapshot, parseProcNetSnapshot(await readFile('/proc/net/udp', 'utf8'), 'ipv4', 'udp'))
  } catch {
    /* udp is optional */
  }
  try {
    mergeSnapshots(snapshot, parseProcNetSnapshot(await readFile('/proc/net/udp6', 'utf8'), 'ipv6', 'udp'))
  } catch {
    /* udp6 is optional */
  }
  return snapshot
}

/** Generic `netstat -lnt` / `netstat -an` LISTEN rows (Linux/macOS). */
export function parseUnixNetstat(stdout: string): Map<number, string[]> {
  return addressesOnly(parseUnixNetstatSnapshot(stdout).listeningTcp)
}

export function parseUnixNetstatSnapshot(stdout: string): PortSnapshot {
  const listeningTcp = new Map<number, ListenEntry>()
  const listeningUdp = new Map<number, ListenEntry>()
  const connections: RawConnection[] = []

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!/^(tcp|udp)/i.test(trimmed)) continue
    const cols = trimmed.split(/\s+/)
    const proto: PortProto = /^udp/i.test(cols[0]) ? 'udp' : 'tcp'
    const localRaw = cols.find((col) => col.includes('.') || col.includes(':') || col.includes('*'))
    if (!localRaw) continue
    const normalized =
      localRaw.includes('.') && localRaw.lastIndexOf('.') > localRaw.lastIndexOf(':')
        ? localRaw.replace(/\.(\d+)$/, ':$1')
        : localRaw
    const local = parseLocalAddress(normalized.replace(/^\*:/, '0.0.0.0:'))
    if (!local) continue
    const state = (cols[cols.length - 1] || '').toUpperCase()
    if (proto === 'udp' || /\bLISTEN/i.test(trimmed)) {
      addListen(
        proto === 'tcp' ? listeningTcp : listeningUdp,
        local.port,
        local.address === '*' ? '0.0.0.0' : local.address,
        null
      )
      continue
    }
    if (proto === 'tcp' && isTcpTrafficState(state)) {
      const remRaw = cols.filter((col) => col.includes('.') || col.includes(':'))[1]
      const remote = parseRemote(remRaw || '*:*')
      connections.push({
        proto,
        localAddress: local.address,
        localPort: local.port,
        remoteAddress: remote.address,
        remotePort: remote.port,
        state,
        pid: null,
      })
    }
  }

  return { listeningTcp, listeningUdp, connections }
}

async function snapshotUnixNetstat(): Promise<PortSnapshot> {
  const { stdout } = await execFileAsync('netstat', ['-an'], {
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseUnixNetstatSnapshot(stdout)
}

export function collectSnapshotPids(snapshot: PortSnapshot): number[] {
  const pids: number[] = []
  const take = (pid: number | null | undefined) => {
    if (pid == null || pids.indexOf(pid) !== -1) return
    pids.push(pid)
  }
  snapshot.listeningTcp.forEach((entry) => {
    for (let i = 0; i < entry.pids.length; i += 1) take(entry.pids[i])
  })
  snapshot.listeningUdp.forEach((entry) => {
    for (let i = 0; i < entry.pids.length; i += 1) take(entry.pids[i])
  })
  for (let i = 0; i < snapshot.connections.length; i += 1) take(snapshot.connections[i].pid)
  return pids
}

export function classifyConnectionDirection(
  conn: RawConnection,
  listeningTcp: Map<number, ListenEntry>,
  process: ProcessInfo | null = null
): PortConnection {
  const direction = conn.proto === 'tcp' && listeningTcp.has(conn.localPort) ? 'inbound' : 'outbound'
  return {
    proto: conn.proto,
    localAddress: conn.localAddress,
    localPort: conn.localPort,
    remoteAddress: conn.remoteAddress,
    remotePort: conn.remotePort,
    state: conn.state,
    direction: conn.proto === 'udp' ? 'inbound' : direction,
    pid: conn.pid,
    process: process || null,
  }
}

export async function readLocalPortSnapshot(): Promise<PortSnapshot> {
  if (process.platform === 'win32') {
    return snapshotWindows()
  }
  if (process.platform === 'linux') {
    try {
      return await snapshotLinuxProc()
    } catch {
      return snapshotUnixNetstat()
    }
  }
  return snapshotUnixNetstat()
}

export async function readListeningTcpPorts(): Promise<Map<number, string[]>> {
  const snapshot = await readLocalPortSnapshot()
  return addressesOnly(snapshot.listeningTcp)
}
