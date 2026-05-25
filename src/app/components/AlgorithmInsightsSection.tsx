'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Brain,
  Globe,
  Hash,
  TrendingUp,
  Video,
  X,
} from 'lucide-react'

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

  return (
    <>
      <section className="mb-12">
        <h3 className={`${sectionTitle} mb-4 flex items-center gap-2`}>
          <TrendingUp className="w-7 h-7 text-sdhq-cyan-500 shrink-0" />
          Algorithm Insight
        </h3>

        <div className="flex justify-center gap-4 mb-4">
          {platformsBannerLogos.map((platform) => (
            <img
              key={platform.id}
              src={platform.image}
              alt={platform.name}
              className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
            />
          ))}
        </div>

        <div className="flex flex-col items-center mb-6">
          <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
            Powered By: Gemini 2.5 Flash
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isLoadingAlgorithms && (
              <span className={`${subtitleClasses} text-base`}>Loading...</span>
            )}
            {algorithmError && <span className="text-red-500 text-base">{algorithmError}</span>}
            <p className={`${subtitleClasses} text-base`}>Last updated: {lastUpdated}</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className="p-5">
                <div className="flex items-center space-x-4 mb-5">
                  <div
                    className={`relative p-2 rounded-xl ${darkMode ? 'bg-sdhq-dark-600' : 'bg-white'} shadow-lg`}
                  >
                    <img
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
                      {platform.data.summaries ? (
                        platform.data.summaries.slice(0, 4).map((summary, index) => (
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className={`relative overflow-hidden rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 ${
              darkMode
                ? 'bg-gradient-to-br from-sdhq-dark-800 to-sdhq-dark-900 border border-sdhq-cyan-500/30'
                : 'bg-gradient-to-br from-white to-gray-50 border border-sdhq-cyan-200'
            }`}
          >
            <div className={`h-2 bg-gradient-to-r ${platformAccentGradient(expandedPlatform.id)}`} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div
                    className={`relative p-2 rounded-xl ${darkMode ? 'bg-sdhq-dark-700' : 'bg-white'} shadow-lg`}
                  >
                    <img
                      src={expandedPlatform.image}
                      alt={expandedPlatform.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  </div>
                  <div>
                    <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {expandedPlatform.name}
                    </h3>
                    <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'}`}>
                      Powered By: Gemini 2.5 Flash
                    </p>
                    <p className={`text-base ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
                      Algorithm Insight
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onExpandedCardChange(null)}
                  className={`p-3 rounded-full transition-all duration-300 hover:scale-110 ${
                    darkMode
                      ? 'bg-sdhq-dark-700 hover:bg-sdhq-dark-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-5">
                {expandedPlatform.data ? (
                  <>
                    <DetailBlock
                      darkMode={darkMode}
                      textClasses={textClasses}
                      accent="cyan"
                      icon={<TrendingUp className="w-5 h-5 mr-2" />}
                      title="Key Changes"
                      body={expandedPlatform.data.keyChanges}
                    />
                    <DetailBlock
                      darkMode={darkMode}
                      textClasses={textClasses}
                      accent="green"
                      icon={<Video className="w-5 h-5 mr-2" />}
                      title="Editing Tips"
                      body={expandedPlatform.data.editingTips}
                    />
                    <DetailBlock
                      darkMode={darkMode}
                      textClasses={textClasses}
                      accent="cyan"
                      icon={<Globe className="w-5 h-5 mr-2" />}
                      title="Posting Tips"
                      body={expandedPlatform.data.postingTips}
                    />
                    <DetailBlock
                      darkMode={darkMode}
                      textClasses={textClasses}
                      accent="green"
                      icon={<Hash className="w-5 h-5 mr-2" />}
                      title="Title Tips"
                      body={expandedPlatform.data.titleTips}
                    />
                    <DetailBlock
                      darkMode={darkMode}
                      textClasses={textClasses}
                      accent="cyan"
                      icon={<Brain className="w-5 h-5 mr-2" />}
                      title="Description Tips"
                      body={expandedPlatform.data.descriptionTips}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-10 h-10 border-3 border-sdhq-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className={`${subtitleClasses} text-base`}>Loading algorithm data...</p>
                  </div>
                )}

                <div className="pt-6 border-t border-gray-200 dark:border-sdhq-dark-700">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => onExpandedCardChange(null)}
                    className="w-full bg-gradient-to-r from-sdhq-cyan-500/10 to-sdhq-green-500/10 hover:from-sdhq-cyan-500/20 hover:to-sdhq-green-500/20 border-sdhq-cyan-500/50 hover:border-sdhq-cyan-500 transition-all duration-300"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailBlock({
  darkMode,
  textClasses,
  accent,
  icon,
  title,
  body,
}: {
  darkMode: boolean
  textClasses: string
  accent: 'cyan' | 'green'
  icon: ReactNode
  title: string
  body: string
}) {
  const isCyan = accent === 'cyan'
  return (
    <div
      className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
        darkMode
          ? `bg-sdhq-dark-700/50 ${isCyan ? 'border-sdhq-cyan-500/20 hover:border-sdhq-cyan-500/40' : 'border-sdhq-green-500/20 hover:border-sdhq-green-500/40'}`
          : `bg-gradient-to-br ${isCyan ? 'from-sdhq-cyan-50 to-white border-sdhq-cyan-200 hover:border-sdhq-cyan-400' : 'from-sdhq-green-50 to-white border-sdhq-green-200 hover:border-sdhq-green-400'}`
      }`}
    >
      <h4
        className={`font-semibold mb-3 flex items-center ${
          isCyan
            ? darkMode
              ? 'text-sdhq-cyan-400'
              : 'text-sdhq-cyan-600'
            : darkMode
              ? 'text-sdhq-green-400'
              : 'text-sdhq-green-600'
        }`}
      >
        {icon}
        {title}
      </h4>
      <p className={`${textClasses} text-base leading-relaxed`}>{body}</p>
    </div>
  )
}
