'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, RefreshCw, AlertTriangle, TrendingUp, ExternalLink } from 'lucide-react'
import type { TradebotSnapshot, TradebotOpportunity } from '@/lib/tradebot/types'

interface TradebotTabProps {
  darkMode: boolean
  subtitleClasses: string
  title: string
  scanLabel: string
  scanningLabel: string
  noOpportunitiesLabel: string
  aiInsightLabel: string
  setupTitle: string
  lastScanLabel: string
  alertsOnlyLabel: string
}

const SEVERITY_STYLES: Record<
  TradebotOpportunity['severity'],
  { badge: string; border: string }
> = {
  high: {
    badge: 'bg-red-500/20 text-red-400 border-red-500/40',
    border: 'border-red-500/30',
  },
  medium: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    border: 'border-orange-500/30',
  },
  low: {
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    border: 'border-yellow-500/30',
  },
  info: {
    badge: 'bg-sdhq-cyan-500/20 text-sdhq-cyan-300 border-sdhq-cyan-500/40',
    border: 'border-sdhq-cyan-500/30',
  },
}

function formatScanTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function kindLabel(kind: TradebotOpportunity['kind']): string {
  switch (kind) {
    case 'crypto_cross_venue':
      return 'Crypto spread'
    case 'crypto_bitbuy':
      return 'Bitbuy vs Kraken'
    case 'stock_unusual_move':
      return 'Stock move'
  }
}

export default function TradebotTab({
  darkMode,
  subtitleClasses,
  title,
  scanLabel,
  scanningLabel,
  noOpportunitiesLabel,
  aiInsightLabel,
  setupTitle,
  lastScanLabel,
  alertsOnlyLabel,
}: TradebotTabProps) {
  const [snapshot, setSnapshot] = useState<TradebotSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/tradebot/opportunities', { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { snapshot: TradebotSnapshot | null }
      setSnapshot(data.snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const runScan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch('/api/tradebot/opportunities', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { snapshot: TradebotSnapshot }
      setSnapshot(data.snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  const cardBg = darkMode ? 'bg-sdhq-dark-900/60 border-sdhq-dark-700' : 'bg-white/60 border-sdhq-cyan-200'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className={`w-6 h-6 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
            <h4 className={`text-lg font-semibold ${textMain}`}>{title}</h4>
          </div>
          <p className={`text-xs mt-1 ${subtitleClasses}`}>{alertsOnlyLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={scanning}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            darkMode
              ? 'bg-sdhq-cyan-600 hover:bg-sdhq-cyan-500 text-white disabled:opacity-50'
              : 'bg-sdhq-cyan-700 hover:bg-sdhq-cyan-600 text-white disabled:opacity-50'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? scanningLabel : scanLabel}
        </button>
      </div>

      {!snapshot?.finnhubConfigured && (
        <div
          className={`rounded-xl border p-4 ${darkMode ? 'border-amber-500/40 bg-amber-500/10' : 'border-amber-300 bg-amber-50'}`}
        >
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className={`font-semibold ${textMain}`}>{setupTitle}</p>
              <p className={subtitleClasses}>
                Kraken, CoinGecko, and Frankfurter FX work with no keys. Add{' '}
                <code className="text-xs">FINNHUB_API_KEY</code> for US stock/ETF quotes (IBIT, SPY,
                etc.). See <code className="text-xs">docs/TRADEBOT_API_SETUP.md</code> in the repo.
              </p>
              <a
                href="https://finnhub.io/register"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sdhq-cyan-500 hover:underline text-xs"
              >
                Get free Finnhub key
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className={`text-sm text-center py-8 ${subtitleClasses}`}>Loading…</p>
      ) : (
        <>
          {snapshot?.scannedAt && (
            <p className={`text-xs ${subtitleClasses}`}>
              {lastScanLabel}: {formatScanTime(snapshot.scannedAt)}
            </p>
          )}

          {snapshot?.aiSummary && (
            <div className={`rounded-xl border p-4 ${cardBg}`}>
              <p className={`text-sm font-semibold mb-2 ${textMain}`}>{aiInsightLabel}</p>
              <div className={`text-sm whitespace-pre-wrap ${subtitleClasses}`}>{snapshot.aiSummary}</div>
            </div>
          )}

          {snapshot?.opportunities?.length ? (
            <ul className="space-y-3">
              {snapshot.opportunities.map((opp) => {
                const styles = SEVERITY_STYLES[opp.severity]
                return (
                  <li
                    key={opp.id}
                    className={`rounded-xl border p-4 ${cardBg} ${styles.border}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${styles.badge}`}>
                        {opp.severity.toUpperCase()}
                      </span>
                      <span className={`text-xs ${subtitleClasses}`}>{kindLabel(opp.kind)}</span>
                      <span className={`text-sm font-semibold ${textMain}`}>
                        {opp.symbol} — {opp.label}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <TrendingUp className={`w-4 h-4 shrink-0 mt-0.5 ${subtitleClasses}`} />
                      <div className="text-sm space-y-1">
                        <p className={textMain}>
                          {opp.venueA}: {opp.priceA.toFixed(2)} {opp.currency} · {opp.venueB}:{' '}
                          {opp.priceB.toFixed(2)} {opp.currency}
                        </p>
                        <p className={subtitleClasses}>
                          Net edge ~{opp.netEdgeBps.toFixed(0)} bps ({(opp.netEdgeBps / 100).toFixed(2)}%)
                        </p>
                        <p className={subtitleClasses}>{opp.note}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            !scanning && (
              <p className={`text-sm text-center py-8 ${subtitleClasses}`}>{noOpportunitiesLabel}</p>
            )
          )}

          {snapshot?.errors?.length ? (
            <details className={`text-xs ${subtitleClasses}`}>
              <summary className="cursor-pointer">Provider notes ({snapshot.errors.length})</summary>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {snapshot.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  )
}
