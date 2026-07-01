'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Film, Loader2, Check } from 'lucide-react'
import type { ActivityLogEntry, KickUser, Platform } from '@/lib/home/types'
import { platformsBannerLogos } from '@/lib/home/defaultPlatforms'
import { postActivityLog } from '@/lib/home/activityLogUtils'
import {
  POST4ME_CLIP_MAX_BYTES,
  POST4ME_CLIP_MAX_DURATION_SECONDS,
  post4meClipDurationExceededMessage,
} from '@/lib/post4meLimits'
import type { Post4MePlatformOutput } from '@/lib/post4meFormat'
import Post4MePlatformResults from '@/app/components/Post4MePlatformResults'

const VALID_CLIP_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]

type Post4MeResponse = {
  platforms: string[]
  results: Post4MePlatformOutput[]
  estimatedCostUsd?: number
  estimatedCostNote?: string
}

export interface Post4MeTabProps {
  darkMode: boolean
  subtitleClasses: string
  platforms: Platform[]
  user: KickUser | null
  hasEnoughCoins: (tool: 'post4me') => boolean
  hasUnlimitedAccess: boolean
  coinLoading: boolean
  refreshBalance: () => void
  onActivityLog?: (entry: ActivityLogEntry) => void
  isDisabled?: boolean
  title: string
  description: string
}

export default function Post4MeTab({
  darkMode,
  subtitleClasses,
  platforms,
  user,
  hasEnoughCoins,
  hasUnlimitedAccess,
  coinLoading,
  refreshBalance,
  onActivityLog,
  isDisabled = false,
  title,
  description,
}: Post4MeTabProps) {
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(['tiktok'])
  const [prompt, setPrompt] = useState('')
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Post4MeResponse | null>(null)

  const bannerLogos = platformsBannerLogos(platforms)
  const platformImages = useMemo(
    () => Object.fromEntries(platforms.map((p) => [p.id, p.image])),
    [platforms]
  )

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((p) => p !== id)
      }
      return [...prev, id]
    })
    setResult(null)
  }

  const readClipDuration = (file: File): Promise<number | null> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(video.duration) ? video.duration : null)
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      video.src = url
    })

  const handleClipChange = async (file: File) => {
    if (!VALID_CLIP_TYPES.includes(file.type)) {
      setError('Please upload MP4, WebM, MOV, AVI, or MKV.')
      return
    }
    if (file.size > POST4ME_CLIP_MAX_BYTES) {
      setError('Clip file is too large.')
      return
    }
    const duration = await readClipDuration(file)
    if (duration != null && duration > POST4ME_CLIP_MAX_DURATION_SECONDS) {
      setError(post4meClipDurationExceededMessage())
      return
    }
    setClipFile(file)
    setClipDurationSeconds(duration)
    setError('')
    setResult(null)
  }

  const uploadClipToR2 = async (file: File): Promise<string> => {
    const presignRes = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        purpose: 'post4me',
      }),
    })
    if (!presignRes.ok) {
      const errBody = await presignRes.json().catch(() => ({}))
      throw new Error((errBody as { error?: string }).error || 'Could not get upload URL')
    }
    const { uploadUrl, fileKey } = (await presignRes.json()) as {
      uploadUrl: string
      fileKey: string
    }
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!putRes.ok) throw new Error('Failed to upload clip')
    return fileKey
  }

  const handleGenerate = async () => {
    if (selectedPlatformIds.length === 0) {
      setError('Select at least one platform.')
      return
    }
    if (!clipFile) {
      setError('Upload a clip up to 90 seconds.')
      return
    }
    if (!user) {
      setError('Login required.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('post4me')) {
      setError('Post4Me costs 2 coins. Purchase coins or subscribe for unlimited access.')
      return
    }

    setIsGenerating(true)
    setError('')
    setResult(null)

    try {
      const r2FileKey = await uploadClipToR2(clipFile)
      const res = await fetch('/api/post4me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          r2FileKey,
          mimeType: clipFile.type,
          fileName: clipFile.name,
          fileSize: clipFile.size,
          durationSeconds:
            clipDurationSeconds != null ? Math.round(clipDurationSeconds) : undefined,
          platforms: selectedPlatformIds,
          prompt: prompt.trim(),
        }),
      })
      const data = (await res.json()) as Post4MeResponse & {
        error?: string
        userMessage?: string
      }
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Post4Me failed')
      }
      setResult(data)
      refreshBalance()

      if (user && onActivityLog) {
        const platformNames = data.results
          .map((r) => r.platformName)
          .join(', ')
        const entry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'post4me_generation',
          details: `Post4Me copy for ${platformNames}`,
          ...(typeof data.estimatedCostUsd === 'number'
            ? { estimatedCostUsd: data.estimatedCostUsd }
            : {}),
          ...(typeof data.estimatedCostNote === 'string'
            ? { estimatedCostNote: data.estimatedCostNote }
            : {}),
        }
        onActivityLog(entry)
        void postActivityLog({
          username: user.username,
          action: 'post4me_generation',
          details: entry.details,
          ...(entry.estimatedCostUsd !== undefined
            ? { estimatedCostUsd: entry.estimatedCostUsd }
            : {}),
          ...(entry.estimatedCostNote !== undefined
            ? { estimatedCostNote: entry.estimatedCostNote }
            : {}),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post4Me failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const card = darkMode
    ? 'bg-sdhq-dark-700 border border-sdhq-dark-600'
    : 'bg-gray-100 border border-gray-200'
  const inputClasses = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500'

  return (
    <div className={`relative p-0 sm:p-2 ${isDisabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex justify-center gap-4 mb-4">
        {bannerLogos.map((platform) => (
          <img
            key={platform.id}
            src={platform.image}
            alt={platform.name}
            className="w-10 h-10 rounded-lg object-cover opacity-80"
          />
        ))}
      </div>

      <div className="flex flex-col items-center mb-6 text-center">
        <div className="flex items-center gap-2 mb-2">
          <Send className="w-8 h-8 text-sdhq-cyan-500" />
          <h4 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h4>
        </div>
        <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-1`}>
          Powered By: Gemini 2.5 Flash · 2 coins (free for members)
        </p>
        <p className={`text-sm max-w-xl ${subtitleClasses}`}>{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <div className={`p-6 rounded-xl border-2 space-y-4 ${card}`}>
          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
            >
              Target platforms (select one or more)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {platforms.map((p) => {
                const selected = selectedPlatformIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      selected
                        ? darkMode
                          ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/15'
                          : 'border-sdhq-cyan-600 bg-sdhq-cyan-50'
                        : darkMode
                          ? 'border-sdhq-dark-600 bg-sdhq-dark-900 hover:border-sdhq-cyan-500/50'
                          : 'border-gray-300 bg-white hover:border-sdhq-cyan-400'
                    }`}
                  >
                    <img
                      src={p.image}
                      alt=""
                      className="w-8 h-8 rounded-md object-cover shrink-0"
                    />
                    <span
                      className={`text-sm font-medium flex-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}
                    >
                      {p.name}
                    </span>
                    {selected && <Check className="w-4 h-4 text-sdhq-cyan-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
            <p className={`text-xs mt-2 ${subtitleClasses}`}>
              TikTok, Instagram & Reels → one combined caption each. YouTube → separate title,
              description, and tags.
            </p>
          </div>

          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
            >
              Reference clip (max {POST4ME_CLIP_MAX_DURATION_SECONDS}s)
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 ${clipFile ? 'border-cyan-500' : 'border-gray-600'}`}
            >
              {clipFile ? (
                <div className="flex items-start gap-3">
                  <Film className="w-8 h-8 text-cyan-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {clipFile.name}
                    </p>
                    <p className={`text-xs ${subtitleClasses}`}>
                      {(clipFile.size / (1024 * 1024)).toFixed(1)} MB
                      {clipDurationSeconds != null
                        ? ` · ${Math.round(clipDurationSeconds)}s`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClipFile(null)
                      setClipDurationSeconds(null)
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer py-4">
                  <Film className={`w-8 h-8 mb-2 ${subtitleClasses}`} />
                  <span className={`text-sm ${subtitleClasses}`}>Click to upload clip</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleClipChange(f)
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
            >
              AI direction (optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              rows={4}
              placeholder="e.g. Focus on the clutch moment, gaming audience, hype tone…"
              className={`w-full px-4 py-3 rounded-xl border outline-none resize-none ${inputClasses}`}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            onClick={() => void handleGenerate()}
            disabled={
              isGenerating ||
              !clipFile ||
              selectedPlatformIds.length === 0 ||
              coinLoading ||
              (!hasUnlimitedAccess && !hasEnoughCoins('post4me'))
            }
            className="w-full bg-sdhq-cyan-500 hover:bg-sdhq-cyan-600 text-black font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating for {selectedPlatformIds.length} platform
                {selectedPlatformIds.length === 1 ? '' : 's'}…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Generate post copy (2 coins)
              </>
            )}
          </Button>
        </div>

        <div className={`p-6 rounded-xl border-2 min-h-[320px] ${card}`}>
          {!result?.results?.length ? (
            <div
              className={`flex flex-col items-center justify-center h-full text-center py-12 ${subtitleClasses}`}
            >
              <Send className="w-12 h-12 mb-3 opacity-40" />
              <p>Upload a clip, select platforms, and generate copy for each one.</p>
              <p className="text-xs mt-2 max-w-sm">
                Results appear in separate cards per platform — formatted for how each site expects
                metadata.
              </p>
            </div>
          ) : (
            <Post4MePlatformResults
              results={result.results}
              darkMode={darkMode}
              subtitleClasses={subtitleClasses}
              platformImages={platformImages}
            />
          )}
        </div>
      </div>
    </div>
  )
}
