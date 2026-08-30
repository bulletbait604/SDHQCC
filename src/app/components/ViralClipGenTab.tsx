'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clapperboard,
  Download,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import {
  VIRAL_CLIP_DURATIONS,
  VIRAL_CLIP_MAX_IMAGE_BYTES,
  VIRAL_CLIP_MAX_PROMPT_CHARS,
  VIRAL_CLIP_MAX_REFERENCE_IMAGES,
  isAllowedViralClipImageType,
  type ViralClipDuration,
} from '@/lib/viralClipGen/config'
import { VIDEO_GENERATION_COSTS, viralClipGenCoinCost } from '@/lib/viralClipGen/costs'
import type { ViralClipJob, ViralClipJobStatus } from '@/lib/viralClipGen/history'

type RefSlot = {
  id: string
  file: File
  dataUrl: string
  mimeType: string
}

type GenerateResponse = {
  job: ViralClipJob
  remainingCoins: number
  unlimited: boolean
  error?: string
  userMessage?: string
}

type HistoryResponse = {
  jobs?: ViralClipJob[]
}

export interface ViralClipGenTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
  hasUnlimitedAccess: boolean
  coinBalance: number
  coinLoading: boolean
  refreshBalance: () => void
}

const STATUS_STEPS: ViralClipJobStatus[] = [
  'preparing',
  'generating',
  'rendering',
  'complete',
]

const STATUS_LABEL: Record<ViralClipJobStatus, string> = {
  preparing: 'Preparing',
  generating: 'Generating',
  rendering: 'Rendering',
  complete: 'Complete',
  failed: 'Failed',
}

function compressImage(dataUrl: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const maxSide = 1280
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not compress reference image'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ base64: canvas.toDataURL('image/jpeg', 0.82), mimeType: 'image/jpeg' })
    }
    img.onerror = () => reject(new Error('Could not read a reference image'))
    img.src = dataUrl
  })
}

export default function ViralClipGenTab({
  darkMode,
  subtitleClasses,
  description,
  hasUnlimitedAccess,
  coinBalance,
  coinLoading,
  refreshBalance,
}: ViralClipGenTabProps) {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<ViralClipDuration>(5)
  const [refs, setRefs] = useState<RefSlot[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [status, setStatus] = useState<ViralClipJobStatus | null>(null)
  const [error, setError] = useState('')
  const [job, setJob] = useState<ViralClipJob | null>(null)
  const [history, setHistory] = useState<ViralClipJob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cost = viralClipGenCoinCost(duration)
  const canAfford = hasUnlimitedAccess || coinBalance >= cost

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500'
  const chipIdle = darkMode
    ? 'border-sdhq-dark-600 bg-sdhq-dark-900 text-gray-200 hover:border-sdhq-cyan-500/50'
    : 'border-gray-300 bg-white text-gray-800 hover:border-sdhq-cyan-400'
  const chipActive = 'border-sdhq-cyan-500 bg-sdhq-cyan-500/15 text-sdhq-cyan-400'
  const sectionTitle = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  const card = darkMode
    ? 'bg-sdhq-dark-700/80 border-sdhq-dark-600'
    : 'bg-gray-50 border-gray-200'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/viral-clip-gen', { credentials: 'include' })
      const data = await parseJsonResponse<HistoryResponse>(res)
      if (res.ok && Array.isArray(data.jobs)) setHistory(data.jobs)
    } catch {
      /* history is optional */
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const addFiles = (fileList: FileList | File[] | null) => {
    if (!fileList) return
    setError('')
    const incoming = Array.from(fileList)
    const room = VIRAL_CLIP_MAX_REFERENCE_IMAGES - refs.length
    if (incoming.length > room) {
      setError(`You can attach up to ${VIRAL_CLIP_MAX_REFERENCE_IMAGES} images.`)
    }
    const accepted = incoming.slice(0, Math.max(0, room))
    for (const file of accepted) {
      if (!isAllowedViralClipImageType(file.type || '')) {
        setError('Reference files must be images (PNG, JPG, WebP, or GIF).')
        continue
      }
      if (file.size > VIRAL_CLIP_MAX_IMAGE_BYTES) {
        setError('Each reference image must be under 8MB.')
        continue
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') return
        setRefs((prev) => {
          if (prev.length >= VIRAL_CLIP_MAX_REFERENCE_IMAGES) {
            setError(`You can attach up to ${VIRAL_CLIP_MAX_REFERENCE_IMAGES} images.`)
            return prev
          }
          if (prev.some((r) => r.file.name === file.name && r.file.size === file.size)) return prev
          return [
            ...prev,
            {
              id: `${file.name}-${file.size}-${Date.now()}`,
              file,
              dataUrl: reader.result as string,
              mimeType: file.type || 'image/jpeg',
            },
          ]
        })
      }
      reader.readAsDataURL(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGenerate = async () => {
    const trimmed = prompt.trim()
    if (trimmed.length < 8) {
      setError('Describe the video you want (at least a short sentence).')
      return
    }
    if (!canAfford) {
      setError(`Not enough coins. A ${duration}s clip costs ${cost}.`)
      return
    }

    setIsWorking(true)
    setError('')
    setJob(null)
    setStatus('preparing')

    try {
      const compressed = await Promise.all(refs.map((r) => compressImage(r.dataUrl)))
      setStatus('generating')
      const res = await fetch('/api/viral-clip-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: trimmed,
          duration,
          references: compressed.map((c) => ({
            base64: c.base64,
            mimeType: c.mimeType,
          })),
        }),
      })
      const data = await parseJsonResponse<GenerateResponse>(res)
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Generation failed')
      }
      setStatus(data.job?.status || 'complete')
      setJob(data.job)
      refreshBalance()
      void loadHistory()
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : 'Generation failed')
      refreshBalance()
    } finally {
      setIsWorking(false)
    }
  }

  const canGenerate = prompt.trim().length >= 8 && !isWorking && !coinLoading && canAfford

  const activeStep = useMemo(() => {
    if (!status || status === 'failed') return -1
    return STATUS_STEPS.indexOf(status)
  }, [status])

  return (
    <div className="space-y-6">
      <p className={`text-sm ${subtitleClasses}`}>{description}</p>

      <section className="space-y-2">
        <label className={`block text-sm font-semibold ${sectionTitle}`}>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value.slice(0, VIRAL_CLIP_MAX_PROMPT_CHARS))
            setError('')
          }}
          required
          rows={6}
          maxLength={VIRAL_CLIP_MAX_PROMPT_CHARS}
          placeholder="Describe the video you want — who is in it, what happens, the setting, camera, and mood. Example: a creator reacting in a neon kitchen as steam hits the camera, punchy 9:16 energy."
          className={`w-full rounded-xl border px-3 py-3 text-sm outline-none resize-y min-h-[8rem] ${inputShell}`}
        />
        <p className={`text-xs ${subtitleClasses}`}>
          {prompt.length}/{VIRAL_CLIP_MAX_PROMPT_CHARS}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Reference images</h4>
          <span className={`text-xs font-medium ${subtitleClasses}`}>
            {refs.length}/{VIRAL_CLIP_MAX_REFERENCE_IMAGES}
          </span>
        </div>
        <div
          className={`border-2 border-dashed rounded-xl p-4 ${
            refs.length ? 'border-cyan-500' : darkMode ? 'border-gray-600' : 'border-gray-300'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addFiles(e.dataTransfer.files)
          }}
        >
          <div className="flex flex-wrap gap-3 mb-3">
            {refs.map((r) => (
              <div
                key={r.id}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-cyan-500/40"
              >
                <img src={r.dataUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setRefs((prev) => prev.filter((x) => x.id !== r.id))}
                  className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white"
                  aria-label="Remove reference"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {refs.length < VIRAL_CLIP_MAX_REFERENCE_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-24 h-24 rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 text-xs ${
                  darkMode ? 'border-gray-600 text-gray-400' : 'border-gray-300 text-gray-500'
                }`}
              >
                <Upload className="w-4 h-4" />
                Add
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <p className={`text-xs ${subtitleClasses}`}>
            Optional · PNG, JPG, or WebP · max 8MB each · all images go into the plan
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Video length</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {VIRAL_CLIP_DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDuration(d)
                setError('')
              }}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                duration === d ? chipActive : chipIdle
              }`}
            >
              {d}s
              <span className={`block text-[11px] font-normal ${subtitleClasses}`}>
                {VIDEO_GENERATION_COSTS[d]} coins
              </span>
            </button>
          ))}
        </div>
        <p className={`text-xs ${subtitleClasses}`}>
          Vertical 9:16 for TikTok, Shorts, and Reels.
          {hasUnlimitedAccess ? ' Unlimited credits on this account.' : ` Your balance: ${coinBalance}.`}
        </p>
      </section>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
        >
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {STATUS_LABEL[status || 'generating']}…
            </>
          ) : (
            <>
              <Clapperboard className="w-4 h-4 mr-2" />
              Generate video
              {!hasUnlimitedAccess && ` · ${cost} coins`}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isWorking}
          onClick={() => {
            setPrompt('')
            setRefs([])
            setJob(null)
            setError('')
            setStatus(null)
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {(isWorking || status) && (
        <ol className={`rounded-xl border p-4 space-y-2 ${card}`}>
          {STATUS_STEPS.map((step, i) => {
            const failed = status === 'failed'
            const done = !failed && activeStep >= i
            const current = !failed && activeStep === i && isWorking
            return (
              <li key={step} className="flex items-center gap-2 text-sm">
                {current ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sdhq-cyan-400" />
                ) : (
                  <span
                    className={`h-2 w-4 rounded-full ${
                      done ? 'bg-sdhq-cyan-500' : darkMode ? 'bg-sdhq-dark-500' : 'bg-gray-300'
                    }`}
                  />
                )}
                <span className={done || current ? textMain : subtitleClasses}>
                  {STATUS_LABEL[step]}
                </span>
              </li>
            )
          })}
          {status === 'failed' && (
            <li className="text-sm text-red-400">{STATUS_LABEL.failed}</li>
          )}
        </ol>
      )}

      {job?.status === 'complete' && job.videoUrl && (
        <section className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Your clip</h4>
          <video
            src={job.videoUrl}
            controls
            playsInline
            className="w-full max-h-[70vh] rounded-lg bg-black"
          />
          {job.generatedPrompt && (
            <p className={`text-xs ${subtitleClasses}`}>{job.generatedPrompt}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={`${job.videoUrl}${job.videoUrl.includes('?') ? '&' : '?'}download=1`}
              download={`viral-clip-${job.duration}s.mp4`}
            >
              <Button type="button" variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
            </a>
            <Button type="button" variant="outline" size="sm" onClick={handleGenerate} disabled={isWorking}>
              Generate again
            </Button>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Recent clips</h4>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className={`rounded-xl border p-3 ${card}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-sm ${textMain}`}>
                    {h.duration}s · {STATUS_LABEL[h.status] || h.status}
                  </span>
                  <span className={`text-xs ${subtitleClasses}`}>
                    {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}
                  </span>
                </div>
                <p className={`text-xs mt-1 line-clamp-2 ${subtitleClasses}`}>{h.originalPrompt}</p>
                {h.status === 'complete' && h.videoUrl && (
                  <a
                    href={h.videoUrl}
                    className={`text-xs mt-1 inline-block ${sectionTitle} hover:underline`}
                  >
                    Open clip
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
