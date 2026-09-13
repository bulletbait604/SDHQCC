'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, Loader2, RefreshCw, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import type { PortScanResult, PortScanRow, PortStatus } from '@/lib/virusesPortScanner/types'

export interface VirusesPortScannerTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
}

type StatusFilter = 'all' | PortStatus

function formatBinds(binds: string[]): string {
  if (!binds.length) return '—'
  return binds.join(', ')
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export default function VirusesPortScannerTab({
  darkMode,
  subtitleClasses,
  description,
}: VirusesPortScannerTabProps) {
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PortScanResult | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

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
      const res = await fetch('/api/viruses-port-scanner', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await parseJsonResponse<PortScanResult & { userMessage?: string; error?: string }>(res)
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Port scan failed')
      }
      if (!Array.isArray(data.ports)) {
        throw new Error('Scan returned no port list.')
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Port scan failed')
    } finally {
      setIsWorking(false)
    }
  }, [])

  useEffect(() => {
    void runScan()
  }, [runScan])

  const filteredRows = useMemo(() => {
    if (!result) return [] as PortScanRow[]
    const q = query.trim().toLowerCase()
    return result.ports.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false
      if (!q) return true
      return (
        String(row.port).includes(q) ||
        row.service.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.binds.some((bind) => bind.toLowerCase().includes(q))
      )
    })
  }, [result, filter, query])

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
                R&D lab · TCP sweep
              </p>
              <h4 className={`text-xl font-bold font-mono ${textMain}`}>Viruses Port Scanner</h4>
              <p className={`text-sm mt-1 max-w-2xl ${subtitleClasses}`}>{description}</p>
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
              Open
            </div>
            <p className="text-2xl font-mono font-bold text-sdhq-green-400 mt-1">{result.openCount}</p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-rose-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Closed
            </div>
            <p className="text-2xl font-mono font-bold text-rose-400 mt-1">{result.closedCount}</p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className={`text-[11px] uppercase tracking-wide font-semibold ${accent}`}>Host</div>
            <p className={`text-sm font-mono font-semibold mt-1 truncate ${textMain}`}>
              {result.hostname}
            </p>
            <p className={`text-xs font-mono ${subtitleClasses}`}>
              {result.host} · {result.platform}
            </p>
          </div>
          <div className={`rounded-xl border px-3 py-3 ${card}`}>
            <div className={`text-[11px] uppercase tracking-wide font-semibold ${accent}`}>Sweep</div>
            <p className={`text-sm font-mono font-semibold mt-1 ${textMain}`}>
              {result.total} ports · {formatDuration(result.durationMs)}
            </p>
            <p className={`text-xs ${subtitleClasses}`}>
              {new Date(result.scannedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="relative flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(['all', 'Open', 'Closed'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                filter === id ? chipActive : chipIdle
              }`}
            >
              {id === 'all' ? 'All' : id}
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${accent}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by port, service, or bind…"
            className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none ${inputShell}`}
          />
        </label>
      </div>

      <div className={`relative rounded-xl border overflow-hidden ${card}`}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead
              className={`sticky top-0 z-10 ${
                darkMode ? 'bg-black text-sdhq-green-400' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <tr className="text-left text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 font-semibold">Port</th>
                <th className="px-3 py-2 font-semibold">Service</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Bind</th>
              </tr>
            </thead>
            <tbody>
              {isWorking && !result ? (
                <tr>
                  <td colSpan={4} className={`px-3 py-8 text-center ${subtitleClasses}`}>
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sweeping known TCP ports…
                    </span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`px-3 py-8 text-center ${subtitleClasses}`}>
                    No ports match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.port}
                    className={`border-t ${
                      darkMode ? 'border-sdhq-green-900/60' : 'border-emerald-100'
                    }`}
                  >
                    <td className={`px-3 py-1.5 font-mono font-semibold ${textMain}`}>{row.port}</td>
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
          <p className={`px-3 py-2 text-xs border-t ${darkMode ? 'border-sdhq-green-900/60' : 'border-emerald-100'} ${subtitleClasses}`}>
            Showing {filteredRows.length} of {result.total} known TCP ports
            {isWorking ? ' · refreshing…' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
