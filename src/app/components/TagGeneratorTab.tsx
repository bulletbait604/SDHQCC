'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Hash, Sparkles, Loader2, Copy } from 'lucide-react'
import type { ActivityLogEntry, KickUser, Platform } from '@/lib/home/types'
import { platformsBannerLogos } from '@/lib/home/defaultPlatforms'
import { postActivityLog } from '@/lib/home/activityLogUtils'

export interface TagGeneratorTabProps {
  darkMode: boolean
  subtitleClasses: string
  platforms: Platform[]
  user: KickUser | null
  hasEnoughCoins: (tool: 'tag-generator') => boolean
  hasUnlimitedAccess: boolean
  coinLoading: boolean
  refreshBalance: () => void
  onActivityLog?: (entry: ActivityLogEntry) => void
}

export default function TagGeneratorTab({
  darkMode,
  subtitleClasses,
  platforms,
  user,
  hasEnoughCoins,
  hasUnlimitedAccess,
  coinLoading,
  refreshBalance,
  onActivityLog,
}: TagGeneratorTabProps) {
  const [tagPlatform, setTagPlatform] = useState('tiktok')
  const [tagDescription, setTagDescription] = useState('')
  const [tagCount, setTagCount] = useState(10)
  const [generatedTags, setGeneratedTags] = useState<Record<string, string[]>>({})
  const [isGeneratingTags, setIsGeneratingTags] = useState(false)

  const bannerLogos = platformsBannerLogos(platforms)

  const handleGenerate = async () => {
    if (!tagDescription.trim()) {
      alert('Please enter a description of your content')
      return
    }
    if (!hasEnoughCoins('tag-generator')) {
      alert(
        'Not enough coins to generate tags. Please purchase more coins or upgrade for unlimited access.'
      )
      return
    }

    setIsGeneratingTags(true)
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: tagDescription,
          platform: tagPlatform,
          count: tagCount,
          userId: user?.username,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.details || errorData.error || `API error: ${response.status}`
        throw new Error(errorMsg)
      }

      const data = await response.json()
      setGeneratedTags((prev) => ({ ...prev, [tagPlatform]: data.tags }))
      refreshBalance()

      if (user) {
        const detailLine = `Generated ${data.tags.length} tags for ${platforms.find((p) => p.id === tagPlatform)?.name}`
        const estUsd =
          typeof data.estimatedCostUsd === 'number' && Number.isFinite(data.estimatedCostUsd)
            ? data.estimatedCostUsd
            : undefined
        const costNote =
          typeof data.estimatedCostNote === 'string' ? data.estimatedCostNote : undefined
        const tagEntry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'tag_generation',
          details: detailLine,
          ...(estUsd !== undefined ? { estimatedCostUsd: estUsd } : {}),
          ...(costNote !== undefined ? { estimatedCostNote: costNote } : {}),
        }
        onActivityLog?.(tagEntry)
        void postActivityLog({
          username: user.username,
          action: 'tag_generation',
          details: detailLine,
          ...(estUsd !== undefined ? { estimatedCostUsd: estUsd } : {}),
          ...(costNote !== undefined ? { estimatedCostNote: costNote } : {}),
        })
      }
    } catch (error) {
      console.error('Error generating tags:', error)
      alert((error as Error).message || 'Failed to generate tags. Please try again.')
    } finally {
      setIsGeneratingTags(false)
    }
  }

  return (
    <div className="p-0 sm:p-2">
      <div className="flex justify-center gap-4 mb-2">
        {bannerLogos.map((platform) => (
          <img
            key={platform.id}
            src={platform.image}
            alt={platform.name}
            className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
          />
        ))}
      </div>

      <div className="flex flex-col items-center mb-6 text-center">
        <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
          Powered By: Gemini 2.5 Flash
        </p>
        <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
          Select a platform, describe your content, and generate optimized tags based on
          platform-specific algorithm insights.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'}`}
        >
          <div className="mb-4">
            <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Content Details
            </h4>
          </div>

          <div className="mb-4">
            <label
              className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Select Platform
            </label>
            <select
              value={tagPlatform}
              onChange={(e) => setTagPlatform(e.target.value)}
              className={`w-full px-3 py-2 rounded-md border ${
                darkMode
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label
              className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Video/Clip Description
            </label>
            <textarea
              value={tagDescription}
              onChange={(e) => setTagDescription(e.target.value)}
              placeholder="Describe your video or clip content... (e.g., 'Epic Fortnite victory royale with insane build battles')"
              rows={4}
              className={`w-full px-3 py-2 rounded-md border resize-none ${
                darkMode
                  ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          <div className="mb-4">
            <label
              className={`block text-base font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
            >
              Number of Tags: {tagCount}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={tagCount}
              onChange={(e) => setTagCount(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-sdhq-cyan-500 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm mt-1 text-gray-500">
              <span>5</span>
              <span>30</span>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              isGeneratingTags ||
              coinLoading ||
              !tagDescription.trim() ||
              (!hasUnlimitedAccess && !hasEnoughCoins('tag-generator'))
            }
            className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black"
          >
            {isGeneratingTags ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Tags...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {hasUnlimitedAccess ? 'Generate Tags' : 'Generate Tags (1 coin)'}
              </>
            )}
          </Button>
        </div>

        <div
          className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-green-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'}`}
        >
          <h4 className={`font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Generated Tags for {platforms.find((p) => p.id === tagPlatform)?.name}
          </h4>

          {generatedTags[tagPlatform]?.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {generatedTags[tagPlatform].map((tag, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-full text-base font-medium ${
                      darkMode
                        ? 'bg-sdhq-cyan-500/20 text-sdhq-cyan-400 border border-sdhq-cyan-500/30'
                        : 'bg-sdhq-cyan-100 text-sdhq-cyan-700 border border-sdhq-cyan-200'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tagsText = generatedTags[tagPlatform].map((t) => `#${t}`).join(' ')
                  navigator.clipboard.writeText(tagsText)
                  alert('Tags copied to clipboard!')
                }}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All Tags
              </Button>
            </>
          ) : (
            <div className="text-center py-8">
              <Hash className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className={subtitleClasses}>
                No tags generated yet. Enter a description and click Generate Tags.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
