import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function addBind(map: Map<number, string[]>, port: number, address: string) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return
  const bind = address.trim() || '*'
  const existing = map.get(port)
  if (existing) {
    if (!existing.includes(bind)) existing.push(bind)
    return
  }
  map.set(port, [bind])
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

/** Windows `netstat -ano` LISTENING TCP rows. */
export function parseWindowsNetstat(stdout: string): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!/^TCP\b/i.test(trimmed) || !/\bLISTENING\b/i.test(trimmed)) continue
    const cols = trimmed.split(/\s+/)
    if (cols.length < 4) continue
    const parsed = parseLocalAddress(cols[1])
    if (parsed) addBind(map, parsed.port, parsed.address)
  }
  return map
}

function ipv4FromLittleEndianHex(hex: string): string {
  const n = Number.parseInt(hex, 16)
  if (!Number.isFinite(n)) return hex
  return `${n & 255}.${(n >> 8) & 255}.${(n >> 16) & 255}.${(n >> 24) & 255}`
}

/** Linux `/proc/net/tcp` and `/proc/net/tcp6` — state 0A is LISTEN. */
export function parseProcNetTcp(content: string, family: 'ipv4' | 'ipv6'): Map<number, string[]> {
  const map = new Map<number, string[]>()
  const lines = content.split(/\r?\n/).slice(1)
  for (const line of lines) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4) continue
    if (cols[3] !== '0A') continue
    const [hexAddr, hexPort] = cols[1].split(':')
    if (!hexAddr || !hexPort) continue
    const port = Number.parseInt(hexPort, 16)
    if (!Number.isInteger(port)) continue
    const address = family === 'ipv4' ? ipv4FromLittleEndianHex(hexAddr) : hexAddr.toLowerCase()
    addBind(map, port, address)
  }
  return map
}

function mergeListenMaps(into: Map<number, string[]>, from: Map<number, string[]>) {
  from.forEach((binds, port) => {
    for (let i = 0; i < binds.length; i += 1) {
      addBind(into, port, binds[i])
    }
  })
}

async function listeningPortsWindows(): Promise<Map<number, string[]>> {
  const { stdout } = await execFileAsync('netstat', ['-ano'], {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseWindowsNetstat(stdout)
}

async function listeningPortsLinuxProc(): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>()
  const ipv4 = await readFile('/proc/net/tcp', 'utf8')
  mergeListenMaps(map, parseProcNetTcp(ipv4, 'ipv4'))
  try {
    const ipv6 = await readFile('/proc/net/tcp6', 'utf8')
    mergeListenMaps(map, parseProcNetTcp(ipv6, 'ipv6'))
  } catch {
    /* tcp6 is optional */
  }
  return map
}

/** Generic `netstat -lnt` / `netstat -an` LISTEN rows (Linux/macOS). */
export function parseUnixNetstat(stdout: string): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!/^tcp/i.test(trimmed) || !/\bLISTEN/i.test(trimmed)) continue
    const cols = trimmed.split(/\s+/)
    const local = cols.find((col) => col.includes('.') || col.includes(':') || col.includes('*'))
    if (!local) continue
    const normalized = local.includes('.') && local.lastIndexOf('.') > local.lastIndexOf(':')
      ? local.replace(/\.(\d+)$/, ':$1')
      : local
    const parsed = parseLocalAddress(normalized.replace(/^\*:/, '0.0.0.0:'))
    if (parsed) addBind(map, parsed.port, parsed.address === '*' ? '0.0.0.0' : parsed.address)
  }
  return map
}

async function listeningPortsUnixNetstat(): Promise<Map<number, string[]>> {
  try {
    const { stdout } = await execFileAsync('netstat', ['-lnt'], {
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
    })
    const parsed = parseUnixNetstat(stdout)
    if (parsed.size > 0) return parsed
  } catch {
    /* fall through */
  }
  const { stdout } = await execFileAsync('netstat', ['-an'], {
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseUnixNetstat(stdout)
}

export async function readListeningTcpPorts(): Promise<Map<number, string[]>> {
  if (process.platform === 'win32') {
    return listeningPortsWindows()
  }
  if (process.platform === 'linux') {
    try {
      return await listeningPortsLinuxProc()
    } catch {
      return listeningPortsUnixNetstat()
    }
  }
  return listeningPortsUnixNetstat()
}
