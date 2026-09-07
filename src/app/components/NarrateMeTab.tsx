'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseJsonResponse } from '@/lib/http/parseJsonResponse'
import { TOOL_COIN_COSTS } from '@/lib/coins/toolCosts'
import type { NarrateMeJob, NarrateMeStage, NarrationSegment } from '@/lib/narrateMe/types'

export interface NarrateMeTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
  hasUnlimitedAccess: boolean
  coinBalance: number
  coinLoading: boolean
  refreshBalance: () => void
}

type JobResponse = {
  job?: NarrateMeJob
  uploadUrl?: string
  fileKey?: string
  error?: string
  userMessage?: string
  elapsedSeconds?: number
  estimateRemainingSeconds?: number
}

const NARRATE_ME_COIN_COST = TOOL_COIN_COSTS['narrate-me']

type DownloadResponse = {
  packageUrl?: string
  wavUrl?: string
  srtUrl?: string
  vttUrl?: string
  error?: string
}

const PIPELINE: Array<{ stage: NarrateMeStage; label: string }> = [
  { stage: 'upload', label: 'Video Upload' },
  { stage: 'analyzing', label: 'Analyzing Video' },
  { stage: 'understanding', label: 'Understanding Events' },
  { stage: 'timeline', label: 'Building Timeline' },
  { stage: 'writing', label: 'Writing Narration' },
  { stage: 'awaiting_approval', label: 'Waiting for Script Approval' },
  { stage: 'generating_voice', label: 'Generating Voice' },
  { stage: 'building_audio', label: 'Building Audio' },
  { stage: 'generating_captions', label: 'Generating Captions' },
  { stage: 'packaging', label: 'Packaging' },
  { stage: 'ready', label: 'READY' },
]

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function confidenceTone(confidence: number): string {
  if (confidence >= 0.85) return 'text-emerald-400'
  if (confidence >= 0.6) return 'text-amber-400'
  return 'text-red-400'
}

export default function NarrateMeTab({
  darkMode,
  subtitleClasses,
  description,
  hasUnlimitedAccess,
  coinBalance,
  coinLoading,
  refreshBalance,
}: NarrateMeTabProps) {
  const [prompt, setPrompt] = useState('Explain exactly what happens in this video.')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [job, setJob] = useState<NarrateMeJob | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [eta, setEta] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [packageUrl, setPackageUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-400'
  const card = darkMode ? 'bg-sdhq-dark-700/80 border-sdhq-dark-600' : 'bg-gray-50 border-gray-200'
  const sectionTitle = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'
  const canAfford = hasUnlimitedAccess || coinBalance >= NARRATE_ME_COIN_COST

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const applyJob = useCallback((next: NarrateMeJob) => {
    setJob(next)
    const map: Record<string, string> = {}
    for (const seg of next.script.segments) map[seg.id] = seg.text
    setDrafts(map)
  }, [])

  const pollJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/narrate-me/jobs/${encodeURIComponent(jobId)}`, {
      credentials: 'include',
    })
    const data = await parseJsonResponse<JobResponse>(res)
    if (!res.ok || !data.job) throw new Error(data.userMessage || data.error || 'Could not load job')
    applyJob(data.job)
    setElapsed(data.elapsedSeconds || 0)
    setEta(data.estimateRemainingSeconds ?? null)
    const shouldTick =
      data.job.status === 'analyzing' ||
      data.job.status === 'generating_voice' ||
      data.job.status === 'processing_audio' ||
      (data.job.status === 'awaiting_script_approval' && data.job.script.status === 'running')
    if (shouldTick) {
      await fetch('/api/narrate-me/tick', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch(() => undefined)
    }
    return data.job
  }, [applyJob])

  useEffect(() => {
    if (
      !job ||
      !(
        job.status === 'analyzing' ||
        job.status === 'generating_voice' ||
        job.status === 'processing_audio' ||
        (job.status === 'awaiting_script_approval' && job.script.status === 'running')
      )
    ) {
      return
    }
    const id = window.setInterval(() => {
      void pollJob(job.jobId).catch((err) => {
        setError(err instanceof Error ? err.message : 'Status update failed')
      })
    }, 4000)
    return () => window.clearInterval(id)
  }, [job?.jobId, job?.status, job?.script.status, pollJob])

  useEffect(() => {
    if (job?.status !== 'ready' || !job.export.packageKey) {
      setPackageUrl('')
      return
    }
    void (async () => {
      const res = await fetch(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/download`, {
        credentials: 'include',
      })
      const data = await parseJsonResponse<DownloadResponse>(res)
      if (res.ok && data.packageUrl) setPackageUrl(data.packageUrl)
    })()
  }, [job?.status, job?.jobId, job?.export.packageKey])

  const pickFile = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(next ? URL.createObjectURL(next) : '')
    setDurationSeconds(0)
    setError('')
  }

  const callJob = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    })
    const data = await parseJsonResponse<JobResponse>(res)
    if (!res.ok || !data.job) {
      throw new Error(data.userMessage || data.error || 'Request failed')
    }
    applyJob(data.job)
    return data.job
  }

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      setError('Choose a video first.')
      return
    }
    if (prompt.trim().length < 8) {
      setError('Enter a prompt that says what to focus on.')
      return
    }
    const duration = durationSeconds || videoRef.current?.duration || 0
    if (!duration) {
      setError('Wait for the video duration to load, then analyze.')
      return
    }
    if (!canAfford) {
      setError(`Not enough coins. Narrate Me costs ${NARRATE_ME_COIN_COST}.`)
      return
    }
    setBusy('upload')
    setError('')
    setPackageUrl('')
    try {
      const createdRes = await fetch('/api/narrate-me/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          filename: file.name,
          contentType: file.type || 'video/mp4',
          durationSeconds: duration,
        }),
      })
      const createdData = await parseJsonResponse<JobResponse>(createdRes)
      if (!createdRes.ok || !createdData.job || !createdData.uploadUrl) {
        throw new Error(createdData.userMessage || createdData.error || 'Could not start upload')
      }
      applyJob(createdData.job)
      const put = await fetch(createdData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file,
      })
      if (!put.ok) throw new Error('Direct upload to storage failed. Try again.')
      await fetch('/api/narrate-me/upload', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: createdData.job.jobId, durationSeconds: duration }),
      })
      setBusy('analyze')
      await callJob(`/api/narrate-me/jobs/${encodeURIComponent(createdData.job.jobId)}/analyze`, {
        method: 'POST',
      })
      refreshBalance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy('')
    }
  }

  const saveSegment = async (segment: NarrationSegment) => {
    if (!job) return
    const text = (drafts[segment.id] ?? segment.text).trim()
    if (text === segment.text) return
    setBusy(`save-${segment.id}`)
    setError('')
    try {
      await callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/script`, {
        method: 'PATCH',
        body: JSON.stringify({ segments: [{ id: segment.id, text }] }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save line')
    } finally {
      setBusy('')
    }
  }

  const moveSegment = async (index: number, dir: -1 | 1) => {
    if (!job) return
    const next = index + dir
    if (next < 0 || next >= job.script.segments.length) return
    const order = job.script.segments.map((s) => s.id)
    const [row] = order.splice(index, 1)
    order.splice(next, 0, row!)
    setBusy('reorder')
    try {
      await callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/script`, {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder')
    } finally {
      setBusy('')
    }
  }

  const stageIndex = useMemo(() => {
    const stage = job?.currentStage || 'upload'
    const idx = PIPELINE.findIndex((s) => s.stage === stage)
    return idx < 0 ? 0 : idx
  }, [job?.currentStage])

  const analyzing = job?.status === 'analyzing' || busy === 'analyze' || busy === 'upload'
  const waitingScript = job?.status === 'awaiting_script_approval' && job.script.status === 'complete'

  return (
    <div className="space-y-6">
      <p className={`text-sm ${subtitleClasses}`}>{description}</p>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Upload Video</h4>
        <div
          className={`border-2 border-dashed rounded-xl p-4 ${
            file ? 'border-cyan-500' : darkMode ? 'border-gray-600' : 'border-gray-300'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pickFile(e.dataTransfer.files?.[0] || null)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/x-msvideo"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
          {previewUrl ? (
            <video
              ref={videoRef}
              src={previewUrl}
              controls
              className="w-full max-h-72 rounded-lg bg-black mb-3"
              onLoadedMetadata={(e) => setDurationSeconds(e.currentTarget.duration || 0)}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-10 text-sm ${subtitleClasses}`}
            >
              <Upload className="w-6 h-6 mx-auto mb-2" />
              Drop a video or click to upload · up to 2 hours
            </button>
          )}
          {file && (
            <p className={`text-xs ${subtitleClasses}`}>
              {file.name} · {durationSeconds ? formatClock(durationSeconds) : 'reading duration…'}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <label className={`block text-sm font-semibold ${sectionTitle}`}>Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
          rows={4}
          className={`w-full rounded-xl border px-3 py-3 text-sm outline-none resize-y ${inputShell}`}
          placeholder="Explain the Pal Researching Lab in Palworld."
        />
        <p className={`text-xs ${subtitleClasses}`}>
          The video is the source of truth. This prompt only tells the AI what to focus on.
        </p>
      </section>

      <section className={`rounded-xl border p-4 ${card}`}>
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Voice</h4>
        <p className={`text-sm mt-1 ${textMain}`}>Existing cloned voice</p>
        <p className={`text-xs mt-1 ${subtitleClasses}`}>
          Uses the server-configured ElevenLabs voice. The voice ID is never sent to the browser.
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
          disabled={!!busy || coinLoading || !file}
          onClick={() => void handleUploadAndAnalyze()}
          className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
        >
          {busy === 'upload' || busy === 'analyze' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mic className="w-4 h-4 mr-2" />
          )}
          Analyze Video
          {!hasUnlimitedAccess && ` · ${NARRATE_ME_COIN_COST} coins`}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!!busy}
          onClick={() => {
            pickFile(null)
            setJob(null)
            setError('')
            setPackageUrl('')
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        {job?.status === 'failed' && (
          <Button
            type="button"
            variant="outline"
            disabled={!!busy}
            onClick={() => {
              setBusy('retry')
              void callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}`, { method: 'POST' })
                .catch((err) => setError(err instanceof Error ? err.message : 'Retry failed'))
                .finally(() => setBusy(''))
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
      </div>

      {job && (
        <section className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className={`text-sm font-semibold ${sectionTitle}`}>Progress</h4>
            <span className={`text-xs ${subtitleClasses}`}>
              {job.progress}% · {formatClock(elapsed)}
              {eta ? ` · ~${formatClock(eta)} left` : ''}
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-sdhq-dark-500' : 'bg-gray-200'}`}>
            <div
              className="h-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 transition-all"
              style={{ width: `${Math.min(100, job.progress)}%` }}
            />
          </div>
          <p className={`text-sm ${textMain}`}>{job.progressLabel}</p>
          <ol className="grid gap-1">
            {PIPELINE.map((step, i) => {
              const current = i === stageIndex && job.status !== 'failed'
              const done = i < stageIndex && job.status !== 'failed'
              return (
                <li key={step.stage} className="flex items-center gap-2 text-sm">
                  {current ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sdhq-cyan-400" />
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        done ? 'bg-sdhq-cyan-500' : darkMode ? 'bg-sdhq-dark-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                  <span className={done || current ? textMain : subtitleClasses}>{step.label}</span>
                </li>
              )
            })}
          </ol>
          <p className={`text-xs ${subtitleClasses}`}>
            You can leave this tab. Analysis continues in the cloud.
          </p>
        </section>
      )}

      {job && job.timeline.length > 0 && (
        <section className="space-y-2">
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Video Timeline</h4>
          <ul className="space-y-2">
            {job.timeline.map((event) => (
              <li key={event.id} className={`rounded-xl border p-3 ${card}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={`text-sm font-medium ${textMain}`}>
                    {formatClock(event.startTime)} — {event.event}
                  </span>
                  <span className={`text-xs ${confidenceTone(event.confidence)}`}>
                    {Math.round(event.confidence * 100)}% evidence
                  </span>
                </div>
                {event.evidence.length > 0 && (
                  <p className={`text-xs mt-1 ${subtitleClasses}`}>{event.evidence.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {waitingScript && (
        <section className="space-y-3">
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Generated Narration</h4>
          <p className={`text-xs ${subtitleClasses}`}>
            Edit a line and it saves. Regenerating one segment does not redo the others.
          </p>
          {job.script.segments.map((segment, index) => (
            <article key={segment.id} className={`rounded-xl border p-3 space-y-2 ${card}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-xs font-medium ${sectionTitle}`}>
                  {formatClock(segment.sourceStart)} → {formatClock(segment.sourceEnd)}
                </span>
                <span className={`text-xs ${confidenceTone(segment.confidence)}`}>
                  {Math.round(segment.confidence * 100)}%
                </span>
              </div>
              {segment.evidence.length > 0 && (
                <p className={`text-xs ${subtitleClasses}`}>{segment.evidence.join(' · ')}</p>
              )}
              <textarea
                value={drafts[segment.id] ?? segment.text}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [segment.id]: e.target.value.slice(0, 800) }))
                }
                onBlur={() => void saveSegment(segment)}
                rows={3}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${inputShell}`}
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => void moveSegment(index, -1)}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => void moveSegment(index, 1)}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => {
                    setBusy(`regen-${segment.id}`)
                    void callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/script`, {
                      method: 'POST',
                      body: JSON.stringify({ regenerateSegmentId: segment.id }),
                    })
                      .catch((err) => setError(err instanceof Error ? err.message : 'Regenerate failed'))
                      .finally(() => setBusy(''))
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => {
                    setBusy(`del-${segment.id}`)
                    void callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/script`, {
                      method: 'PATCH',
                      body: JSON.stringify({ deleteIds: [segment.id] }),
                    })
                      .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'))
                      .finally(() => setBusy(''))
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </article>
          ))}
          <Button
            type="button"
            disabled={!!busy || job.script.segments.length === 0}
            onClick={() => {
              setBusy('voice')
              void callJob(`/api/narrate-me/jobs/${encodeURIComponent(job.jobId)}/voice`, {
                method: 'POST',
              })
                .catch((err) => setError(err instanceof Error ? err.message : 'Voice failed'))
                .finally(() => setBusy(''))
            }}
            className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
          >
            {busy === 'voice' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mic className="w-4 h-4 mr-2" />
            )}
            Generate Voice
          </Button>
        </section>
      )}

      {job?.status === 'ready' && (
        <section className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <h4 className={`text-sm font-semibold ${sectionTitle}`}>Result</h4>
          <p className={`text-sm ${textMain}`}>Narration: Ready</p>
          <p className={`text-sm ${textMain}`}>Captions: Ready</p>
          <p className={`text-xs ${subtitleClasses}`}>
            Original video is not included. Import your footage, then drop the WAV at 00:00.
          </p>
          {packageUrl && (
            <a href={packageUrl}>
              <Button type="button" className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black">
                <Download className="w-4 h-4 mr-2" />
                Download CapCut Package
              </Button>
            </a>
          )}
        </section>
      )}

      {analyzing && !job?.timeline.length && (
        <p className={`text-xs ${subtitleClasses}`}>
          Long videos are analyzed in timed chunks. Keep this page closed if you want — the job stays on the server.
        </p>
      )}
    </div>
  )
}
