'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Film,
  Loader2,
  Scissors,
  Sparkles,
  Upload,
  CheckCircle2,
} from 'lucide-react'
import type { ToolType } from '@/hooks/useCoins'
import PlatformSelector from '@/app/components/PlatformSelector'
import type { TargetPlatform } from '@/lib/platformEditing'
import { normalizeHttpMediaUrl } from '@/lib/normalizeMediaUrl'

export interface ClipEditorTabProps {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  title: string
  tagline: string
  user: { username: string } | null
  hasEnoughCoins: (tool: ToolType) => boolean
  deductCoins: (tool: ToolType) => Promise<boolean>
  hasUnlimitedAccess: boolean
  refreshBalance: () => void
}

const MAX_CLIP_SECONDS = 90
type ClipLayoutTemplate = 'auto' | 'fullFrame' | 'stackedFacecam' | 'pictureInPicture' | 'splitScreen' | 'focusCrop'

type UserPhase =
  | 'ready'
  | 'cut_running'
  | 'cut_ready'
  | 'finish_running'
  | 'complete'
  | 'failed'

type ViralityReview = {
  viralityScore?: number
  platformFitScore?: number
  summary?: string
  strengths?: string[]
  risks?: string[]
  recommendedAdjustments?: string[]
}

const CLIP_LAYOUT_OPTIONS: Array<{ value: ClipLayoutTemplate; label: string; help: string }> = [
  { value: 'auto', label: 'Auto layout', help: 'Detect gameplay, facecam, speaker, or action and choose the best vertical format.' },
  { value: 'stackedFacecam', label: 'Stacked facecam + gameplay', help: 'Reaction on top with gameplay below.' },
  { value: 'pictureInPicture', label: 'Gameplay with facecam PiP', help: 'Full gameplay with the creator pinned in the corner.' },
  { value: 'focusCrop', label: 'AI focus crop', help: 'Track the speaker or action in a vertical crop.' },
  { value: 'splitScreen', label: 'Split screen', help: 'Two equal vertical panels when facecam and content both matter.' },
  { value: 'fullFrame', label: 'Full frame', help: 'Letterbox or full-frame crop behavior.' },
]

const PHASE_COIN_TOOLS: Record<'cut' | 'finish', ToolType> = {
  cut: 'clip-editor-cut',
  finish: 'clip-editor-finish',
}

function ViralityCard({
  review,
  label,
  darkMode,
  subtitleClasses,
}: {
  review: ViralityReview | null | undefined
  label: string
  darkMode: boolean
  subtitleClasses: string
}) {
  if (!review?.summary) return null
  return (
    <div
      className={`rounded-xl border p-4 text-left text-sm space-y-2 ${
        darkMode ? 'bg-sdhq-dark-800/80 border-sdhq-cyan-500/25' : 'bg-white border-sdhq-cyan-200'
      }`}
    >
      <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        {label}
        {typeof review.viralityScore === 'number' && (
          <span className="ml-2 text-sdhq-cyan-500">{review.viralityScore}/100</span>
        )}
        {typeof review.platformFitScore === 'number' && (
          <span className={`ml-2 text-xs font-normal ${subtitleClasses}`}>
            platform fit {review.platformFitScore}/100
          </span>
        )}
      </p>
      <p className={subtitleClasses}>{review.summary}</p>
      {review.strengths && review.strengths.length > 0 && (
        <ul className={`list-disc pl-5 ${subtitleClasses}`}>
          {review.strengths.slice(0, 4).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {review.risks && review.risks.length > 0 && (
        <p className={`text-xs ${subtitleClasses}`}>
          <span className="font-semibold">Watch:</span> {review.risks.slice(0, 3).join(' · ')}
        </p>
      )}
    </div>
  )
}

export default function ClipEditorTab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  title,
  tagline,
  user,
  hasEnoughCoins,
  hasUnlimitedAccess,
  refreshBalance,
}: ClipEditorTabProps) {
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('tiktok')
  const [layoutTemplate, setLayoutTemplate] = useState<ClipLayoutTemplate>('auto')
  const [landscapeLetterbox, setLandscapeLetterbox] = useState(false)
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [r2FileKey, setR2FileKey] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [userPhase, setUserPhase] = useState<UserPhase>('ready')
  const [publishMetadata, setPublishMetadata] = useState<Record<string, unknown> | null>(null)
  const [viralityCut, setViralityCut] = useState<ViralityReview | null>(null)
  const [viralityEffects, setViralityEffects] = useState<ViralityReview | null>(null)
  const [viralityText, setViralityText] = useState<ViralityReview | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [cutPreviewUrl, setCutPreviewUrl] = useState<string | null>(null)
  const [finalClipUrl, setFinalClipUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [statusText, setStatusText] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [busy, setBusy] = useState<'upload' | 'cut' | 'finish' | null>(null)

  const setProgress = useCallback((value: number) => {
    setProgressPercent(Math.min(100, Math.max(0, Math.round(value))))
  }, [])

  const inspectVideoDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = url
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(v.duration) ? v.duration : 0)
      }
      v.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Could not read video metadata'))
      }
    })
  }, [])

  const resetWorkflow = () => {
    setJobId(null)
    setUserPhase('ready')
    setViralityCut(null)
    setViralityEffects(null)
    setViralityText(null)
    setCutPreviewUrl(null)
    setFinalClipUrl(null)
    setPublishMetadata(null)
    setProgressPercent(null)
    setStatusText('')
  }

  const onPickFile = async (f: File | null) => {
    setError('')
    setClipFile(null)
    setClipDurationSeconds(null)
    setR2FileKey(null)
    resetWorkflow()
    if (!f) return
    if (!f.type.startsWith('video/')) {
      setError('Choose a video file (MP4, WebM, MOV, …).')
      return
    }
    try {
      const dur = await inspectVideoDuration(f)
      if (dur > MAX_CLIP_SECONDS + 0.25) {
        setError(`Clip Editor accepts videos up to ${MAX_CLIP_SECONDS} seconds.`)
        return
      }
      setClipDurationSeconds(dur)
    } catch {
      setError('Could not read video duration.')
      return
    }
    setClipFile(f)
  }

  const handleUploadToR2 = async (manageBusy = true): Promise<string | null> => {
    if (!user) {
      setError('Log in with Kick first.')
      return null
    }
    if (!clipFile) {
      setError('Pick a clip file first.')
      return null
    }
    if (manageBusy) setBusy('upload')
    setProgress(8)
    setError('')
    setUploadStatus('')
    try {
      const presignRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: clipFile.name,
          contentType: clipFile.type,
          purpose: 'clip-editor',
        }),
      })
      const presignBody = await presignRes.json().catch(() => ({}))
      if (!presignRes.ok) {
        throw new Error((presignBody as { error?: string }).error || 'Could not request upload.')
      }
      const { uploadUrl, fileKey } = presignBody as { uploadUrl: string; fileKey: string }
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': clipFile.type },
        body: clipFile,
      })
      if (!putRes.ok) throw new Error('Upload failed. Try again.')
      setR2FileKey(fileKey)
      setUploadStatus('Uploaded to cloud storage.')
      setProgress(20)
      return fileKey
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
      return null
    } finally {
      if (manageBusy) setBusy(null)
      refreshBalance()
    }
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const applyJobPoll = (data: Record<string, unknown>) => {
    const progress = typeof data.progress === 'number' ? data.progress : 0
    setProgress(progress)
    const stateLabel = typeof data.stateLabel === 'string' ? data.stateLabel : 'Processing'
    setStatusText(stateLabel)
    const phase = typeof data.userPhase === 'string' ? (data.userPhase as UserPhase) : userPhase
    setUserPhase(phase)
    if (data.viralityCut && typeof data.viralityCut === 'object') {
      setViralityCut(data.viralityCut as ViralityReview)
    }
    if (data.viralityEffects && typeof data.viralityEffects === 'object') {
      setViralityEffects(data.viralityEffects as ViralityReview)
    }
    if (data.viralityText && typeof data.viralityText === 'object') {
      setViralityText(data.viralityText as ViralityReview)
    }
    const cutUrl = normalizeHttpMediaUrl(data.cutPreviewUrl)
    if (cutUrl) setCutPreviewUrl(cutUrl)
  }

  const pollClipEditorJob = async (id: string, untilPhase?: UserPhase): Promise<void> => {
    const maxAttempts = 300
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(3000)
      const res = await fetch(`/api/clip-editor/jobs/${encodeURIComponent(id)}`, {
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) || `Job status failed (${res.status})`
        )
      }
      applyJobPoll(data)

      if (data.state === 'FAILED') {
        setUserPhase('failed')
        throw new Error((typeof data.error === 'string' && data.error) || 'Clip editor job failed')
      }

      const phase = typeof data.userPhase === 'string' ? data.userPhase : ''
      if (untilPhase && phase === untilPhase) {
        return
      }

      if (data.state === 'COMPLETE') {
        const url = normalizeHttpMediaUrl(data.outputUrl)
        if (!url) throw new Error('Job completed but no output URL was returned')
        setFinalClipUrl(url)
        setUserPhase('complete')
        if (data.metadata && typeof data.metadata === 'object') {
          setPublishMetadata(data.metadata as Record<string, unknown>)
        }
        setStatusText('Done — your platform-ready clip is ready.')
        setProgress(100)
        return
      }
    }
    throw new Error('Job timed out — check back in a few minutes or retry with a shorter clip.')
  }

  const ensureJobCreated = async (): Promise<string> => {
    if (jobId) return jobId
    let key = r2FileKey
    if (!key) {
      setStatusText('Uploading clip…')
      key = await handleUploadToR2(false)
    }
    if (!key) throw new Error('Upload did not complete.')

    const jobRes = await fetch('/api/clip-editor/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        r2FileKey: key,
        platform: targetPlatform,
        layoutTemplate,
        landscapeMode: landscapeLetterbox ? 'letterbox' : 'crop',
        mimeType: clipFile!.type,
        fileName: clipFile!.name,
        ...(typeof clipDurationSeconds === 'number' && Number.isFinite(clipDurationSeconds)
          ? { sourceDurationSeconds: clipDurationSeconds }
          : {}),
      }),
    })
    const jobData = (await jobRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!jobRes.ok) {
      throw new Error(
        (typeof jobData.userMessage === 'string' && jobData.userMessage) ||
          (typeof jobData.error === 'string' && jobData.error) ||
          'Could not create clip editor job'
      )
    }
    const newJobId = typeof jobData.jobId === 'string' ? jobData.jobId : ''
    if (!newJobId) throw new Error('No job id returned')
    setJobId(newJobId)
    setUserPhase('ready')
    return newJobId
  }

  const runPhase = async (phase: 'cut' | 'finish') => {
    setError('')
    const coinTool = PHASE_COIN_TOOLS[phase]
    if (!hasUnlimitedAccess && !hasEnoughCoins(coinTool)) {
      setError(`Not enough coins for this step (needs ${coinTool}).`)
      return
    }

    setBusy(phase)
    try {
      setProgress(phase === 'cut' ? 5 : 55)
      const id = await ensureJobCreated()

      const phaseRes = await fetch(`/api/clip-editor/jobs/${encodeURIComponent(id)}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phase }),
      })
      const phaseData = (await phaseRes.json().catch(() => ({}))) as Record<string, unknown>
      if (!phaseRes.ok) {
        throw new Error(
          (typeof phaseData.userMessage === 'string' && phaseData.userMessage) ||
            (typeof phaseData.error === 'string' && phaseData.error) ||
            `Could not start ${phase} pass`
        )
      }

      const until: UserPhase = phase === 'cut' ? 'cut_ready' : 'complete'
      setUserPhase(phase === 'cut' ? 'cut_running' : 'finish_running')

      await pollClipEditorJob(id, until)
      refreshBalance()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${phase} pass failed`)
      setStatusText('')
    } finally {
      setBusy(null)
    }
  }

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-cyan-500/30 text-gray-200'
    : 'bg-white border-sdhq-cyan-300 text-gray-900'

  const showProgress =
    progressPercent !== null && (busy !== null || Boolean(statusText) || Boolean(finalClipUrl))

  const cutDone =
    userPhase === 'cut_ready' || userPhase === 'finish_running' || userPhase === 'complete'
  const canCut =
    Boolean(clipFile) && !cutDone && userPhase !== 'cut_running' && userPhase !== 'failed'
  const canFinish =
    cutDone && userPhase !== 'finish_running' && userPhase !== 'complete' && userPhase !== 'failed'

  return (
    <div className={`py-8 ${cardClasses}`}>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Film className="w-10 h-10 text-sdhq-cyan-500 shrink-0" />
          <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <p className={`max-w-xl ${textClasses} text-base`}>{tagline}</p>
        <p className={`max-w-lg text-sm mt-2 ${subtitleClasses}`}>
          Two passes for your platform — cut preview, then effects + captions in one final render.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-8">
        {!user && <p className={`text-center ${subtitleClasses}`}>Log in with Kick to use Clip Editor.</p>}

        {user && (
          <>
            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>Target platform</label>
              <PlatformSelector
                targetPlatform={targetPlatform}
                setTargetPlatform={setTargetPlatform}
                disabled={busy !== null || Boolean(jobId)}
              />
            </div>

            <div className="space-y-2 max-w-xl mx-auto text-left">
              <label className={`block text-sm font-semibold ${subtitleClasses}`} htmlFor="clip-editor-layout">
                Clip layout (horizontal → vertical)
              </label>
              <select
                id="clip-editor-layout"
                value={layoutTemplate}
                onChange={(e) => setLayoutTemplate(e.target.value as ClipLayoutTemplate)}
                disabled={busy !== null || Boolean(jobId)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${inputShell}`}
              >
                {CLIP_LAYOUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={`text-xs ${subtitleClasses}`}>
                {CLIP_LAYOUT_OPTIONS.find((o) => o.value === layoutTemplate)?.help}
              </p>
            </div>

            <div className="space-y-2 max-w-xl mx-auto">
              <label className={`flex items-start gap-3 cursor-pointer text-left ${subtitleClasses}`}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-sdhq-cyan-500 text-sdhq-cyan-600"
                  checked={landscapeLetterbox}
                  onChange={(e) => setLandscapeLetterbox(e.target.checked)}
                  disabled={busy !== null || Boolean(jobId)}
                />
                <span>
                  <span className={`block text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    Letterbox landscape (full wide frame)
                  </span>
                  <span className="block text-xs opacity-90 mt-0.5">
                    Off: center-crop to 9:16. On: full wide frame with black bars.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>
                Raw clip (≤ {MAX_CLIP_SECONDS}s)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || Boolean(jobId)}
                  className={`border-sdhq-cyan-500/60 ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-700'}`}
                  onClick={() =>
                    document.getElementById('clip-editor-file')?.dispatchEvent(new MouseEvent('click'))
                  }
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Pick file
                </Button>
                <input
                  id="clip-editor-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <span className={`text-xs ${subtitleClasses}`}>
                  {clipFile ? clipFile.name : 'No file selected'}
                </span>
              </div>
              {uploadStatus && <p className={`text-sm ${subtitleClasses}`}>{uploadStatus}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() => runPhase('cut')}
                disabled={busy !== null || !canCut}
                className="w-full bg-gradient-to-r from-sdhq-cyan-600 to-sdhq-green-500 text-black font-semibold"
              >
                {busy === 'cut' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                ) : cutDone ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 inline text-black/80" />
                ) : (
                  <Scissors className="w-4 h-4 mr-2 inline" />
                )}
                {hasUnlimitedAccess ? 'Cut it' : 'Cut it (1 coin)'}
              </Button>

              <Button
                type="button"
                onClick={() => runPhase('finish')}
                disabled={busy !== null || !canFinish}
                className={`w-full font-semibold ${
                  canFinish
                    ? 'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-amber-500 text-white'
                    : 'opacity-50'
                }`}
              >
                {busy === 'finish' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                ) : userPhase === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 inline" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2 inline" />
                )}
                {hasUnlimitedAccess ? 'Finish' : 'Finish (1 coin)'}
              </Button>
            </div>

            <p className={`text-xs text-center ${subtitleClasses}`}>
              {hasUnlimitedAccess
                ? 'Owner / subscriber — unlimited passes · Pass 1: cut preview · Pass 2: effects, captions, final render'
                : '1 coin per pass (2 total) · Pass 1: cut preview · Pass 2: effects, captions, and final render'}
            </p>

            {cutPreviewUrl && (
              <div
                className={`rounded-xl border p-4 ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}
              >
                <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Cut preview
                </p>
                <video
                  src={cutPreviewUrl}
                  controls
                  playsInline
                  className="w-full rounded-lg max-h-[420px] bg-black"
                />
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <a href={cutPreviewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open cut preview
                  </a>
                </Button>
              </div>
            )}
            {viralityCut && (
              <ViralityCard
                review={viralityCut}
                label="Virality — cut pass"
                darkMode={darkMode}
                subtitleClasses={subtitleClasses}
              />
            )}
            {(viralityEffects || viralityText) && cutDone && (
              <div className="space-y-3">
                {viralityEffects && (
                  <ViralityCard
                    review={viralityEffects}
                    label="Virality — effects"
                    darkMode={darkMode}
                    subtitleClasses={subtitleClasses}
                  />
                )}
                {viralityText && (
                  <ViralityCard
                    review={viralityText}
                    label="Virality — captions"
                    darkMode={darkMode}
                    subtitleClasses={subtitleClasses}
                  />
                )}
              </div>
            )}

            {showProgress && (
              <div
                className={`rounded-xl border p-3 ${darkMode ? 'bg-sdhq-dark-800/80 border-sdhq-cyan-500/20' : 'bg-white border-sdhq-cyan-200'}`}
              >
                <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${subtitleClasses}`}>
                  <span>Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div
                  className={`h-3 w-full overflow-hidden rounded-full ${darkMode ? 'bg-sdhq-dark-900' : 'bg-gray-200'}`}
                  role="progressbar"
                  aria-valuenow={progressPercent ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-sdhq-cyan-500 to-sdhq-green-400 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {statusText && <p className={`text-sm text-center ${subtitleClasses}`}>{statusText}</p>}
            {jobId && <p className={`text-xs text-center ${subtitleClasses}`}>Job: {jobId}</p>}

            {finalClipUrl && (
              <div
                className={`rounded-xl border p-4 ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}
              >
                <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Final clip
                </p>
                <video
                  src={finalClipUrl}
                  controls
                  playsInline
                  className="w-full rounded-lg max-h-[420px] bg-black mb-3"
                />
                <Button asChild className="w-full font-semibold" variant="default">
                  <a href={finalClipUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                    Open final clip
                  </a>
                </Button>
                {publishMetadata && (
                  <div className={`mt-4 text-left text-xs space-y-2 ${subtitleClasses}`}>
                    {typeof (publishMetadata.tiktok as { caption?: string } | undefined)?.caption ===
                      'string' && (
                      <p>
                        <span className="font-semibold">TikTok:</span>{' '}
                        {(publishMetadata.tiktok as { caption: string }).caption}
                      </p>
                    )}
                    {typeof publishMetadata.engagementScore === 'number' && (
                      <p>
                        <span className="font-semibold">Engagement score:</span>{' '}
                        {publishMetadata.engagementScore}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {error && <p className="text-sm text-red-500 text-center mt-4">{error}</p>}
      </div>
    </div>
  )
}
