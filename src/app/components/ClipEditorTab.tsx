'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Film, Loader2, Upload } from 'lucide-react'
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
const RENDER_PROGRESS_START = 65
const RENDER_PROGRESS_RANGE = 33
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
  const [renderId, setRenderId] = useState<string | null>(null)
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

  const extractShotstackVideoUrl = (snapshot: unknown): string | null => {
    const s = snapshot as Record<string, unknown> | null
    if (!s || typeof s !== 'object') return null
    if (s.success === false && typeof s.message === 'string') return null
    const response = s.response as Record<string, unknown> | undefined
    const candidates = [response?.url, s.url]
    for (const u of candidates) {
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) return u
    }
    return null
  }

  const readShotstackPollError = (snapRes: Response, snapData: Record<string, unknown>): string => {
    if (typeof snapData.error === 'string' && snapData.error.trim()) return snapData.error
    if (typeof snapData.message === 'string' && snapData.message.trim() && snapData.success === false) {
      return snapData.message
    }
    return snapRes.status === 502
      ? 'Could not reach Shotstack (bad gateway). Retry in a moment.'
      : `Render status request failed (${snapRes.status}).`
  }

  const extractVizardVideoUrl = (snapshot: Record<string, unknown>): string | null => {
    const top = normalizeHttpMediaUrl(snapshot.videoUrl)
    if (top) return top
    const bestVideo = snapshot.bestVideo as Record<string, unknown> | undefined
    if (bestVideo) {
      const fromBest =
        normalizeHttpMediaUrl(bestVideo.videoUrl) ||
        normalizeHttpMediaUrl(bestVideo.video_url) ||
        normalizeHttpMediaUrl(bestVideo.downloadUrl) ||
        normalizeHttpMediaUrl(bestVideo.url)
      if (fromBest) return fromBest
    }
    return null
  }

  const extractVizardDurationMs = (snapshot: Record<string, unknown>): number | null => {
    const bestVideo = snapshot.bestVideo as Record<string, unknown> | undefined
    const duration = bestVideo?.videoMsDuration
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) return duration
    if (typeof duration === 'string') {
      const n = Number(duration.trim())
      if (Number.isFinite(n) && n > 0) return n
    }
    return null
  }

  const extractVizardTextField = (
    snapshot: Record<string, unknown>,
    field: 'title' | 'viralScore' | 'viralReason'
  ): string | null => {
    const bestVideo = snapshot.bestVideo as Record<string, unknown> | undefined
    const value = bestVideo?.[field]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  const readVizardPollError = (snapRes: Response, snapData: Record<string, unknown>): string => {
    if (typeof snapData.userMessage === 'string' && snapData.userMessage.trim()) return snapData.userMessage
    if (typeof snapData.error === 'string' && snapData.error.trim()) return snapData.error
    return `Vizard status request failed (${snapRes.status}).`
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
      setStatusText('Uploading clip...')
      let key = r2FileKey
      if (!key) {
        key = await handleUploadToR2(false)
      } else {
        setProgress(25)
      }
      if (!key) throw new Error('Upload did not complete.')

      setStatusText('Analyzing and building edit plan...')
      setProgress(35)
      const processRes = await fetch('/api/process-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: targetPlatform,
          clipBrief: `Create a high-performing ${targetPlatform} short from this uploaded clip. Prioritize strong hook, retention pacing, clear captions, and platform-safe framing.`,
          r2FileKey: key,
          landscapeMode: landscapeLetterbox ? 'letterbox' : 'crop',
          layoutTemplate,
          mimeType: clipFile.type,
          fileName: clipFile.name,
          ...(typeof clipDurationSeconds === 'number' && Number.isFinite(clipDurationSeconds)
            ? { sourceDurationSeconds: clipDurationSeconds }
            : {}),
        }),
      })
      const processData = await processRes.json().catch(() => ({}))
      if (!processRes.ok) {
        throw new Error(
          (processData as { userMessage?: string }).userMessage ||
            (processData as { error?: string }).error ||
            'Could not process clip'
        )
      }
      const vizardProjectId = (processData as { vizard?: { projectId?: string } }).vizard?.projectId
      if (vizardProjectId) {
        setStatusText('Vizard is editing your clip...')
        setRenderId(`vizard:${vizardProjectId}`)
        setProgress(RENDER_PROGRESS_START)

        const coinOk = await deductCoins('clip-editor-runway')
        if (!coinOk && !hasUnlimitedAccess) {
          setError('Vizard edit started, but coin deduction failed.')
        }
        refreshBalance()

        const maxAttempts = 60
        for (let i = 0; i < maxAttempts; i++) {
          await sleep(30000)
          const snapRes = await fetch(
            `/api/clip-editor/vizard/task?projectId=${encodeURIComponent(vizardProjectId)}`,
            { credentials: 'include' }
          )
          const snapData = (await snapRes.json().catch(() => ({}))) as Record<string, unknown>
          if (!snapRes.ok) {
            throw new Error(readVizardPollError(snapRes, snapData))
          }
          setProgress(RENDER_PROGRESS_START + ((i + 1) / maxAttempts) * RENDER_PROGRESS_RANGE)
          setStatusText('Vizard is editing your clip...')
          const clipUrl = extractVizardVideoUrl(snapData)
          if (clipUrl) {
            if (snapData.captionMode === 'deepgram-shotstack') {
              setStatusText('Adding Deepgram captions...')
              const captionRes = await fetch('/api/clip-editor/vizard/caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  videoUrl: clipUrl,
                  platform: targetPlatform,
                  ...(extractVizardDurationMs(snapData) != null
                    ? { videoMsDuration: extractVizardDurationMs(snapData) }
                    : {}),
                  ...(extractVizardTextField(snapData, 'title')
                    ? { title: extractVizardTextField(snapData, 'title') }
                    : {}),
                  ...(extractVizardTextField(snapData, 'viralScore')
                    ? { viralScore: extractVizardTextField(snapData, 'viralScore') }
                    : {}),
                  ...(extractVizardTextField(snapData, 'viralReason')
                    ? { viralReason: extractVizardTextField(snapData, 'viralReason') }
                    : {}),
                }),
              })
              const captionData = await captionRes.json().catch(() => ({}))
              if (!captionRes.ok) {
                throw new Error(
                  (captionData as { userMessage?: string }).userMessage ||
                    (captionData as { error?: string }).error ||
                    'Could not add Deepgram captions'
                )
              }
              const captionRenderId = (captionData as { renderId?: string }).renderId
              if (!captionRenderId) throw new Error('No caption render id was returned')
              setRenderId(`vizard-caption:${captionRenderId}`)

              for (let j = 0; j < 90; j++) {
                await sleep(4000)
                const captionSnapRes = await fetch(
                  `/api/shotstack/render/task?renderId=${encodeURIComponent(captionRenderId)}`,
                  { credentials: 'include' }
                )
                const captionSnapData = (await captionSnapRes.json().catch(() => ({}))) as Record<string, unknown>
                if (!captionSnapRes.ok) {
                  throw new Error(readShotstackPollError(captionSnapRes, captionSnapData))
                }
                const status = String(
                  (captionSnapData.response as { status?: string } | undefined)?.status || ''
                ).toUpperCase()
                setStatusText(`Rendering Deepgram captions... ${status || 'RUNNING'}`)
                const captionedUrl = extractShotstackVideoUrl(captionSnapData)
                if (captionedUrl) {
                  setFinalClipUrl(captionedUrl)
                  setStatusText('Done. Your captioned Vizard clip is ready.')
                  setProgress(100)
                  return
                }
                if (status === 'FAILED' || status === 'CANCELLED') {
                  throw new Error('Caption render failed. Try the Vizard caption mode or retry.')
                }
              }
              throw new Error('Caption render timed out before completion. Please retry.')
            }
            setFinalClipUrl(clipUrl)
            setStatusText('Done. Your Vizard clip is ready.')
            setProgress(100)
            return
          }
        }
        throw new Error('Vizard edit timed out before completion. Please retry or check Vizard.')
      }
      const shotstackPackage = (processData as { shotstack?: Record<string, unknown> }).shotstack
      if (!shotstackPackage) {
        throw new Error('AI package did not include Shotstack render data.')
      }
      setProgress(50)

      setStatusText('Submitting Shotstack render...')
      setProgress(58)
      const shotstackRes = await fetch('/api/shotstack/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(shotstackPackage),
      })
      const shotstackData = await shotstackRes.json().catch(() => ({}))
      if (!shotstackRes.ok) {
        throw new Error(
          (shotstackData as { userMessage?: string }).userMessage ||
            (shotstackData as { error?: string }).error ||
            'Could not start Shotstack render'
        )
      }
      const id = (shotstackData as { renderId?: string }).renderId
      if (!id) throw new Error('No Shotstack render id was returned')
      setRenderId(id)
      setProgress(RENDER_PROGRESS_START)

      const coinOk = await deductCoins('clip-editor-runway')
      if (!coinOk && !hasUnlimitedAccess) {
        setError('Render started, but coin deduction failed.')
      }
      refreshBalance()

      const maxAttempts = 90
      let doneWithoutUrlAttempts = 0
      for (let i = 0; i < maxAttempts; i++) {
        await sleep(4000)
        const snapRes = await fetch(`/api/shotstack/render/task?renderId=${encodeURIComponent(id)}`, {
          credentials: 'include',
        })
        const snapData = (await snapRes.json().catch(() => ({}))) as Record<string, unknown>
        if (!snapRes.ok) {
          throw new Error(readShotstackPollError(snapRes, snapData))
        }
        if (snapData.success === false) {
          throw new Error(
            typeof snapData.message === 'string' && snapData.message.trim()
              ? snapData.message
              : 'Shotstack could not return render status.'
          )
        }
        const status = String(
          (snapData.response as { status?: string } | undefined)?.status || ''
        ).toUpperCase()
        setProgress(RENDER_PROGRESS_START + ((i + 1) / maxAttempts) * RENDER_PROGRESS_RANGE)
        setStatusText(`Rendering... ${status || 'RUNNING'}`)
        const clipUrl = extractShotstackVideoUrl(snapData)
        if (clipUrl) {
          setFinalClipUrl(clipUrl)
          setStatusText('Done. Your clip is ready.')
          setProgress(100)
          return
        }
        if (status === 'FAILED' || status === 'CANCELLED') {
          const errDetail =
            typeof (snapData.response as { error?: string } | undefined)?.error === 'string'
              ? ` ${(snapData.response as { error: string }).error}`
              : ''
          throw new Error(`Shotstack render failed.${errDetail} Try a shorter clip or simpler overlays.`)
        }
        if (status === 'DONE') {
          doneWithoutUrlAttempts += 1
          if (doneWithoutUrlAttempts >= 15) {
            throw new Error(
              'Render finished but no video URL was returned yet. Wait a minute and check Shotstack, or retry.'
            )
          }
        } else {
          doneWithoutUrlAttempts = 0
        }
      }
      throw new Error('Render timed out before completion. Please retry.')
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
                Upload once, then click Generate. The app handles AI planning, render, and post copy automatically.
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
                  Creating final clip (upload, AI edit, render, metadata)…
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
            {renderId && <p className={`text-xs text-center ${subtitleClasses}`}>render id: {renderId}</p>}

            {finalClipUrl && (
              <div className={`rounded-xl border p-4 ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-sdhq-cyan-200'}`}>
                <p className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Final clip ready</p>
                <a
                  href={finalClipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sdhq-cyan-400 underline break-all text-sm"
                >
                  {finalClipUrl}
                </a>
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
