'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Wand2, X, Download, Loader2, ImageIcon, RotateCcw, Film } from 'lucide-react'
import { useCoins } from '@/hooks/useCoins'

interface Platform {
  id: string
  name: string
  image: string
}

interface ThumbnailResult {
  mimeType: string
  prompt: string
  key: string
  description?: string
  videoAnalysisUsed?: boolean
}

import {
  THUMBNAIL_CLIP_MAX_BYTES,
  THUMBNAIL_CLIP_SUBSCRIBER_UPSELL,
  thumbnailClipDurationExceededMessage,
  thumbnailClipMaxDurationSeconds,
} from '@/lib/thumbnailClipLimits'

const CLIP_MAX_BYTES = THUMBNAIL_CLIP_MAX_BYTES
const VALID_CLIP_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']

function thumbnailImageSrc(key: string): string {
  return `/api/image?key=${encodeURIComponent(key)}`
}

interface Props {
  userId?: string
  userType?: string
  darkMode?: boolean
  platforms: Platform[]
  user?: { username: string } | null
  onLogActivity?: (entry: {
    action: string
    details: string
    estimatedCostUsd?: number
    estimatedCostNote?: string
  }) => void
  /** Sync parent header coin display (ThumbnailGenerator uses its own useCoins for deduct) */
  onBalanceRefresh?: () => void
  isDisabled?: boolean // When tab access is restricted
}

export default function ThumbnailGenerator({ 
  userId, 
  userType, 
  darkMode = true, 
  platforms, 
  user, 
  onLogActivity,
  onBalanceRefresh,
  isDisabled = false,
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>('image/jpeg')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ThumbnailResult | null>(null)
  const [history, setHistory] = useState<ThumbnailResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clipInputRef = useRef<HTMLInputElement>(null)

  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [clipR2Key, setClipR2Key] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState('')
  
  const [selectedPlatform, setSelectedPlatform] = useState('youtube-shorts')

  // Coin system for free users
  const { 
    balance, 
    deductCoins, 
    hasEnoughCoins, 
    hasUnlimitedAccess,
    loading: coinLoading 
  } = useCoins({ 
    userId: userId || '', 
    userRole: userType 
  })
  
  const COIN_COST = 2 // Thumbnail generator costs 2 coins
  
  const clipMaxDurationSec = thumbnailClipMaxDurationSeconds(hasUnlimitedAccess)
  const clipMaxMinutes = Math.round(clipMaxDurationSec / 60)
  
  // Available platforms for thumbnails
  const availablePlatforms = [
    { id: 'youtube-shorts', name: 'YouTube Shorts', icon: '🔴' },
    { id: 'youtube-long', name: 'YouTube Horizontal', icon: '🔴' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'facebook-reels', name: 'Facebook Reels', icon: '📘' },
    { id: 'twitter', name: 'Twitter/X', icon: '🐦' },
  ]
  
  // Theme classes matching other tabs
  const cardClasses = darkMode
    ? 'bg-sdhq-dark-800/90 border border-sdhq-dark-700 rounded-xl shadow-lg'
    : 'bg-white/80 backdrop-blur-sm border border-sdhq-cyan-200 rounded-xl shadow-lg'
  
  const textClasses = darkMode
    ? 'text-gray-300'
    : 'text-gray-600'
  
  const subtitleClasses = darkMode
    ? 'text-gray-400'
    : 'text-gray-500'
  
  const card = darkMode
    ? 'bg-sdhq-dark-700 border border-sdhq-dark-600'
    : 'bg-gray-100 border border-gray-200'
  
  const inputClasses = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500 focus:ring-sdhq-cyan-500/20'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500 focus:ring-sdhq-cyan-500/20'
  
  const subtle = darkMode ? 'text-gray-400' : 'text-gray-500'
  const accentText = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  
  const isComponentDisabled = isDisabled

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleFileChange = (file: File) => {
    setImageFile(file)
    setImageMime(file.type)
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImageBase64(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  const readClipDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
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
  }

  const handleClipChange = async (file: File) => {
    if (!VALID_CLIP_TYPES.includes(file.type)) {
      setError('Please upload MP4, WebM, MOV, AVI, or MKV.')
      return
    }
    if (file.size > CLIP_MAX_BYTES) {
      setError('Clip must be under 2 GB. Compress long VODs before uploading.')
      return
    }
    const duration = await readClipDuration(file)
    if (duration != null && duration > clipMaxDurationSec) {
      setError(thumbnailClipDurationExceededMessage(hasUnlimitedAccess))
      return
    }
    setClipFile(file)
    setClipDurationSeconds(duration)
    setClipR2Key(null)
    setError('')
  }

  const clearClip = () => {
    setClipFile(null)
    setClipDurationSeconds(null)
    setClipR2Key(null)
    if (clipInputRef.current) clipInputRef.current.value = ''
  }

  const uploadClipToR2 = async (file: File): Promise<string> => {
    const presignRes = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        purpose: 'thumbnail-generator',
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
    if (!putRes.ok) throw new Error('Failed to upload clip to storage')
    return fileKey
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  /** `sourceKey` = re-edit from a prior R2 thumbnail (avoids huge base64 payloads). */
  const generate = async (
    base64Override?: string,
    mimeOverride?: string,
    sourceKey?: string
  ) => {
    const hasPrompt = prompt.trim().length > 0
    const hasClip = !!clipFile
    const hasImage = !!(base64Override ?? imageBase64) || !!sourceKey

    if (!hasPrompt && !hasClip) {
      setError('Add a reference clip, a text prompt, or both.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('thumbnail-generator')) {
      setError('Insufficient coins. Thumbnail generation costs 2 coins for free users.')
      return
    }

    setIsGenerating(true)
    setError('')
    setLoadingStep('')

    try {
      let uploadedClipKey = clipR2Key
      if (clipFile && !uploadedClipKey) {
        setLoadingStep('Uploading reference clip…')
        uploadedClipKey = await uploadClipToR2(clipFile)
        setClipR2Key(uploadedClipKey)
      }

      if (clipFile) {
        setLoadingStep('Gemini analyzing clip + platform algorithm…')
      } else {
        setLoadingStep('Generating viral thumbnail…')
      }

      const platformName =
        availablePlatforms.find((p) => p.id === selectedPlatform)?.name ?? 'your platform'
      const enhancedPrompt = hasPrompt
        ? `Create a thumbnail optimized for ${platformName}. ${prompt}`
        : `Create a viral thumbnail optimized for ${platformName} from the analyzed reference clip.`

      const body: Record<string, unknown> = {
        prompt: enhancedPrompt,
        mimeType: mimeOverride ?? imageMime,
        sessionId: userId || 'anon',
        platforms: [selectedPlatform],
      }
      if (sourceKey) {
        body.sourceImageKey = sourceKey
      } else {
        const b64 = base64Override ?? imageBase64
        if (b64) body.imageBase64 = b64
      }
      if (uploadedClipKey && clipFile) {
        body.referenceClipR2Key = uploadedClipKey
        body.referenceClipMimeType = clipFile.type
        if (clipDurationSeconds != null) {
          body.referenceClipDurationSeconds = Math.round(clipDurationSeconds)
        }
      }

      setLoadingStep('Painting thumbnail…')
      const result = await fetch('/api/thumbnail-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }).then((r) => r.json())

      if (result.error) {
        throw new Error(result.error)
      }

      const newResult: ThumbnailResult = {
        mimeType: result.mimeType || 'image/png',
        prompt: prompt || 'From reference clip',
        key: result.key,
        description: result.description,
        videoAnalysisUsed: result.videoAnalysisUsed,
      }

      setHistory((prev) => {
        const withoutDup = prev.filter((p) => p.key !== newResult.key)
        return [newResult, ...withoutDup].slice(0, 3)
      })
      setResult(newResult)
      setClipR2Key(null)
      clearClip()

      onBalanceRefresh?.()

      if (user && onLogActivity) {
        const est =
          typeof result.estimatedCostUsd === 'number' && Number.isFinite(result.estimatedCostUsd)
            ? result.estimatedCostUsd
            : undefined
        const note =
          typeof result.estimatedCostNote === 'string' ? result.estimatedCostNote : undefined
        onLogActivity({
          action: 'thumbnail_generation',
          details: result.videoAnalysisUsed
            ? `[Gemini 2.5] Clip-analyzed thumbnail for ${platformName}`
            : `[Gemini 2.5] Generated thumbnail: ${(prompt || 'clip').substring(0, 50)}`,
          ...(est !== undefined ? { estimatedCostUsd: est } : {}),
          ...(note !== undefined ? { estimatedCostNote: note } : {}),
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setIsGenerating(false)
      setLoadingStep('')
    }
  }

  // Re-edit: use current result as input image (load from R2 by key — faster API response)
  const reEdit = () => {
    if (!result) return
    generate(undefined, undefined, result.key)
  }

  // Restore a history item
  const restoreHistory = (item: ThumbnailResult, index: number) => {
    if (result) setHistory(prev => [result, ...prev.filter((_, i) => i !== index)].slice(0, 3))
    setResult(item)
  }

  // Download
  const download = async (key: string, mime: string) => {
    const res = await fetch(thumbnailImageSrc(key), { credentials: 'include' })
    if (!res.ok) return
    const blob = await res.blob()
    const ext = mime.split('/')[1]?.split(';')[0] || 'png'
    const link = document.createElement('a')
    const objUrl = URL.createObjectURL(blob)
    link.href = objUrl
    link.download = `thumbnail-${Date.now()}.${ext}`
    link.click()
    URL.revokeObjectURL(objUrl)
  }

  /** Preview container matches selected platform aspect */
  const previewAspectClass = (() => {
    const id = selectedPlatform
    if (id === 'instagram') return 'aspect-[4/5] w-full max-w-[220px] mx-auto'
    if (['youtube-shorts', 'tiktok', 'facebook-reels'].includes(id))
      return 'aspect-[9/16] w-full max-w-[220px] mx-auto'
    return 'aspect-video w-full max-w-[300px] mx-auto'
  })()

  const canGenerate =
    (prompt.trim().length > 0 || clipFile != null) &&
    (hasUnlimitedAccess || hasEnoughCoins('thumbnail-generator'))

  return (
    <div className={`relative py-8 ${cardClasses} ${isComponentDisabled ? 'pointer-events-none' : ''}`}>
      {/* Disabled Overlay (tab permission only — limits are coin-based) */}
      {isComponentDisabled && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 rounded-xl flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <p className="text-white text-xl font-bold mb-2">⛔ Access Restricted</p>
            <p className="text-gray-300 text-sm">
              This feature is currently disabled for your account.
            </p>
          </div>
        </div>
      )}
      
      {/* Platform Logos (omit youtube-long — same artwork as Shorts in banner strip) */}
      <div className="flex justify-center gap-4 mb-6">
        {platforms.filter((p) => p.id !== 'youtube-long').map((platform) => (
          <Image
            key={platform.id}
            src={platform.image}
            alt={platform.name}
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
          />
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center space-x-4 mb-3">
          <ImageIcon className="w-10 h-10 text-sdhq-cyan-500" />
          <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Thumbnail Generator</h3>
        </div>
        <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
          Powered By: Gemini 2.5 Flash
        </p>
        <p className={`${textClasses} text-base`}>
          Upload a clip — Gemini 2.5 analyzes it against your platform algorithm, then paints a viral thumbnail
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Controls ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Reference uploads — image + clip side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file?.type.startsWith('image/')) handleFileChange(file)
                }}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-xl p-3 transition-colors min-h-[140px] flex flex-col ${card} ${imageFile ? 'border-cyan-500' : 'border-gray-600 hover:border-gray-500'}`}
              >
                <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Reference image
                </p>
                {imageBase64 ? (
                  <div className="space-y-2 flex-1">
                    <div className="relative">
                      <Image
                        src={`data:${imageMime};base64,${imageBase64}`}
                        alt="Uploaded"
                        width={200}
                        height={120}
                        unoptimized
                        className="w-full max-h-24 object-contain rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className={`text-xs truncate ${subtle}`}>{imageFile?.name}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 w-full flex flex-col items-center justify-center gap-1 py-2"
                  >
                    <ImageIcon className={`w-7 h-7 ${subtle}`} />
                    <p className={`text-xs text-center ${subtle}`}>Drop image or click</p>
                    <p className={`text-[10px] ${subtle}`}>Optional · PNG, JPG, WEBP</p>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileChange(f)
                  }}
                />
              </div>

              <div
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file?.type.startsWith('video/')) void handleClipChange(file)
                }}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-xl p-3 transition-colors min-h-[140px] flex flex-col ${card} ${clipFile ? 'border-cyan-500' : 'border-gray-600 hover:border-gray-500'}`}
              >
                <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Reference clip
                </p>
                {clipFile ? (
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start gap-2">
                      <Film className="w-8 h-8 text-cyan-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {clipFile.name}
                        </p>
                        <p className={`text-[10px] ${subtle}`}>
                          {(clipFile.size / (1024 * 1024)).toFixed(1)} MB
                          {clipDurationSeconds != null
                            ? ` · ${Math.floor(clipDurationSeconds / 60)}m ${Math.round(clipDurationSeconds % 60)}s`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearClip}
                        className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className={`text-[10px] ${subtle}`}>
                      Gemini watches clip + platform algorithm → viral thumbnail
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => clipInputRef.current?.click()}
                    className="flex-1 w-full flex flex-col items-center justify-center gap-1 py-2"
                  >
                    <Film className={`w-7 h-7 ${subtle}`} />
                    <p className={`text-xs text-center ${subtle}`}>Drop clip or click</p>
                    <p className={`text-[10px] text-center ${subtle}`}>
                      Up to {clipMaxMinutes} min · 2 GB max
                    </p>
                  </button>
                )}
                <input
                  ref={clipInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleClipChange(f)
                  }}
                />
              </div>
            </div>

            {!hasUnlimitedAccess && (
              <p className={`text-xs ${subtle} -mt-1`}>{THUMBNAIL_CLIP_SUBSCRIBER_UPSELL}</p>
            )}

            {/* Prompt (optional when clip uploaded) */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                clipFile
                  ? "Optional: override style, text, or mood (e.g. 'more shock value, red outline text')"
                  : imageBase64
                    ? "Describe how to use your image…"
                    : "Or describe the thumbnail you want…"
              }
              rows={4}
              className={`w-full border rounded-xl px-4 py-3 text-base resize-none outline-none transition-all backdrop-blur-sm ${inputClasses}`}
            />

            {/* Platform */}
            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-gray-200'}`}>
              <label
                htmlFor="thumbnail-platform"
                className={`text-sm font-semibold mb-2 block ${darkMode ? 'text-white' : 'text-gray-800'}`}
              >
                📱 Target platform
              </label>
              <select
                id="thumbnail-platform"
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className={`w-full rounded-xl px-4 py-3 text-base outline-none transition-all backdrop-blur-sm ${inputClasses}`}
              >
                {availablePlatforms.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.icon} {platform.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate button with coin cost */}
            {!hasUnlimitedAccess && (
              <div className="text-xs text-gray-500 mb-2">
                {hasEnoughCoins('thumbnail-generator') 
                  ? `🪙 ${balance} coins available (costs ${COIN_COST} coins)`
                  : `⚠️ Need ${COIN_COST} coins (you have ${balance})`}
              </div>
            )}
            <button
              onClick={() => generate()}
              disabled={isGenerating || !canGenerate}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{loadingStep || 'Generating…'}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>
                    {clipFile
                      ? 'Analyze clip & generate (2 coins)'
                      : imageBase64
                        ? 'Generate with image (2 coins)'
                        : 'Generate thumbnail (2 coins)'}
                  </span>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-700 rounded-xl text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* ── Right: Output ───────────────────────────────────────────────── */}
          <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'} space-y-4`}>
            {isGenerating ? (
              <div className={`flex flex-col items-center justify-center h-64 rounded-xl border ${card}`}>
                <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-3" />
                <p className={`text-sm ${subtle}`}>
                  {loadingStep || 'Generating thumbnail…'}
                </p>
                <p className={`text-xs mt-1 ${subtle}`}>
                  This may take up to 1 minute depending on site traffic. Please wait. DO NOT refresh until finished.
                </p>
              </div>
            ) : result ? (
              <div className="space-y-3">
                <div className={`relative rounded-xl overflow-hidden border-2 border-cyan-500 ${previewAspectClass}`}>
                  <Image
                    src={thumbnailImageSrc(result.key)}
                    alt="Generated thumbnail"
                    width={800}
                    height={450}
                    unoptimized
                    className="h-full w-full object-contain bg-black/20"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => download(result.key, result.mimeType)}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={reEdit}
                      disabled={isGenerating}
                      className="p-2 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-40"
                      title="Re-edit this result"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setResult(null); setPrompt('') }}
                      className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Start over"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Re-edit controls */}
                <div className="flex gap-2">
                  <input
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Change the prompt and re-edit..."
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition-all backdrop-blur-sm ${inputClasses}`}
                  />
                  <button
                    onClick={reEdit}
                    disabled={isGenerating || (!prompt.trim() && !clipFile)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Re-edit
                  </button>
                </div>

              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed ${card}`}>
                <Wand2 className={`w-10 h-10 mb-3 ${subtle}`} />
                <p className={`text-sm ${subtle}`}>Your thumbnail will appear here</p>
              </div>
            )}

            {/* History - Last 3 Generated */}
            {history.length > 0 && (
              <div className={`p-3 rounded-xl border ${card}`}>
                <p className={`text-xs font-medium mb-2 ${subtle}`}>Recent Thumbnails (Click to Restore)</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => restoreHistory(item, i)}
                      className="flex-shrink-0 group relative"
                      title={item.prompt}
                    >
                      <Image
                        src={thumbnailImageSrc(item.key)}
                        alt={`v${history.length - i}`}
                        width={80}
                        height={48}
                        unoptimized
                        className="w-20 h-12 object-contain bg-black/20 rounded-lg border-2 border-transparent group-hover:border-cyan-500 transition-all"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity flex items-center justify-center">
                        <RotateCcw className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
