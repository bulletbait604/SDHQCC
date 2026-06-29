'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Film, Loader2, Copy } from 'lucide-react'
import type { ActivityLogEntry, KickUser, Platform } from '@/lib/home/types'
import { platformsBannerLogos } from '@/lib/home/defaultPlatforms'
import { postActivityLog } from '@/lib/home/activityLogUtils'
import {
  formatYouTubeTagsForCopy,
  isYouTubeClipPlatform,
  stripHashtagsFromDescription,
} from '@/lib/clipAnalyzerMetadata'
import {
  POST4ME_CLIP_MAX_BYTES,
  POST4ME_CLIP_MAX_DURATION_SECONDS,
  post4meClipDurationExceededMessage,
} from '@/lib/post4meLimits'

const VALID_CLIP_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]

type Post4MeResponse = {
  platform: string
  isYouTube: boolean
  title?: string
  titles?: string[]
  description: string
  tags: string[]
  combinedCaption?: string
  youtubeTagsCopy?: string
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
  const [platformId, setPlatformId] = useState('tiktok')
  const [prompt, setPrompt] = useState('')
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Post4MeResponse | null>(null)
  const [copiedTitle, setCopiedTitle] = useState<number | null>(null)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTags, setCopiedTags] = useState(false)
  const [copiedCaption, setCopiedCaption] = useState(false)

  const bannerLogos = platformsBannerLogos(platforms)
  const isYouTube = result ? result.isYouTube : isYouTubeClipPlatform(platformId)
  const youtubeTagsCopy =
    result?.youtubeTagsCopy ?? (result?.tags ? formatYouTubeTagsForCopy(result.tags) : '')
  const youtubeDescription = result?.description
    ? stripHashtagsFromDescription(result.description.replace(/<[^>]*>/g, ''))
    : ''

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
          platform: platformId,
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
        const platformName = platforms.find((p) => p.id === platformId)?.name ?? platformId
        const entry: ActivityLogEntry = {
          id: Date.now().toString(),
          username: user.username,
          timestamp: new Date().toISOString(),
          action: 'post4me_generation',
          details: `Post4Me copy for ${platformName}`,
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
              Target platform
            </label>
            <select
              value={platformId}
              onChange={(e) => {
                setPlatformId(e.target.value)
                setResult(null)
              }}
              disabled={isGenerating}
              className={`w-full px-4 py-3 rounded-xl border outline-none ${inputClasses}`}
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
              coinLoading ||
              (!hasUnlimitedAccess && !hasEnoughCoins('post4me'))
            }
            className="w-full bg-sdhq-cyan-500 hover:bg-sdhq-cyan-600 text-black font-semibold"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating post copy…
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
          {!result ? (
            <div
              className={`flex flex-col items-center justify-center h-full text-center py-12 ${subtitleClasses}`}
            >
              <Send className="w-12 h-12 mb-3 opacity-40" />
              <p>Upload a clip and generate platform-ready title, description, and tags.</p>
              <p className="text-xs mt-2">
                TikTok & Instagram → one combined caption. YouTube → separate fields.
              </p>
            </div>
          ) : isYouTube ? (
            <div className="space-y-4">
              <p
                className={`text-xs font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
              >
                YouTube — separate fields
              </p>
              {(result.titles?.length ? result.titles : result.title ? [result.title] : []).map(
                (t, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg flex items-start justify-between gap-2 ${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'}`}
                  >
                    <span
                      className={`text-sm flex-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
                    >
                      {idx + 1}. {t}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(t)
                        setCopiedTitle(idx)
                        setTimeout(() => setCopiedTitle(null), 2000)
                      }}
                      className="text-xs text-sdhq-cyan-400 shrink-0"
                    >
                      {copiedTitle === idx ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )
              )}
              {youtubeDescription && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'}`}>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-sdhq-cyan-400">Description</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(youtubeDescription)
                        setCopiedDescription(true)
                        setTimeout(() => setCopiedDescription(false), 2000)
                      }}
                      className="text-xs text-sdhq-cyan-400"
                    >
                      {copiedDescription ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    {youtubeDescription}
                  </p>
                </div>
              )}
              {result.tags.length > 0 && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'}`}>
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-sdhq-cyan-400">
                      Tags (comma-separated, no #)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(youtubeTagsCopy)
                        setCopiedTags(true)
                        setTimeout(() => setCopiedTags(false), 2000)
                      }}
                      className="text-xs text-sdhq-cyan-400"
                    >
                      {copiedTags ? 'Copied!' : 'Copy all'}
                    </button>
                  </div>
                  <p
                    className={`text-xs font-mono break-all ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {youtubeTagsCopy}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p
                className={`text-xs font-semibold uppercase ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
              >
                Combined caption (description + hashtags)
              </p>
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-sdhq-dark-800' : 'bg-white'}`}>
                <p
                  className={`text-sm whitespace-pre-wrap mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {result.combinedCaption || result.description}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(result.combinedCaption || result.description)
                    setCopiedCaption(true)
                    setTimeout(() => setCopiedCaption(false), 2000)
                  }}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copiedCaption ? 'Copied!' : 'Copy full caption'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
