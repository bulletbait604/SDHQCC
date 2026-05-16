'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Film, Loader2, Upload } from 'lucide-react'
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

const CLIP_LAYOUT_OPTIONS: Array<{ value: ClipLayoutTemplate; label: string; help: string }> = [
  { value: 'auto', label: 'Auto layout', help: 'Detect gameplay, facecam, speaker, or action and choose the best vertical format.' },
  { value: 'stackedFacecam', label: 'Stacked facecam + gameplay', help: 'StreamLadder-style reaction on top with gameplay below.' },
  { value: 'pictureInPicture', label: 'Gameplay with facecam PiP', help: 'Full gameplay with the creator reaction pinned in the corner.' },
  { value: 'focusCrop', label: 'AI focus crop', help: 'Track the speaker or action in a vertical crop.' },
  { value: 'splitScreen', label: 'Split screen', help: 'Two equal vertical panels when facecam and content both matter.' },
  { value: 'fullFrame', label: 'Full frame', help: 'Use the existing full-frame crop/letterbox behavior.' },
]

export default function ClipEditorTab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  title,
  tagline,
  user,
  hasEnoughCoins,
  deductCoins,
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
  const [publishMetadata, setPublishMetadata] = useState<Record<string, unknown> | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [finalClipUrl, setFinalClipUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [statusText, setStatusText] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number | null>(null)
  const [busy, setBusy] = useState<'upload' | 'oneclick' | null>(null)

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

  const onPickFile = async (f: File | null) => {
    setError('')
    setClipFile(null)
    setClipDurationSeconds(null)
    setR2FileKey(null)
    setProgressPercent(null)
    setStatusText('')
    setFinalClipUrl(null)
    setJobId(null)
    setPublishMetadata(null)
    if (!f) return
    if (!f.type.startsWith('video/')) {
      setError('Choose a video file (MP4, WebM, MOV, …).')
      return
    }
    try {
      const dur = await inspectVideoDuration(f)
      if (dur > MAX_CLIP_SECONDS + 0.25) {
        setError(`Clip Editor currently accepts videos up to ${MAX_CLIP_SECONDS} seconds.`)
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
      setProgress(12)
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

      setProgress(20)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': clipFile.type },
        body: clipFile,
      })
      if (!putRes.ok) throw new Error('Upload failed. Try again.')
      setR2FileKey(fileKey)
      setUploadStatus('Uploaded.')
      setProgress(25)
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

  const pollClipEditorJob = async (id: string): Promise<void> => {
    const maxAttempts = 180
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
      const progress = typeof data.progress === 'number' ? data.progress : 0
      setProgress(progress)
      const stateLabel = typeof data.stateLabel === 'string' ? data.stateLabel : 'Processing'
      setStatusText(stateLabel)

      if (data.state === 'FAILED') {
        throw new Error(
          (typeof data.error === 'string' && data.error) || 'Clip editor job failed'
        )
      }

      if (data.state === 'COMPLETE') {
        const url = normalizeHttpMediaUrl(data.outputUrl)
        if (!url) throw new Error('Job completed but no output URL was returned')
        setFinalClipUrl(url)
        if (data.metadata && typeof data.metadata === 'object') {
          setPublishMetadata(data.metadata as Record<string, unknown>)
        }
        setStatusText('Done. Your Opus-style clip is ready.')
        setProgress(100)
        return
      }
    }
    throw new Error('Clip editor job timed out. Check worker logs and retry.')
  }

  const handleOneClickCreate = async () => {
    setError('')
    setFinalClipUrl(null)
    setProgressPercent(null)
    if (!clipFile) {
      setError('Pick a video file first.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('clip-editor-runway')) {
      setError('Final creation needs enough coins.')
      return
    }

    setBusy('oneclick')
    try {
      setProgress(5)
      setStatusText('Uploading clip to R2...')
      let key = r2FileKey
      if (!key) {
        key = await handleUploadToR2(false)
      } else {
        setProgress(25)
      }
      if (!key) throw new Error('Upload did not complete.')

      setStatusText('Starting multi-pass AI editor...')
      setProgress(30)
      const jobRes = await fetch('/api/clip-editor/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          r2FileKey: key,
          platform: targetPlatform,
          layoutTemplate,
          landscapeMode: landscapeLetterbox ? 'letterbox' : 'crop',
          mimeType: clipFile.type,
          fileName: clipFile.name,
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
            'Could not start clip editor job'
        )
      }
      const newJobId = typeof jobData.jobId === 'string' ? jobData.jobId : ''
      if (!newJobId) throw new Error('No job id returned')
      setJobId(newJobId)

      const coinOk = await deductCoins('clip-editor-runway')
      if (!coinOk && !hasUnlimitedAccess) {
        setError('Job started, but coin deduction failed.')
      }
      refreshBalance()

      await pollClipEditorJob(newJobId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'One-click creation failed')
      setStatusText('')
    } finally {
      setBusy(null)
    }
  }

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-cyan-500/30 text-gray-200'
    : 'bg-white border-sdhq-cyan-300 text-gray-900'
  const showProgress = progressPercent !== null && (busy !== null || Boolean(statusText) || Boolean(finalClipUrl))

  return (
    <div className={`py-8 ${cardClasses}`}>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Film className="w-10 h-10 text-sdhq-cyan-500 shrink-0" />
          <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
        <p className={`max-w-xl ${textClasses} text-base`}>{tagline}</p>
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
                disabled={busy !== null}
              />
            </div>

            <div className="space-y-2 max-w-xl mx-auto text-left">
              <label className={`block text-sm font-semibold ${subtitleClasses}`} htmlFor="clip-editor-layout">
                Clip layout
              </label>
              <select
                id="clip-editor-layout"
                value={layoutTemplate}
                onChange={(e) => setLayoutTemplate(e.target.value as ClipLayoutTemplate)}
                disabled={busy !== null}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${inputShell}`}
              >
                {CLIP_LAYOUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={`text-xs ${subtitleClasses}`}>
                {CLIP_LAYOUT_OPTIONS.find((option) => option.value === layoutTemplate)?.help}
              </p>
            </div>

            <div className="space-y-2 max-w-xl mx-auto">
              <label
                className={`flex items-start gap-3 cursor-pointer text-left ${subtitleClasses}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-sdhq-cyan-500 text-sdhq-cyan-600"
                  checked={landscapeLetterbox}
                  onChange={(e) => setLandscapeLetterbox(e.target.checked)}
                  disabled={busy !== null}
                />
                <span>
                  <span className={`block text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    Letterbox landscape (full wide frame)
                  </span>
                  <span className="block text-xs opacity-90 mt-0.5">
                    Off (default): horizontal or webcam footage is scaled and center-cropped to fill 9:16 vertical.
                    On: entire wide frame stays visible with black bars top and bottom.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>
                Source video (≤ {MAX_CLIP_SECONDS}s)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || !user}
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
              <p className={`text-xs ${subtitleClasses}`}>
                Upload goes direct to R2. Multi-pass editing runs in the cloud (Vercel + Upstash QStash) — no local machine required.
              </p>
              {uploadStatus && <p className={`text-sm ${subtitleClasses}`}>{uploadStatus}</p>}
            </div>

            <Button
              type="button"
              onClick={handleOneClickCreate}
              disabled={busy !== null || !clipFile || !user}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-sdhq-cyan-500 text-black font-semibold"
            >
              {busy === 'oneclick' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Creating final clip (12-pass pipeline)…
                </>
              ) : (
                'Create final clip (upload, click, done)'
              )}
            </Button>
            {showProgress && (
              <div
                className={`rounded-xl border p-3 ${darkMode ? 'bg-sdhq-dark-800/80 border-sdhq-cyan-500/20' : 'bg-white border-sdhq-cyan-200'}`}
              >
                <div className={`flex items-center justify-between text-xs font-semibold mb-2 ${subtitleClasses}`}>
                  <span>Editing progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <div
                  className={`h-3 w-full overflow-hidden rounded-full ${darkMode ? 'bg-sdhq-dark-900' : 'bg-gray-200'}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  aria-label="Clip editing progress"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-sdhq-cyan-500 to-sdhq-green-400 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {statusText && <p className={`text-sm text-center ${subtitleClasses}`}>{statusText}</p>}
            {jobId && <p className={`text-xs text-center ${subtitleClasses}`}>job id: {jobId}</p>}

            {finalClipUrl && (
              <div className={`rounded-xl border p-4 ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Final clip ready</p>
                <Button asChild className="w-full font-semibold" variant="default">
                  <a href={finalClipUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2 shrink-0" aria-hidden />
                    Open final clip
                  </a>
                </Button>
                {publishMetadata && (
                  <div className={`mt-4 text-left text-xs space-y-2 ${subtitleClasses}`}>
                    {typeof (publishMetadata.tiktok as { caption?: string } | undefined)?.caption === 'string' && (
                      <p>
                        <span className="font-semibold">TikTok:</span>{' '}
                        {(publishMetadata.tiktok as { caption: string }).caption}
                      </p>
                    )}
                    {typeof (publishMetadata.youtube as { title?: string } | undefined)?.title === 'string' && (
                      <p>
                        <span className="font-semibold">YouTube:</span>{' '}
                        {(publishMetadata.youtube as { title: string }).title}
                      </p>
                    )}
                    {typeof publishMetadata.engagementScore === 'number' && (
                      <p>
                        <span className="font-semibold">Engagement score:</span> {publishMetadata.engagementScore}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {error && (
          <p className={`text-sm text-red-500 text-center mt-4`}>{error}</p>
        )}
      </div>
    </div>
  )
}
