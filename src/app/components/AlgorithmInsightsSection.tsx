'use client'
import Image from 'next/image'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Brain,
  ChevronDown,
  Globe,
  Hash,
  TrendingUp,
  Video,
  X,
} from 'lucide-react'
import { toInsightPoints } from '@/lib/home/insightPoints'

export interface AlgorithmData {
  keyChanges: string
  editingTips: string
  postingTips: string
  titleTips: string
  descriptionTips: string
  summaries?: string[]
}

export interface AlgorithmPlatform {
  id: string
  name: string
  image: string
  data: AlgorithmData | null
}

function platformAccentGradient(platformId: string): string {
  switch (platformId) {
    case 'tiktok':
      return 'from-pink-500 via-purple-500 to-cyan-500'
    case 'instagram':
      return 'from-purple-500 via-pink-500 to-orange-500'
    case 'youtube-shorts':
      return 'from-red-500 via-red-600 to-red-700'
    case 'youtube-long':
      return 'from-red-600 via-red-700 to-red-800'
    default:
      return 'from-blue-500 via-blue-600 to-blue-700'
  }
}

export interface AlgorithmInsightsSectionProps {
  darkMode: boolean
  textClasses: string
  subtitleClasses: string
  platforms: AlgorithmPlatform[]
  platformsBannerLogos: AlgorithmPlatform[]
  lastUpdated: string
  isLoadingAlgorithms: boolean
  algorithmError: string | null
  isAdmin: boolean
  showAdminControls: boolean
  onRefreshAlgorithms: (platformId?: string) => void
  expandedCard: string | null
  onExpandedCardChange: (platformId: string | null) => void
}

export default function AlgorithmInsightsSection({
  darkMode,
  textClasses,
  subtitleClasses,
  platforms,
  platformsBannerLogos,
  lastUpdated,
  isLoadingAlgorithms,
  algorithmError,
  isAdmin,
  showAdminControls,
  onRefreshAlgorithms,
  expandedCard,
  onExpandedCardChange,
}: AlgorithmInsightsSectionProps) {
  const sectionTitle = `text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`
  const expandedPlatform = expandedCard
    ? platforms.find((p) => p.id === expandedCard)
    : null
  const [openSection, setOpenSection] = useState(0)

  useEffect(() => {
    if (!expandedCard) return
    setOpenSection(0)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExpandedCardChange(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [expandedCard, onExpandedCardChange])

  return (
    <>
      <section className="mb-6">
        <h3 className={`${sectionTitle} mb-3 flex items-center gap-2`}>
          <TrendingUp className="w-6 h-6 text-sdhq-cyan-500 shrink-0" />
          Algorithm Insight
        </h3>

        <div className="flex justify-center gap-3 mb-3">
          {platformsBannerLogos.map((platform) => (
            <Image
              width={40}
              height={40}
              key={platform.id}
              src={platform.image}
              alt={platform.name}
              className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
            />
          ))}
        </div>

        <div className="flex flex-col items-center mb-4">
          <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
            Powered By: Gemini 2.5 Flash-Lite
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isLoadingAlgorithms && (
              <span className={`${subtitleClasses} text-base`}>Loading...</span>
            )}
            {algorithmError && <span className="text-red-500 text-base">{algorithmError}</span>}
            <p className={`${subtitleClasses} text-base`}>Last updated: {lastUpdated}</p>
            <p className={`${subtitleClasses} text-xs w-full text-center`}>
              Auto-refreshes on the 1st of every month via Gemini Flash-Lite · used by Analyzer
              &amp; Post4Me
            </p>
          </div>

          {isAdmin && showAdminControls && (
            <div
              className={`w-full max-w-2xl mt-4 p-4 rounded-xl border-2 ${
                darkMode
                  ? 'bg-sdhq-dark-800/80 border-sdhq-cyan-500/40'
                  : 'bg-cyan-50/80 border-sdhq-cyan-200'
              }`}
            >
              <p
                className={`text-sm font-medium mb-3 text-center ${
                  darkMode ? 'text-sdhq-cyan-300' : 'text-sdhq-cyan-800'
                }`}
              >
                Admin: research &amp; update algorithm data (one platform at a time or all)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRefreshAlgorithms()}
                disabled={isLoadingAlgorithms}
                className="w-full mb-3"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {isLoadingAlgorithms ? 'Refreshing…' : 'Refresh all platforms'}
              </Button>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {platforms.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    onClick={() => onRefreshAlgorithms(p.id)}
                    disabled={isLoadingAlgorithms}
                    className="text-xs"
                  >
                    <TrendingUp className="w-3 h-3 mr-1 shrink-0" />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${
                darkMode
                  ? 'bg-gradient-to-br from-sdhq-dark-700 to-sdhq-dark-800 border-sdhq-cyan-500/30 hover:border-sdhq-cyan-500/60'
                  : 'bg-gradient-to-br from-white to-gray-50 border-sdhq-cyan-200 hover:border-sdhq-cyan-400'
              }`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${platformAccentGradient(platform.id)}`}
              />
              <div className="p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className={`relative p-2 rounded-xl ${darkMode ? 'bg-sdhq-dark-600' : 'bg-white'} shadow-lg`}
                  >
                    <Image
                      width={56}
                      height={56}
                      src={platform.image}
                      alt={platform.name}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  </div>
                  <h4 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {platform.name}
                  </h4>
                </div>

                <div className="space-y-3">
                  {platform.data ? (
                    <>
                      {Array.isArray(platform.data.summaries) &&
                      platform.data.summaries.filter((s) => typeof s === 'string').length > 0 ? (
                        platform.data.summaries
                          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
                          .slice(0, 4)
                          .map((summary, index) => (
                          <div key={index} className="flex items-start space-x-3 group">
                            <div
                              className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 transition-all duration-300 ${
                                index === 0
                                  ? 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-cyan-400 group-hover:scale-125'
                                  : index === 1
                                    ? 'bg-gradient-to-r from-sdhq-green-500 to-sdhq-green-400 group-hover:scale-125'
                                    : index === 2
                                      ? 'bg-gradient-to-r from-sdhq-cyan-400 to-sdhq-cyan-300 group-hover:scale-125'
                                      : 'bg-gradient-to-r from-sdhq-green-400 to-sdhq-green-300 group-hover:scale-125'
                              }`}
                            />
                            <p
                              className={`${textClasses} text-base leading-relaxed group-hover:translate-x-1 transition-transform duration-300`}
                            >
                              {summary}
                            </p>
                          </div>
                        ))
                      ) : (
                        <>
                          <p className={`${textClasses} text-base`}>Key algorithm changes</p>
                          <p className={`${textClasses} text-base`}>Editing optimization tips</p>
                          <p className={`${textClasses} text-base`}>Best posting strategies</p>
                          <p className={`${textClasses} text-base`}>Title & description guides</p>
                        </>
                      )}
                      <div className="pt-4 mt-3 border-t border-gray-200 dark:border-sdhq-dark-600">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onExpandedCardChange(platform.id)}
                          className="w-full bg-gradient-to-r from-sdhq-cyan-500/10 to-sdhq-green-500/10 hover:from-sdhq-cyan-500/20 hover:to-sdhq-green-500/20 border-sdhq-cyan-500/50 hover:border-sdhq-cyan-500 transition-all duration-300"
                        >
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Read More
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-2">
                      <div className="w-8 h-8 border-2 border-sdhq-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <p className={`${subtitleClasses} text-base`}>Loading algorithm data...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {expandedPlatform && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/80 p-3 pt-3 backdrop-blur-sm animate-fade-in sm:p-4 sm:pt-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="algorithm-insight-title"
          onClick={() => onExpandedCardChange(null)}
        >
          <div
            className={`relative mt-0 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col self-start overflow-hidden rounded-3xl shadow-2xl animate-slide-up ${
              darkMode
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/30'
                : 'bg-gradient-to-br from-white to-gray-50 border border-sdhq-cyan-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-2 bg-gradient-to-r ${platformAccentGradient(expandedPlatform.id)}`} />
            <div
              className={`flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 sm:px-6 ${
                darkMode
                  ? 'bg-sdhq-dark-800/95 border-white/10'
                  : 'bg-white/95 border-sdhq-cyan-100'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`shrink-0 rounded-xl p-1.5 shadow-md ${darkMode ? 'bg-sdhq-dark-700' : 'bg-white'}`}
                >
                  <Image
                    width={48}
                    height={48}
                    src={expandedPlatform.image}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                    Algorithm Insight
                  </p>
                  <h3
                    id="algorithm-insight-title"
                    className={`truncate text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}
                  >
                    {expandedPlatform.name}
                  </h3>
                  <p className={`mt-0.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Open a section for the rest of the details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onExpandedCardChange(null)}
                title="Close"
                className={`shrink-0 rounded-full p-2 transition-all hover:scale-110 ${
                  darkMode
                    ? 'bg-sdhq-dark-700 hover:bg-sdhq-dark-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {expandedPlatform.data ? (
                <>
                  <DetailBlock
                    darkMode={darkMode}
                    accent="cyan"
                    icon={<TrendingUp className="h-4 w-4" />}
                    title="What the algorithm rewards"
                    open={openSection === 0}
                    onToggle={() => setOpenSection(openSection === 0 ? -1 : 0)}
                    body={
                      typeof expandedPlatform.data.keyChanges === 'string'
                        ? expandedPlatform.data.keyChanges
                        : 'Key changes unavailable.'
                    }
                  />
                  <DetailBlock
                    darkMode={darkMode}
                    accent="green"
                    icon={<Video className="h-4 w-4" />}
                    title="How to edit for it"
                    open={openSection === 1}
                    onToggle={() => setOpenSection(openSection === 1 ? -1 : 1)}
                    body={
                      typeof expandedPlatform.data.editingTips === 'string'
                        ? expandedPlatform.data.editingTips
                        : 'Editing tips unavailable.'
                    }
                  />
                  <DetailBlock
                    darkMode={darkMode}
                    accent="cyan"
                    icon={<Globe className="h-4 w-4" />}
                    title="When and how often to post"
                    open={openSection === 2}
                    onToggle={() => setOpenSection(openSection === 2 ? -1 : 2)}
                    body={
                      typeof expandedPlatform.data.postingTips === 'string'
                        ? expandedPlatform.data.postingTips
                        : 'Posting tips unavailable.'
                    }
                  />
                  <DetailBlock
                    darkMode={darkMode}
                    accent="green"
                    icon={<Hash className="h-4 w-4" />}
                    title="Titles that get clicks"
                    open={openSection === 3}
                    onToggle={() => setOpenSection(openSection === 3 ? -1 : 3)}
                    body={
                      typeof expandedPlatform.data.titleTips === 'string'
                        ? expandedPlatform.data.titleTips
                        : 'Title tips unavailable.'
                    }
                  />
                  <DetailBlock
                    darkMode={darkMode}
                    accent="cyan"
                    icon={<Brain className="h-4 w-4" />}
                    title="Captions, tags & CTAs"
                    open={openSection === 4}
                    onToggle={() => setOpenSection(openSection === 4 ? -1 : 4)}
                    body={
                      typeof expandedPlatform.data.descriptionTips === 'string'
                        ? expandedPlatform.data.descriptionTips
                        : 'Description tips unavailable.'
                    }
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-sdhq-cyan-500 border-t-transparent" />
                  <p className={`${subtitleClasses} text-base`}>Loading algorithm data...</p>
                </div>
              )}

              <Button
                variant="outline"
                size="lg"
                onClick={() => onExpandedCardChange(null)}
                className="w-full border-sdhq-cyan-500/50 bg-gradient-to-r from-sdhq-cyan-500/10 to-sdhq-green-500/10 hover:border-sdhq-cyan-500"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailBlock({
  darkMode,
  accent,
  icon,
  title,
  body,
  open,
  onToggle,
}: {
  darkMode: boolean
  accent: 'cyan' | 'green'
  icon: ReactNode
  title: string
  body: string
  open: boolean
  onToggle: () => void
}) {
  const isCyan = accent === 'cyan'
  const points = toInsightPoints(body)
  const takeaway = points[0] || body
  const rest = points.slice(1)

  return (
    <section
      className={`rounded-2xl border p-4 sm:p-5 ${
        darkMode
          ? `bg-sdhq-dark-700/50 ${isCyan ? 'border-sdhq-cyan-500/25' : 'border-sdhq-green-500/25'}`
          : `bg-white ${isCyan ? 'border-sdhq-cyan-200' : 'border-sdhq-green-200'}`
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <h4
          className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${
            isCyan
              ? darkMode
                ? 'text-sdhq-cyan-400'
                : 'text-sdhq-cyan-700'
              : darkMode
                ? 'text-sdhq-green-400'
                : 'text-sdhq-green-700'
          }`}
        >
          {icon}
          {title}
        </h4>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
        />
      </button>
      <p className={`mt-3 text-base leading-relaxed ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {takeaway}
      </p>
      {open && rest.length > 0 && (
        <ul className={`mt-3 space-y-2 text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {rest.map((point) => (
            <li key={point.slice(0, 48)} className="flex gap-2.5">
              <span
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                  isCyan ? 'bg-sdhq-cyan-400' : 'bg-sdhq-green-400'
                }`}
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
