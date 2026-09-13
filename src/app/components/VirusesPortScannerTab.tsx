'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bug,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import {
  bindMapFromOpenRows,
  buildInboundPage,
  INBOUND_PAGE_SIZE,
  openDetailLookup,
  PORT_MAX,
  type ProtoFilter,
  type StatusFilter,
} from '@/lib/virusesPortScanner/ports'
import {
  CLOUD_SCAN_USER_MESSAGE,
  formatLocalIpDisplay,
  isThisPcScanHost,
} from '@/lib/virusesPortScanner/localScan'
import { formatProcessLabel, formatProcessList } from '@/lib/virusesPortScanner/processLabel'
import type { PortConnection, PortScanResult } from '@/lib/virusesPortScanner/types'

export interface VirusesPortScannerTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
}

function formatBinds(binds: string[]): string {
  if (!binds.length) return '—'
  return binds.join(', ')
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatRemote(conn: PortConnection): string {
  if (!conn.remoteAddress || conn.remoteAddress === '*') return '—'
  if (conn.remotePort == null) return conn.remoteAddress
  return `${conn.remoteAddress}:${conn.remotePort}`
}

export default function VirusesPortScannerTab({
  darkMode,
  subtitleClasses,
  description,
}: VirusesPortScannerTabProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PortScanResult | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('Open')
  const [proto, setProto] = useState<ProtoFilter>('tcp')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [trafficQuery, setTrafficQuery] = useState('')

  const shell = darkMode
    ? 'bg-black/70 border-sdhq-green-500/30 text-sdhq-green-100'
    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
  const card = darkMode
    ? 'bg-sdhq-dark-900/80 border-sdhq-green-500/25'
    : 'bg-white/90 border-emerald-200'
  const textMain = darkMode ? 'text-sdhq-green-100' : 'text-emerald-950'
  const accent = darkMode ? 'text-sdhq-green-400' : 'text-emerald-700'
  const inputShell = darkMode
    ? 'bg-black border-sdhq-green-700 text-sdhq-green-100 placeholder-sdhq-green-700/80 focus:border-sdhq-green-400'
    : 'bg-white border-emerald-300 text-emerald-950 placeholder-emerald-400 focus:border-emerald-600'
  const chipIdle = darkMode
    ? 'border-sdhq-green-800 bg-black text-sdhq-green-300 hover:border-sdhq-green-500'
    : 'border-emerald-300 bg-white text-emerald-800 hover:border-emerald-500'
  const chipActive = darkMode
    ? 'border-sdhq-green-400 bg-sdhq-green-500/15 text-sdhq-green-300'
    : 'border-emerald-600 bg-emerald-600/10 text-emerald-800'

  const runScan = useCallback(async () => {
    setIsWorking(true)
    setError('')
    try {
      if (typeof window !== 'undefined' && !isThisPcScanHost(window.location.hostname)) {
        setResult(null)
        throw new Error(CLOUD_SCAN_USER_MESSAGE)
      }
      const res = await fetch('/api/viruses-port-scanner', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await parseJsonResponse<PortScanResult & { userMessage?: string; error?: string }>(
        res
      )
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Port scan failed')
      }
      if (!Array.isArray(data.ports)) {
        throw new Error('Scan returned no port list.')
      }
      setResult(data)
      setPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Port scan failed')
    } finally {
      setIsWorking(false)
    }
  }, [])

  useEffect(() => {
    void runScan()
  }, [runScan])

  const tcpBinds = useMemo(
    () => (result ? bindMapFromOpenRows(result.ports, 'tcp') : new Map<number, string[]>()),
    [result]
  )
  const udpBinds = useMemo(
    () => (result ? bindMapFromOpenRows(result.ports, 'udp') : new Map<number, string[]>()),
    [result]
  )

  const details = useMemo(() => (result ? openDetailLookup(result.ports) : new Map()), [result])

  const inboundPage = useMemo(() => {
    if (!result) {
      return { rows: [], matched: 0, page: 1, pages: 1 }
    }
    return buildInboundPage({
      tcpBinds,
      udpBinds,
      details,
      filter,
      proto,
      query,
      page,
      pageSize: INBOUND_PAGE_SIZE,
    })
  }, [result, tcpBinds, udpBinds, details, filter, proto, query, page])

  useEffect(() => {
    if (inboundPage.page !== page) setPage(inboundPage.page)
  }, [inboundPage.page, page])

  const trafficRows = useMemo(() => {
    if (!result) return []
    const q = trafficQuery.trim().toLowerCase()
    return result.connections.filter((conn) => {
      if (!q) return true
      const hay = [
        conn.direction,
        conn.proto,
        conn.state,
        conn.localAddress,
        String(conn.localPort),
        conn.remoteAddress,
        conn.remotePort == null ? '' : String(conn.remotePort),
        conn.pid == null ? '' : String(conn.pid),
        conn.process?.name || '',
        conn.process?.version || '',
        conn.process?.product || '',
        conn.process?.description || '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [result, trafficQuery])

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-6 space-y-5 ${shell}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,0,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,0,0.35) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                darkMode
                  ? 'border-sdhq-green-500/40 bg-sdhq-green-500/10 text-sdhq-green-400'
                  : 'border-emerald-400 bg-emerald-100 text-emerald-700'
              }`}
            >
              <Bug className="w-6 h-6" />
            </span>
            <div>
              <p className={`text-[11px] font-mono uppercase tracking-[0.22em] ${accent}`}>
                R&D lab · full TCP/UDP sweep
              </p>
              <h4 className={`text-xl font-bold font-mono ${textMain}`}>Viruses Port Scanner</h4>
              <p className={`text-sm mt-1 max-w-2xl ${subtitleClasses}`}>{description}</p>
              <label className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 max-w-xl">
                <span className={`text-xs font-semibold uppercase tracking-wide shrink-0 ${accent}`}>
                  Local IP
                </span>
                <span className="relative flex-1">
                  <Globe className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
                  <input
                    readOnly
                    value={
                      result
                        ? formatLocalIpDisplay(result.lanIps, result.host)
                        : isWorking
                          ? 'Detecting…'
                          : 'Unavailable'
                    }
                    className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm font-mono outline-none ${inputShell}`}
                  />
                </span>
              </label>
              {result?.host ? (
                <p className={`text-xs font-mono mt-1 ${subtitleClasses}`}>
                  This PC only · {result.hostname} · {result.host}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => void runScan()}
            disabled={isWorking}
            className="bg-sdhq-green-500 hover:bg-sdhq-green-400 text-black shadow-neon-green"
          >
            {isWorking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}

        {result?.note && (
          <p
            className={`text-xs rounded-lg border px-3 py-2 ${
              darkMode
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {result.note}
          </p>
        )}
      </div>

      {result && (
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-sdhq-green-500">
              <ShieldAlert className="w-3.5 h-3.5" />
              Inbound open
            </div>
            <p className="text-2xl font-mono font-bold text-sdhq-green-400 mt-1">
              {result.tcpOpenCount} TCP
            </p>
            <p className={`text-xs font-mono ${subtitleClasses}`}>{result.udpOpenCount} UDP bound</p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-rose-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Closed TCP
            </div>
            <p className="text-2xl font-mono font-bold text-rose-400 mt-1">{result.closedCount}</p>
            <p className={`text-xs font-mono ${subtitleClasses}`}>of {PORT_MAX} ports</p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-cyan-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Outbound
            </div>
            <p className="text-2xl font-mono font-bold text-cyan-400 mt-1">{result.outboundCount}</p>
            <p className={`text-xs font-mono ${subtitleClasses}`}>
              {result.inboundSessionCount} inbound sessions
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className={`text-[11px] uppercase tracking-wide font-semibold ${accent}`}>Host</div>
            <p className={`text-sm font-mono font-semibold mt-1 truncate ${textMain}`}>
              {result.hostname}
            </p>
            <p className={`text-xs font-mono ${subtitleClasses}`}>
              {result.platform} · {formatDuration(result.durationMs)}
            </p>
          </div>
        </div>
      )}

      <section className="relative space-y-3">
        <h5 className={`text-sm font-semibold font-mono ${accent}`}>Inbound ports (1–{PORT_MAX})</h5>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex flex-wrap gap-2">
            {(['all', 'Open', 'Closed'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilter(id)
                  setPage(1)
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                  filter === id ? chipActive : chipIdle
                }`}
              >
                {id === 'all' ? 'All' : id}
              </button>
            ))}
            {(['tcp', 'udp', 'both'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setProto(id)
                  setPage(1)
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                  proto === id ? chipActive : chipIdle
                }`}
              >
                {id === 'both' ? 'TCP+UDP' : id.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Jump by port, process, version, or bind…"
              className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none ${inputShell}`}
            />
          </label>
        </div>

        <div className={`rounded-xl border overflow-hidden ${card}`}>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead
                className={`sticky top-0 z-10 ${
                  darkMode ? 'bg-black text-sdhq-green-400' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <tr className="text-left text-[11px] uppercase tracking-wider">
                  <th className="px-3 py-2 font-semibold">Port</th>
                  <th className="px-3 py-2 font-semibold">Proto</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Process</th>
                  <th className="px-3 py-2 font-semibold">Version</th>
                  <th className="px-3 py-2 font-semibold">Bind</th>
                </tr>
              </thead>
              <tbody>
                {isWorking && !result ? (
                  <tr>
                    <td colSpan={7} className={`px-3 py-8 text-center ${subtitleClasses}`}>
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Reading every local TCP/UDP socket…
                      </span>
                    </td>
                  </tr>
                ) : inboundPage.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-3 py-8 text-center ${subtitleClasses}`}>
                      No ports match this filter.
                    </td>
                  </tr>
                ) : (
                  inboundPage.rows.map((row) => (
                    <tr
                      key={`${row.proto}-${row.port}`}
                      className={`border-t ${
                        darkMode ? 'border-sdhq-green-900/60' : 'border-emerald-100'
                      }`}
                    >
                      <td className={`px-3 py-1.5 font-mono font-semibold ${textMain}`}>{row.port}</td>
                      <td className={`px-3 py-1.5 font-mono uppercase text-xs ${subtitleClasses}`}>
                        {row.proto}
                      </td>
                      <td className={`px-3 py-1.5 font-mono ${subtitleClasses}`}>{row.service}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            row.status === 'Open'
                              ? 'bg-sdhq-green-500/15 text-sdhq-green-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className={`px-3 py-1.5 text-xs ${textMain}`}>
                        {row.status === 'Open' ? formatProcessList(row.processes) : '—'}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${subtitleClasses}`}>
                        {row.processes[0]?.version || row.processes[0]?.product || '—'}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${subtitleClasses}`}>
                        {formatBinds(row.binds)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {result && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs border-t ${
                darkMode ? 'border-sdhq-green-900/60' : 'border-emerald-100'
              } ${subtitleClasses}`}
            >
              <p>
                Showing {inboundPage.rows.length} of {inboundPage.matched.toLocaleString()} · page{' '}
                {inboundPage.page}/{inboundPage.pages}
                {isWorking ? ' · refreshing…' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={inboundPage.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={inboundPage.page >= inboundPage.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="relative space-y-3">
        <h5 className={`text-sm font-semibold font-mono ${accent}`}>
          Live traffic · inbound sessions and outbound connections
        </h5>
        <label className="relative block">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
          <input
            value={trafficQuery}
            onChange={(e) => setTrafficQuery(e.target.value)}
            placeholder="Filter by remote host, local port, PID, in/out…"
            className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none ${inputShell}`}
          />
        </label>
        <div className={`rounded-xl border overflow-hidden ${card}`}>
          <div className="max-h-[22rem] overflow-auto">
            <table className="w-full text-sm">
              <thead
                className={`sticky top-0 z-10 ${
                  darkMode ? 'bg-black text-sdhq-green-400' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <tr className="text-left text-[11px] uppercase tracking-wider">
                  <th className="px-3 py-2 font-semibold">Dir</th>
                  <th className="px-3 py-2 font-semibold">Local</th>
                  <th className="px-3 py-2 font-semibold">Remote</th>
                  <th className="px-3 py-2 font-semibold">Process</th>
                  <th className="px-3 py-2 font-semibold">Version</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">PID</th>
                </tr>
              </thead>
              <tbody>
                {!result || trafficRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`px-3 py-8 text-center ${subtitleClasses}`}>
                      {result ? 'No active TCP sessions match.' : 'Waiting for sweep…'}
                    </td>
                  </tr>
                ) : (
                  trafficRows.map((conn, index) => (
                    <tr
                      key={`${conn.proto}-${conn.localAddress}-${conn.localPort}-${conn.remoteAddress}-${conn.remotePort}-${index}`}
                      className={`border-t ${
                        darkMode ? 'border-sdhq-green-900/60' : 'border-emerald-100'
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            conn.direction === 'outbound'
                              ? 'bg-cyan-500/15 text-cyan-400'
                              : 'bg-sdhq-green-500/15 text-sdhq-green-400'
                          }`}
                        >
                          {conn.direction === 'outbound' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownLeft className="w-3 h-3" />
                          )}
                          {conn.direction}
                        </span>
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${textMain}`}>
                        {conn.localAddress}:{conn.localPort}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${subtitleClasses}`}>
                        {formatRemote(conn)}
                      </td>
                      <td className={`px-3 py-1.5 text-xs ${textMain}`}>
                        {formatProcessLabel(conn.process)}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${subtitleClasses}`}>
                        {conn.process?.version || conn.process?.product || '—'}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs uppercase ${subtitleClasses}`}>
                        {conn.state}
                      </td>
                      <td className={`px-3 py-1.5 font-mono text-xs ${subtitleClasses}`}>
                        {conn.pid == null ? '—' : conn.pid}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
