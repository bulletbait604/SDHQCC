'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Film, Loader2, Download, RotateCcw, ImageIcon } from 'lucide-react'
import type { KickUser, Platform } from '@/lib/home/types'
import { platformsBannerLogos } from '@/lib/home/defaultPlatforms'
import {
  formatThumbnail2ClipLimitLabel,
  thumbnail2ClipDurationExceededMessage,
  thumbnail2ClipMaxBytes,
  thumbnail2ClipMaxDurationSeconds,
} from '@/lib/thumbnail2Limits'
import { parseBestMomentTimestamp } from '@/lib/thumbnailClipFrame'
import { extractVideoFrameAsJpeg } from '@/lib/thumbnailClipFrameClient'
import { COIN_COSTS } from '@/hooks/useCoins'

const VALID_CLIP_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]

type Analysis = {
  bestMomentTimestamp: string
  subjectDescription?: string
  onImageText?: string[]
  viralThumbnailBrief?: string
}

export interface Thumbnail2TabProps {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  platforms: Platform[]
  user: KickUser | null
  hasUnlimitedAccess: boolean
  hasEnoughCoins: (tool: 'thumbnail-2') => boolean
  refreshBalance: () => void
  onLogActivity?: (entry: {
    details: string
    estimatedCostUsd?: number
    estimatedCostNote?: string
  }) => void
}

export default function Thumbnail2Tab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  platforms,
  user,
  hasUnlimitedAccess,
  hasEnoughCoins,
  refreshBalance,
  onLogActivity,
}: Thumbnail2TabProps) {
  const [platformId, setPlatformId] = useState('youtube-shorts')
  const [prompt, setPrompt] = useState('')
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [resultKey, setResultKey] = useState<string | null>(null)
  const [resultMeta, setResultMeta] = useState<{
    videoModel?: string
    imageModel?: string
  } | null>(null)

  const bannerLogos = platformsBannerLogos(platforms)
  const coinCost = COIN_COSTS['thumbnail-2']
  const limitLabel = formatThumbnail2ClipLimitLabel(hasUnlimitedAccess)

  const platformOptions = useMemo(
    () =>
      platforms.filter((p) =>
        ['youtube-shorts', 'youtube-long', 'tiktok', 'instagram', 'facebook-reels'].includes(p.id)
      ),
    [platforms]
  )

  const readDuration = (file: File): Promise<number | null> =>
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
    const maxBytes = thumbnail2ClipMaxBytes(hasUnlimitedAccess)
    if (file.size > maxBytes) {
      setError(`Clip is too large (max ${hasUnlimitedAccess ? '2 GB' : '1 GB'}).`)
      return
    }
    const duration = await readDuration(file)
    const maxDur = thumbnail2ClipMaxDurationSeconds(hasUnlimitedAccess)
    if (duration != null && duration > maxDur) {
      setError(thumbnail2ClipDurationExceededMessage(hasUnlimitedAccess))
      return
    }
    setClipFile(file)
    setClipDurationSeconds(duration)
    setError('')
    setResultKey(null)
    setResultMeta(null)
  }

  const uploadClip = async (file: File): Promise<string> => {
    const presignRes = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        purpose: 'thumbnail-2',
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
    if (!user) {
      setError('Login required.')
      return
    }
    if (!clipFile) {
      setError('Upload a clip first.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('thumbnail-2')) {
      setError(`Thumbnail 2.0 costs ${coinCost} coins.`)
      return
    }

    setIsWorking(true)
    setError('')
    setResultKey(null)
    setResultMeta(null)

    try {
      setLoadingStep('Uploading clip (deleted after analysis)…')
      const r2FileKey = await uploadClip(clipFile)

      setLoadingStep('Flash-Lite analyzing clip + platform…')
      const analyzeRes = await fetch('/api/thumbnail-2/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          r2FileKey,
          mimeType: clipFile.type,
          durationSeconds:
            clipDurationSeconds != null ? Math.round(clipDurationSeconds) : undefined,
          platformId,
        }),
      })
      const analyzeData = (await analyzeRes.json()) as {
        analysis?: Analysis
        platformId?: string
        videoModel?: string
        error?: string
      }
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || 'Clip analysis failed')
      }
      if (!analyzeData.analysis?.bestMomentTimestamp) {
        throw new Error('No peak moment returned from analysis')
      }

      setLoadingStep('Capturing best frame from your local clip…')
      const seekSec = parseBestMomentTimestamp(
        analyzeData.analysis.bestMomentTimestamp,
        clipDurationSeconds ?? undefined
      )
      const frame = await extractVideoFrameAsJpeg(clipFile, seekSec)

      setLoadingStep('Flash Image painting viral text + stickers…')
      const genRes = await fetch('/api/thumbnail-2/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platformId: analyzeData.platformId || platformId,
          analysis: analyzeData.analysis,
          imageBase64: frame.base64,
          mimeType: frame.mimeType,
          prompt: prompt.trim(),
          durationSeconds:
            clipDurationSeconds != null ? Math.round(clipDurationSeconds) : undefined,
        }),
      })
      const genData = (await genRes.json()) as {
        key?: string
        videoModel?: string
        imageModel?: string
        estimatedCostUsd?: number
        estimatedCostNote?: string
        error?: string
      }
      if (!genRes.ok || !genData.key) {
        throw new Error(genData.error || 'Thumbnail paint failed')
      }

      setResultKey(genData.key)
      setResultMeta({
        videoModel: analyzeData.videoModel || genData.videoModel,
        imageModel: genData.imageModel,
      })
      refreshBalance()

      onLogActivity?.({
        details: `Thumbnail 2.0 for ${platformId} @ ${analyzeData.analysis.bestMomentTimestamp}`,
        estimatedCostUsd: genData.estimatedCostUsd,
        estimatedCostNote: genData.estimatedCostNote,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thumbnail 2.0 failed')
    } finally {
      setIsWorking(false)
      setLoadingStep('')
    }
  }

  const reset = () => {
    setClipFile(null)
    setClipDurationSeconds(null)
    setPrompt('')
    setError('')
    setResultKey(null)
    setResultMeta(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-2 opacity-80">
        {bannerLogos.map((logo) => (
          <img
            key={logo.id}
            src={logo.image}
            alt={logo.name}
            className="w-8 h-8 rounded object-cover"
          />
        ))}
      </div>

      <p className={`text-sm text-center ${subtitleClasses}`}>
        Upload a long clip → AI finds the viral moment → paints bold text/stickers on that frame.
        Owner-only R&amp;D tool. {limitLabel}.{' '}
        {hasUnlimitedAccess ? 'Unlimited access.' : `${coinCost} coins per run.`}
      </p>

      <div className={`rounded-xl border p-4 space-y-4 ${cardClasses}`}>
        <div>
          <label className={`text-sm font-medium mb-2 block ${textClasses}`}>Platform</label>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatformId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  platformId === p.id
                    ? 'border-sdhq-cyan-500 bg-sdhq-cyan-500/20 text-sdhq-cyan-300'
                    : darkMode
                      ? 'border-sdhq-dark-600 text-gray-300'
                      : 'border-gray-300 text-gray-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`text-sm font-medium mb-2 block ${textClasses}`}>
            Clip ({limitLabel})
          </label>
          <label
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer ${
              darkMode ? 'border-sdhq-dark-600 hover:border-sdhq-cyan-500/50' : 'border-gray-300'
            }`}
          >
            <Film className="w-8 h-8 text-sdhq-cyan-500" />
            <span className={`text-sm ${subtitleClasses}`}>
              {clipFile
                ? `${clipFile.name}${
                    clipDurationSeconds != null
                      ? ` · ${Math.round(clipDurationSeconds / 60)} min`
                      : ''
                  }`
                : 'Drop or choose a clip (max 60 minutes)'}
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleClipChange(f)
              }}
            />
          </label>
        </div>

        <div>
          <label className={`text-sm font-medium mb-2 block ${textClasses}`}>
            Optional direction
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="e.g. emphasize the rage face, add red outline, gaming vibe"
            className={`w-full rounded-lg border px-3 py-2 text-sm ${
              darkMode
                ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-white'
                : 'bg-white border-gray-300'
            }`}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {isWorking && (
          <p className={`text-sm flex items-center gap-2 ${subtitleClasses}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingStep || 'Working…'}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleGenerate()}
            disabled={isWorking || !clipFile}
            className="bg-sdhq-cyan-600 hover:bg-sdhq-cyan-500"
          >
            {isWorking ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 mr-2" />
                Make viral thumbnail
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={isWorking}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {resultKey && (
        <div className={`rounded-xl border p-4 space-y-3 ${cardClasses}`}>
          <h4 className={`font-semibold ${textClasses}`}>Result</h4>
          {resultMeta?.videoModel && (
            <p className={`text-xs ${subtitleClasses}`}>
              Video: {resultMeta.videoModel}
              {resultMeta.imageModel ? ` · Paint: ${resultMeta.imageModel}` : ''}
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/image?key=${encodeURIComponent(resultKey)}`}
            alt="Thumbnail 2.0 result"
            className="w-full max-w-lg mx-auto rounded-lg border border-sdhq-cyan-500/30"
          />
          <a
            href={`/api/image?key=${encodeURIComponent(resultKey)}&download=1`}
            className="inline-flex items-center text-sm text-sdhq-cyan-400 hover:underline"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </a>
        </div>
      )}
    </div>
  )
}
