'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Film, Loader2, Upload } from 'lucide-react'
import type { ToolType } from '@/hooks/useCoins'
import PlatformSelector from '@/app/components/PlatformSelector'
import type { TargetPlatform } from '@/lib/platformEditing'

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
  const [landscapeLetterbox, setLandscapeLetterbox] = useState(false)
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number | null>(null)
  const [r2FileKey, setR2FileKey] = useState<string | null>(null)
  const [renderId, setRenderId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [finalClipUrl, setFinalClipUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [statusText, setStatusText] = useState<string>('')
  const [busy, setBusy] = useState<'upload' | 'oneclick' | null>(null)

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

  const handleUploadToR2 = async (): Promise<string | null> => {
    if (!user) {
      setError('Log in with Kick first.')
      return null
    }
    if (!clipFile) {
      setError('Pick a clip file first.')
      return null
    }
    setBusy('upload')
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
      setUploadStatus('Uploaded.')
      return fileKey
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
      return null
    } finally {
      setBusy(null)
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

  const handleOneClickCreate = async () => {
    setError('')
    setFinalClipUrl(null)
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
      setStatusText('Uploading clip...')
      let key = r2FileKey
      if (!key) {
        key = await handleUploadToR2()
      }
      if (!key) throw new Error('Upload did not complete.')

      setStatusText('Analyzing and building edit plan...')
      const processRes = await fetch('/api/process-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: targetPlatform,
          clipBrief: `Create a high-performing ${targetPlatform} short from this uploaded clip. Prioritize strong hook, retention pacing, clear captions, and platform-safe framing.`,
          r2FileKey: key,
          landscapeMode: landscapeLetterbox ? 'letterbox' : 'crop',
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
      const shotstackPackage = (processData as { shotstack?: Record<string, unknown> }).shotstack
      if (!shotstackPackage) {
        throw new Error('AI package did not include Shotstack render data.')
      }

      setStatusText('Submitting Shotstack render...')
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
        setStatusText(`Rendering... ${status || 'RUNNING'}`)
        const clipUrl = extractShotstackVideoUrl(snapData)
        if (clipUrl) {
          setFinalClipUrl(clipUrl)
          setStatusText('Done. Your clip is ready.')
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
