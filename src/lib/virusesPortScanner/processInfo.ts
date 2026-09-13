import { execFile } from 'node:child_process'
import { readFile, readlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { ProcessInfo } from './types'

const execFileAsync = promisify(execFile)

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function normalizeProcessInfo(raw: {
  pid?: unknown
  name?: unknown
  path?: unknown
  version?: unknown
  product?: unknown
  description?: unknown
}): ProcessInfo | null {
  const pid = typeof raw.pid === 'number' ? raw.pid : Number.parseInt(String(raw.pid ?? ''), 10)
  if (!Number.isInteger(pid) || pid < 0) return null
  const name = clean(raw.name) || `pid-${pid}`
  return {
    pid,
    name,
    version: clean(raw.version),
    product: clean(raw.product),
    description: clean(raw.description),
    path: clean(raw.path),
  }
}

export function parseProcessInfoJson(raw: string): Map<number, ProcessInfo> {
  const map = new Map<number, ProcessInfo>()
  const trimmed = raw.trim()
  if (!trimmed) return map
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return map
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (!row || typeof row !== 'object') continue
    const info = normalizeProcessInfo(row as { pid?: unknown; name?: unknown })
    if (info) map.set(info.pid, info)
  }
  return map
}

/** `tasklist /FO CSV` name lookup when PowerShell version data is unavailable. */
export function parseTasklistCsv(csv: string): Map<number, ProcessInfo> {
  const map = new Map<number, ProcessInfo>()
  const lines = csv.split(/\r?\n/).filter((line) => line.trim())
  const start = lines[0] && /image name/i.test(lines[0]) ? 1 : 0
  for (let i = start; i < lines.length; i += 1) {
    const cols = lines[i].split('","').map((col) => col.replace(/^"|"$/g, '').trim())
    if (cols.length < 2) continue
    const info = normalizeProcessInfo({ name: cols[0], pid: cols[1] })
    if (info) map.set(info.pid, info)
  }
  return map
}

const POWERSHELL_PROCESS_SCRIPT = [
  '$ErrorActionPreference = "SilentlyContinue"',
  '[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8',
  '$paths = @{}',
  'Get-CimInstance Win32_Process | ForEach-Object { if ($_.ExecutablePath) { $paths[[string]$_.ProcessId] = $_.ExecutablePath } }',
  'Get-Process | ForEach-Object {',
  '  $path = $_.Path; if (-not $path) { $path = $paths[[string]$_.Id] }',
  '  $ver = $null; $prod = $null; $desc = $null',
  '  try {',
  '    if ($path) {',
  '      $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($path)',
  '      $ver = $vi.FileVersion',
  '      $prod = $vi.ProductName',
  '      $desc = $vi.FileDescription',
  '    }',
  '  } catch {}',
  '  [pscustomobject]@{ pid = $_.Id; name = $_.ProcessName; path = $path; version = $ver; product = $prod; description = $desc }',
  '} | ConvertTo-Json -Compress',
].join('; ')

async function windowsProcessMap(): Promise<Map<number, ProcessInfo>> {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_PROCESS_SCRIPT],
      { windowsHide: true, timeout: 20000, maxBuffer: 16 * 1024 * 1024 }
    )
    const parsed = parseProcessInfoJson(stdout)
    if (parsed.size > 0) return parsed
  } catch {
    /* fall through to tasklist */
  }
  const { stdout } = await execFileAsync('tasklist', ['/FO', 'CSV'], {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return parseTasklistCsv(stdout)
}

async function linuxProcess(pid: number): Promise<ProcessInfo | null> {
  try {
    const name = (await readFile(`/proc/${pid}/comm`, 'utf8')).trim()
    let path: string | null = null
    try {
      path = await readlink(`/proc/${pid}/exe`)
    } catch {
      path = null
    }
    return normalizeProcessInfo({ pid, name, path })
  } catch {
    return null
  }
}

export async function readProcessMap(pids: readonly number[]): Promise<Map<number, ProcessInfo>> {
  const wanted = new Set<number>()
  for (let i = 0; i < pids.length; i += 1) {
    const pid = pids[i]
    if (Number.isInteger(pid) && pid >= 0) wanted.add(pid)
  }
  if (wanted.size === 0) return new Map()

  if (process.platform === 'win32') {
    try {
      return await windowsProcessMap()
    } catch {
      return new Map()
    }
  }

  const map = new Map<number, ProcessInfo>()
  const unique: number[] = []
  wanted.forEach((pid) => {
    unique.push(pid)
  })
  await Promise.all(
    unique.map(async (pid) => {
      const info = await linuxProcess(pid)
      if (info) map.set(pid, info)
    })
  )
  return map
}

export function processesForPids(pids: readonly number[], byPid: Map<number, ProcessInfo>): ProcessInfo[] {
  const out: ProcessInfo[] = []
  const seen = new Set<number>()
  for (let i = 0; i < pids.length; i += 1) {
    const pid = pids[i]
    if (seen.has(pid)) continue
    seen.add(pid)
    const info = byPid.get(pid)
    if (info) out.push(info)
  }
  return out
}

export function formatProcessLabel(info: ProcessInfo | null | undefined): string {
  if (!info) return '—'
  const version = info.version || info.product
  if (version && info.description && info.description !== info.name) {
    return `${info.name} ${version} (${info.description})`
  }
  if (version) return `${info.name} ${version}`
  if (info.description && info.description !== info.name) return `${info.name} (${info.description})`
  return info.name
}

export function formatProcessList(processes: readonly ProcessInfo[]): string {
  if (!processes.length) return '—'
  return processes.map((info) => formatProcessLabel(info)).join(' · ')
}
