'use client'

import { useState } from 'react'
import {
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import {
  TRENDING_VIDS_PLATFORMS,
  type TrendingVidsPlatformId,
} from '@/lib/trendingVids/platforms'
import type { TrendingVidsResult } from '@/lib/trendingVids/research'

export interface TrendingVidsTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
}

const KIND_LABEL: Record<string, string> = {
  video: 'Video',
  topic: 'Topic',
  hashtag: 'Hashtag',
  sound: 'Sound',
  post: 'Post',
}

function formatTrendCopy(result: TrendingVidsResult, index?: number): string {
  const items = typeof index === 'number' ? [result.trends[index]] : result.trends
  const lines = [`${result.platformName} — top ${items.length} (researched ${result.researchedAt.slice(0, 10)})`]
  if (result.overview) lines.push(result.overview, '')
  for (const t of items) {
    if (!t) continue
    lines.push(`${t.rank}. [${KIND_LABEL[t.kind] || t.kind}] ${t.title}`)
    if (t.creator) lines.push(`   Creator: ${t.creator}`)
    if (t.summary) lines.push(`   ${t.summary}`)
    if (t.whyTrending) lines.push(`   Why: ${t.whyTrending}`)
    if (t.metric) lines.push(`   ${t.metric}`)
    if (t.tags.length) lines.push(`   Tags: ${t.tags.map((tag) => `#${tag}`).join(' ')}`)
    if (t.url) lines.push(`   ${t.url}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

export default function TrendingVidsTab({
  darkMode,
  subtitleClasses,
  description,
}: TrendingVidsTabProps) {
  const [platformId, setPlatformId] = useState<TrendingVidsPlatformId>('youtube')
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TrendingVidsResult | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  const platform = TRENDING_VIDS_PLATFORMS.find((p) => p.id === platformId)!

  const chipIdle = darkMode
    ? 'border-sdhq-dark-600 bg-sdhq-dark-900 text-gray-200 hover:border-sdhq-cyan-500/50'
    : 'border-gray-300 bg-white text-gray-800 hover:border-sdhq-cyan-400'
  const chipActive = 'border-sdhq-cyan-500 bg-sdhq-cyan-500/15 text-sdhq-cyan-400'
  const sectionTitle = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  const card = darkMode
    ? 'bg-sdhq-dark-700/80 border-sdhq-dark-600'
    : 'bg-gray-50 border-gray-200'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'

  const markCopied = (key: string) => {
    setCopied((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000)
  }

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    markCopied(key)
  }

  const handleResearch = async () => {
    setIsWorking(true)
    setError('')
    setResult(null)
    setCopied({})

    try {
      const res = await fetch('/api/trending-vids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platformId }),
      })
      const data = await parseJsonResponse<TrendingVidsResult & { userMessage?: string; error?: string }>(
        res
      )
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Trend research failed')
      }
      if (!Array.isArray(data.trends) || data.trends.length === 0) {
        throw new Error('No trends came back. Try again.')
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trend research failed')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className={`text-sm ${subtitleClasses}`}>{description}</p>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Platform</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TRENDING_VIDS_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlatformId(p.id)
                setResult(null)
                setError('')
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                platformId === p.id ? chipActive : chipIdle
              }`}
            >
              <div className="text-sm font-medium">{p.name}</div>
              <div className={`text-xs mt-0.5 ${subtitleClasses}`}>{p.hint}</div>
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleResearch}
          disabled={isWorking}
          className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
        >
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Searching Google…
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Research top 5 on {platform.name}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setResult(null)
            setError('')
            setCopied({})
          }}
          disabled={isWorking}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {isWorking && (
        <p className={`text-sm flex items-center gap-2 ${subtitleClasses}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching the live web for current {platform.name} trends…
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${card}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className={`text-lg font-bold ${textMain}`}>
                  Top {result.trends.length} on {result.platformName}
                </h4>
                {result.overview && (
                  <p className={`text-sm mt-1 ${subtitleClasses}`}>{result.overview}</p>
                )}
                <p className={`text-xs mt-2 ${subtitleClasses}`}>
                  {result.usedGoogleSearch
                    ? 'Live Google Search via Gemini'
                    : 'Gemini research (search grounding unavailable)'}
                  {result.researchedAt ? ` · ${new Date(result.researchedAt).toLocaleString()}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText('all', formatTrendCopy(result))}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copied.all ? 'Copied' : 'Copy all'}
              </Button>
            </div>
          </div>

          <ol className="space-y-3">
            {result.trends.map((trend, i) => (
              <li key={`${trend.rank}-${trend.title}`} className={`rounded-xl border p-4 ${card}`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      darkMode ? 'bg-sdhq-cyan-500/20 text-sdhq-cyan-400' : 'bg-sdhq-cyan-100 text-sdhq-cyan-700'
                    }`}
                  >
                    {trend.rank}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] uppercase tracking-wide font-semibold ${sectionTitle}`}
                      >
                        {KIND_LABEL[trend.kind] || trend.kind}
                      </span>
                      {trend.metric && (
                        <span className={`text-xs ${subtitleClasses}`}>{trend.metric}</span>
                      )}
                    </div>
                    <h5 className={`text-base font-semibold ${textMain}`}>{trend.title}</h5>
                    {trend.creator && (
                      <p className={`text-sm ${subtitleClasses}`}>{trend.creator}</p>
                    )}
                    {trend.summary && <p className={`text-sm ${textMain}`}>{trend.summary}</p>}
                    {trend.whyTrending && (
                      <p className={`text-sm ${subtitleClasses}`}>
                        <span className="font-medium">Why it is trending: </span>
                        {trend.whyTrending}
                      </p>
                    )}
                    {trend.tags.length > 0 && (
                      <p className={`text-xs ${subtitleClasses}`}>
                        {trend.tags.map((tag) => `#${tag}`).join(' ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(`t${i}`, formatTrendCopy(result, i))}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        {copied[`t${i}`] ? 'Copied' : 'Copy'}
                      </Button>
                      {trend.url && (
                        <a
                          href={trend.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center text-sm ${sectionTitle} hover:underline`}
                        >
                          Open
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {result.sources.length > 0 && (
            <div className={`rounded-xl border p-4 ${card}`}>
              <h5 className={`text-sm font-semibold mb-2 ${sectionTitle}`}>Sources</h5>
              <ul className="space-y-1">
                {result.sources.map((s) => (
                  <li key={s.uri}>
                    <a
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm hover:underline ${sectionTitle}`}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
              {result.searchQueries.length > 0 && (
                <p className={`text-xs mt-3 ${subtitleClasses}`}>
                  Queries: {result.searchQueries.join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
