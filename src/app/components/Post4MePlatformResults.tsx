'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Post4MePlatformOutput } from '@/lib/post4meFormat'

interface Post4MePlatformResultsProps {
  results: Post4MePlatformOutput[]
  darkMode: boolean
  subtitleClasses: string
  platformImages: Record<string, string>
}

function ViralityBadge({
  score,
  summary,
  darkMode,
  subtitleClasses,
}: {
  score: number
  summary?: string
  darkMode: boolean
  subtitleClasses: string
}) {
  return (
    <div
      className={`p-3 rounded-lg border mb-3 ${
        score >= 80
          ? darkMode
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-green-50 border-green-200'
          : darkMode
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-sdhq-cyan-400">Virality score</span>
        <span
          className={`text-lg font-bold ${score >= 80 ? 'text-green-400' : 'text-amber-400'}`}
        >
          {score}/100
        </span>
      </div>
      {summary && (
        <p className={`text-xs mt-2 ${subtitleClasses}`}>{summary}</p>
      )}
    </div>
  )
}

function CopyButton({
  label,
  copied,
  onCopy,
}: {
  label: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-xs text-sdhq-cyan-400 hover:text-sdhq-cyan-300 shrink-0"
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}

function YouTubePlatformBlock({
  result,
  darkMode,
  subtitleClasses,
  copyKey,
  copied,
  setCopied,
}: {
  result: Post4MePlatformOutput
  darkMode: boolean
  subtitleClasses: string
  copyKey: string
  copied: Record<string, boolean | number | null>
  setCopied: React.Dispatch<React.SetStateAction<Record<string, boolean | number | null>>>
}) {
  const panel = darkMode ? 'bg-sdhq-dark-800' : 'bg-white'
  const titles = result.titles.length ? result.titles : result.title ? [result.title] : []
  const youtubeDescription = result.youtubeDescription ?? ''

  return (
    <div className="space-y-3">
      <p className={`text-xs ${subtitleClasses}`}>
        Separate fields for YouTube Studio — title, description, and comma-separated tags.
      </p>
      {titles.map((t, idx) => (
        <div key={idx} className={`p-3 rounded-lg flex items-start justify-between gap-2 ${panel}`}>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-sdhq-cyan-400 block mb-1">
              Title option {idx + 1}
            </span>
            <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{t}</span>
          </div>
          <CopyButton
            label="Copy"
            copied={copied[`${copyKey}-title-${idx}`] === true}
            onCopy={() => {
              navigator.clipboard.writeText(t)
              setCopied((prev) => ({ ...prev, [`${copyKey}-title-${idx}`]: true }))
              setTimeout(
                () => setCopied((prev) => ({ ...prev, [`${copyKey}-title-${idx}`]: false })),
                2000
              )
            }}
          />
        </div>
      ))}
      {youtubeDescription && (
        <div className={`p-3 rounded-lg ${panel}`}>
          <div className="flex justify-between mb-2">
            <span className="text-xs font-semibold text-sdhq-cyan-400">Description</span>
            <CopyButton
              label="Copy"
              copied={copied[`${copyKey}-desc`] === true}
              onCopy={() => {
                navigator.clipboard.writeText(youtubeDescription)
                setCopied((prev) => ({ ...prev, [`${copyKey}-desc`]: true }))
                setTimeout(
                  () => setCopied((prev) => ({ ...prev, [`${copyKey}-desc`]: false })),
                  2000
                )
              }}
            />
          </div>
          <p className={`text-sm whitespace-pre-wrap ${subtitleClasses}`}>{youtubeDescription}</p>
        </div>
      )}
      {result.tags.length > 0 && (
        <div className={`p-3 rounded-lg ${panel}`}>
          <div className="flex justify-between mb-2">
            <span className="text-xs font-semibold text-sdhq-cyan-400">
              Tags (comma-separated, no #)
            </span>
            <CopyButton
              label="Copy all"
              copied={copied[`${copyKey}-tags`] === true}
              onCopy={() => {
                navigator.clipboard.writeText(result.youtubeTagsCopy ?? '')
                setCopied((prev) => ({ ...prev, [`${copyKey}-tags`]: true }))
                setTimeout(
                  () => setCopied((prev) => ({ ...prev, [`${copyKey}-tags`]: false })),
                  2000
                )
              }}
            />
          </div>
          <p className={`text-xs font-mono break-all ${subtitleClasses}`}>
            {result.youtubeTagsCopy}
          </p>
        </div>
      )}
    </div>
  )
}

function CombinedCaptionBlock({
  result,
  darkMode,
  subtitleClasses,
  copyKey,
  copied,
  setCopied,
}: {
  result: Post4MePlatformOutput
  darkMode: boolean
  subtitleClasses: string
  copyKey: string
  copied: Record<string, boolean | number | null>
  setCopied: React.Dispatch<React.SetStateAction<Record<string, boolean | number | null>>>
}) {
  const caption = result.combinedCaption || result.description
  const panel = darkMode ? 'bg-sdhq-dark-800' : 'bg-white'

  return (
    <div className="space-y-3">
      <p className={`text-xs ${subtitleClasses}`}>
        One combined caption — hook, description, and hashtags ready to paste.
      </p>
      <div className={`p-4 rounded-lg ${panel}`}>
        <p className={`text-sm whitespace-pre-wrap mb-3 ${subtitleClasses}`}>{caption}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(caption)
            setCopied((prev) => ({ ...prev, [`${copyKey}-caption`]: true }))
            setTimeout(
              () => setCopied((prev) => ({ ...prev, [`${copyKey}-caption`]: false })),
              2000
            )
          }}
          className="w-full"
        >
          <Copy className="w-4 h-4 mr-2" />
          {copied[`${copyKey}-caption`] ? 'Copied!' : 'Copy full caption'}
        </Button>
      </div>
    </div>
  )
}

export default function Post4MePlatformResults({
  results,
  darkMode,
  subtitleClasses,
  platformImages,
}: Post4MePlatformResultsProps) {
  const [copied, setCopied] = useState<Record<string, boolean | number | null>>({})
  const card = darkMode
    ? 'bg-sdhq-dark-700/80 border-sdhq-dark-600'
    : 'bg-gray-50 border-gray-200'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {results.map((result) => (
        <section
          key={result.platformId}
          className={`rounded-xl border-2 p-4 ${card}`}
        >
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
            {platformImages[result.platformId] && (
              <img
                src={platformImages[result.platformId]}
                alt=""
                className="w-9 h-9 rounded-lg object-cover"
              />
            )}
            <div>
              <h5 className={`font-bold ${textMain}`}>{result.platformName}</h5>
              <p className={`text-xs ${subtitleClasses}`}>
                {result.isYouTube ? 'YouTube format' : 'Combined caption format'}
              </p>
            </div>
          </div>

          {result.viralityScore != null && (
            <ViralityBadge
              score={result.viralityScore}
              summary={result.viralitySummary}
              darkMode={darkMode}
              subtitleClasses={subtitleClasses}
            />
          )}

          {result.isYouTube ? (
            <YouTubePlatformBlock
              result={result}
              darkMode={darkMode}
              subtitleClasses={subtitleClasses}
              copyKey={result.platformId}
              copied={copied}
              setCopied={setCopied}
            />
          ) : (
            <CombinedCaptionBlock
              result={result}
              darkMode={darkMode}
              subtitleClasses={subtitleClasses}
              copyKey={result.platformId}
              copied={copied}
              setCopied={setCopied}
            />
          )}
        </section>
      ))}
    </div>
  )
}
