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
  const [clipBrief, setClipBrief] = useState('')
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [r2FileKey, setR2FileKey] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [planJson, setPlanJson] = useState<unknown>(null)
  const [runwayPrompt, setRunwayPrompt] = useState('')
  const [runwayModel, setRunwayModel] = useState<'gen4_aleph' | 'seedance2' | 'gen4.5'>('gen4_aleph')
  const [seedanceDuration, setSeedanceDuration] = useState<number>(8)
  const [gen45Duration, setGen45Duration] = useState<number>(5)
  const [gen45Ratio, setGen45Ratio] = useState<'1280:720' | '720:1280'>('1280:720')
  /** Optional deterministic seed for Gen-4.5 — leave blank for random */
  const [gen45Seed, setGen45Seed] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskSnapshot, setTaskSnapshot] = useState<unknown>(null)
  const [processedResult, setProcessedResult] = useState<unknown>(null)
  const [finalClipUrl, setFinalClipUrl] = useState<string | null>(null)
  const [finalPublishPackage, setFinalPublishPackage] = useState<unknown>(null)
  const [error, setError] = useState<string>('')
  const [busy, setBusy] = useState<'upload' | 'plan' | 'process' | 'oneclick' | 'runway' | 'poll' | null>(null)

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
    } catch {
      setError('Could not read video duration.')
      return
    }
    setClipFile(f)
  }

  const handleUploadToR2 = async () => {
    if (!user) {
      setError('Log in with Kick first.')
      return
    }
    if (!clipFile) {
      setError('Pick a clip file first.')
      return
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
      setUploadStatus('Uploaded. You can generate a plan next, then start Runway.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(null)
      refreshBalance()
    }
  }

  const handlePlan = async () => {
    setError('')
    if (!hasUnlimitedAccess && !hasEnoughCoins('clip-editor-plan')) {
      setError('Clip Editor planning needs enough coins.')
      return
    }
    setBusy('plan')
    try {
      const res = await fetch('/api/clip-editor/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: targetPlatform,
          clipBrief,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (data as { userMessage?: string }).userMessage ||
            (data as { error?: string }).error ||
            'Plan failed'
        )
      }
      setPlanJson((data as { plan: unknown }).plan)
      const p = (data as { plan: Record<string, unknown> }).plan
      const suggested =
        typeof p?.runwayPromptText === 'string'
          ? p.runwayPromptText
          : typeof p?.runwayPrompt === 'string'
            ? (p.runwayPrompt as string)
            : ''
      if (suggested) setRunwayPrompt(suggested)
      if (typeof p?.recommendedRunwayModel === 'string') {
        const rm = p.recommendedRunwayModel.trim().toLowerCase()
        if (rm === 'seedance2') setRunwayModel('seedance2')
        else if (rm === 'gen4.5' || rm === 'gen4_5' || rm === 'gen45') setRunwayModel('gen4.5')
        else setRunwayModel('gen4_aleph')
      }
      const d = (p?.seedanceDuration ?? null) as unknown
      if (typeof d === 'number' && Number.isFinite(d)) {
        setSeedanceDuration(Math.min(15, Math.max(4, Math.round(d))))
      }
      const g45d = (p?.gen45Duration ?? null) as unknown
      if (typeof g45d === 'number' && Number.isFinite(g45d)) {
        setGen45Duration(Math.min(10, Math.max(2, Math.round(g45d))))
      }
      const g45r = p?.gen45Ratio
      if (g45r === '720:1280' || g45r === '1280:720') {
        setGen45Ratio(g45r)
      }

      const ok = await deductCoins('clip-editor-plan')
      if (!ok && !hasUnlimitedAccess) {
        setError('Plan returned, but coin deduction failed.')
      }
      refreshBalance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan failed')
    } finally {
      setBusy(null)
    }
  }

  const handleRunwayStart = async () => {
    setError('')
    if (!hasUnlimitedAccess && !hasEnoughCoins('clip-editor-runway')) {
      setError('Starting Runway needs enough coins.')
      return
    }
    if (runwayModel !== 'gen4.5' && !r2FileKey) {
      setError('Upload your clip before starting Runway (required for Aleph and Seedance2).')
      return
    }
    const pt = runwayPrompt.trim()
    if (pt.length < 4) {
      setError('Add a runway prompt first (from the AI plan).')
      return
    }
    if (
      (runwayModel === 'gen4_aleph' || runwayModel === 'gen4.5') &&
      pt.length > 1000
    ) {
      setError('Prompt is too long for this model — use 1000 characters or fewer (Aleph / Gen-4.5).')
      return
    }
    const body: Record<string, unknown> = {
      promptText: pt,
      model: runwayModel,
    }
    if (r2FileKey) body.r2FileKey = r2FileKey
    if (runwayModel === 'seedance2') body.duration = seedanceDuration
    if (runwayModel === 'gen4.5') {
      body.duration = gen45Duration
      body.ratio = gen45Ratio
      const s = parseInt(gen45Seed.trim(), 10)
      if (gen45Seed.trim() !== '' && Number.isInteger(s)) {
        body.seed = s
      }
    }

    setBusy('runway')
    try {
      const res = await fetch('/api/clip-editor/runway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (data as { userMessage?: string }).userMessage ||
            (data as { error?: string }).error ||
            'Runway start failed'
        )
      }
      const id = (data as { taskId?: string }).taskId
      if (!id) throw new Error('No task id returned')
      setTaskId(id)

      const ok = await deductCoins('clip-editor-runway')
      if (!ok && !hasUnlimitedAccess) {
        setError('Runway started, but coin deduction failed.')
      }
      refreshBalance()
      setBusy('poll')
      const snap = await fetch(`/api/clip-editor/runway/task?taskId=${encodeURIComponent(id)}`, {
        credentials: 'include',
      })
      setTaskSnapshot(await snap.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Runway start failed')
    } finally {
      setBusy(null)
    }
  }

  const handleProcessClip = async () => {
    setError('')
    if (!clipBrief.trim()) {
      setError('Add a clip brief before processing.')
      return
    }
    if (!r2FileKey) {
      setError('Upload your clip first so the platform-safe edit package can be generated.')
      return
    }
    setBusy('process')
    try {
      const res = await fetch('/api/process-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: targetPlatform,
          clipBrief,
          r2FileKey,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (data as { userMessage?: string }).userMessage ||
            (data as { error?: string }).error ||
            'Process clip failed'
        )
      }
      setProcessedResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Process clip failed')
    } finally {
      setBusy(null)
    }
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const extractRunwayVideoUrl = (snapshot: unknown): string | null => {
    const s = snapshot as Record<string, unknown> | null
    if (!s || typeof s !== 'object') return null
    const output = s.output as unknown
    if (Array.isArray(output)) {
      for (const item of output) {
        if (typeof item === 'string' && /^https?:\/\//i.test(item)) return item
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>
          const candidates = [rec.url, rec.uri, rec.src]
          for (const c of candidates) {
            if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
          }
        }
      }
    }
    const outUrl = s.outputUrl
    if (typeof outUrl === 'string' && /^https?:\/\//i.test(outUrl)) return outUrl
    const videoUrl = s.videoUrl
    if (typeof videoUrl === 'string' && /^https?:\/\//i.test(videoUrl)) return videoUrl
    return null
  }

  const handleOneClickCreate = async () => {
    setError('')
    setFinalClipUrl(null)
    if (!clipBrief.trim()) {
      setError('Add a clip brief first.')
      return
    }
    if (!r2FileKey) {
      setError('Upload your clip first.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('clip-editor-runway')) {
      setError('Final creation needs enough coins.')
      return
    }

    setBusy('oneclick')
    try {
      const processRes = await fetch('/api/process-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: targetPlatform,
          clipBrief,
          r2FileKey,
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
      setProcessedResult(processData)
      setFinalPublishPackage((processData as { publishPackage?: unknown }).publishPackage ?? null)

      const runway = (processData as { runway?: Record<string, unknown> }).runway || {}
      const runwayModel = (runway.model as 'gen4_aleph' | 'seedance2' | 'gen4.5') || 'gen4_aleph'
      const runwayPrompt = String(runway.promptText || '').trim()
      if (!runwayPrompt) {
        throw new Error('AI did not return a usable Runway prompt.')
      }

      const runwayBody: Record<string, unknown> = {
        promptText: runwayPrompt,
        model: runwayModel,
      }
      if (runwayModel !== 'gen4.5') runwayBody.r2FileKey = r2FileKey
      if (runwayModel === 'seedance2') {
        runwayBody.duration = Number(runway.seedanceDuration || 8)
      }
      if (runwayModel === 'gen4.5') {
        runwayBody.duration = Number(runway.gen45Duration || 5)
        runwayBody.ratio = (runway.gen45Ratio as '720:1280' | '1280:720') || '720:1280'
      }

      const runwayRes = await fetch('/api/clip-editor/runway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(runwayBody),
      })
      const runwayData = await runwayRes.json().catch(() => ({}))
      if (!runwayRes.ok) {
        throw new Error(
          (runwayData as { userMessage?: string }).userMessage ||
            (runwayData as { error?: string }).error ||
            'Could not start final render'
        )
      }
      const id = (runwayData as { taskId?: string }).taskId
      if (!id) throw new Error('No Runway task id was returned')
      setTaskId(id)

      const coinOk = await deductCoins('clip-editor-runway')
      if (!coinOk && !hasUnlimitedAccess) {
        setError('Render started, but coin deduction failed.')
      }
      refreshBalance()

      const maxAttempts = 90
      for (let i = 0; i < maxAttempts; i++) {
        await sleep(4000)
        const snapRes = await fetch(`/api/clip-editor/runway/task?taskId=${encodeURIComponent(id)}`, {
          credentials: 'include',
        })
        const snapData = await snapRes.json().catch(() => ({}))
        setTaskSnapshot(snapData)
        const status = String((snapData as { status?: string }).status || '').toUpperCase()
        const clipUrl = extractRunwayVideoUrl(snapData)
        if (clipUrl) {
          setFinalClipUrl(clipUrl)
          return
        }
        if (status === 'FAILED' || status === 'CANCELLED') {
          throw new Error('Render failed in Runway. Try a shorter clip or slightly simpler prompt.')
        }
      }
      throw new Error('Render timed out before completion. Please retry.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'One-click creation failed')
    } finally {
      setBusy(null)
    }
  }

  const pollTask = async () => {
    if (!taskId) return
    setBusy('poll')
    setError('')
    try {
      const snap = await fetch(`/api/clip-editor/runway/task?taskId=${encodeURIComponent(taskId)}`, {
        credentials: 'include',
      })
      setTaskSnapshot(await snap.json())
    } catch {
      setError('Could not fetch task status.')
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

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>
                Clip brief (what happens in the video, pacing, hook, audio — used by GPT planner)
              </label>
              <textarea
                value={clipBrief}
                onChange={(e) => setClipBrief(e.target.value)}
                disabled={busy !== null}
                rows={5}
                placeholder="Example: Loud reaction at 0:02–0:06, muted gameplay afterward. Hook buried; needs faster cuts toward the yell + face cam zoom…"
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputShell} resize-y min-h-[120px]`}
              />
            </div>

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>
                Source video (≤ {MAX_CLIP_SECONDS}s) — optional for Gen-4.5 text-to-video
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
                For Aleph / Seedance2 the server streams your upload into Runway&apos;s ephemeral storage (avoids the small
                public-URL size cap). Clips must be about 200MB or less for that step; large files may take a minute to
                transfer.
              </p>
              <Button
                type="button"
                onClick={handleUploadToR2}
                disabled={busy !== null || !clipFile || !user}
                className="sdhq-button w-full sm:w-auto"
              >
                {busy === 'upload' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  'Upload clip to Creator Corner storage'
                )}
              </Button>
              {uploadStatus && <p className={`text-sm ${subtitleClasses}`}>{uploadStatus}</p>}
            </div>

            <Button
              type="button"
              onClick={handlePlan}
              disabled={busy !== null || !clipBrief.trim() || !user}
              className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold"
            >
              {busy === 'plan' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Building plan with OpenAI…
                </>
              ) : (
                'Generate edit plan (OpenAI)'
              )}
            </Button>

            <Button
              type="button"
              onClick={handleProcessClip}
              disabled={busy !== null || !clipBrief.trim() || !r2FileKey || !user}
              className="w-full bg-gradient-to-r from-sdhq-green-500 to-sdhq-cyan-500 text-black font-semibold"
            >
              {busy === 'process' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Building platform-safe package…
                </>
              ) : (
                'Generate platform-safe edit package (Gemini + Shotstack)'
              )}
            </Button>

            <Button
              type="button"
              onClick={handleOneClickCreate}
              disabled={busy !== null || !clipBrief.trim() || !r2FileKey || !user}
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

            {planJson != null && (
              <div
                className={`rounded-xl border p-4 text-left text-xs font-mono overflow-auto max-h-64 ${
                  darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-gray-200' : 'bg-gray-50 border-sdhq-cyan-200'
                }`}
              >
                <pre>{JSON.stringify(planJson, null, 2)}</pre>
              </div>
            )}

            {processedResult != null && (
              <div
                className={`rounded-xl border p-4 text-left text-xs font-mono overflow-auto max-h-64 ${
                  darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-gray-200' : 'bg-gray-50 border-sdhq-cyan-200'
                }`}
              >
                <pre>{JSON.stringify(processedResult, null, 2)}</pre>
              </div>
            )}

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

            {finalPublishPackage != null && (
              <div
                className={`rounded-xl border p-4 text-left text-xs font-mono overflow-auto max-h-64 ${
                  darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-gray-200' : 'bg-gray-50 border-sdhq-cyan-200'
                }`}
              >
                <pre>{JSON.stringify(finalPublishPackage, null, 2)}</pre>
              </div>
            )}

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`}>
                Runway prompt (≤ 1000 chars for Aleph and Gen-4.5)
              </label>
              <textarea
                value={runwayPrompt}
                onChange={(e) => setRunwayPrompt(e.target.value)}
                disabled={busy !== null}
                rows={4}
                maxLength={
                  runwayModel === 'gen4_aleph' || runwayModel === 'gen4.5' ? 1000 : 2000
                }
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputShell}`}
              />
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={runwayModel}
                  onChange={(e) =>
                    setRunwayModel(e.target.value as 'gen4_aleph' | 'seedance2' | 'gen4.5')
                  }
                  className={`px-3 py-2 rounded-lg border text-sm ${inputShell}`}
                >
                  <option value="gen4_aleph">gen4_aleph (video → stylized/transform)</option>
                  <option value="seedance2">seedance2 (4–15s generative guided by clip)</option>
                  <option value="gen4.5">gen4.5 (text-to-video)</option>
                </select>
                {runwayModel === 'seedance2' && (
                  <>
                    <label className={`text-xs ${subtitleClasses}`}>Seconds</label>
                    <input
                      type="number"
                      min={4}
                      max={15}
                      value={seedanceDuration}
                      onChange={(e) => setSeedanceDuration(Number(e.target.value))}
                      className={`w-24 px-2 py-2 rounded-lg border text-sm ${inputShell}`}
                    />
                  </>
                )}
                {runwayModel === 'gen4.5' && (
                  <>
                    <label className={`text-xs ${subtitleClasses}`}>Seconds (2–10)</label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={gen45Duration}
                      onChange={(e) => setGen45Duration(Number(e.target.value))}
                      className={`w-24 px-2 py-2 rounded-lg border text-sm ${inputShell}`}
                    />
                    <label className={`text-xs ${subtitleClasses}`}>Aspect</label>
                    <select
                      value={gen45Ratio}
                      onChange={(e) =>
                        setGen45Ratio(e.target.value as '1280:720' | '720:1280')
                      }
                      className={`px-2 py-2 rounded-lg border text-sm ${inputShell}`}
                    >
                      <option value="1280:720">1280:720 landscape</option>
                      <option value="720:1280">720:1280 portrait</option>
                    </select>
                    <label className={`text-xs ${subtitleClasses}`}>Seed</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="random"
                      value={gen45Seed}
                      onChange={(e) => setGen45Seed(e.target.value.replace(/\D/g, ''))}
                      className={`w-28 px-2 py-2 rounded-lg border text-sm ${inputShell}`}
                    />
                  </>
                )}
              </div>
              <Button
                type="button"
                onClick={handleRunwayStart}
                disabled={
                  busy !== null ||
                  !user ||
                  (runwayModel !== 'gen4.5' && !r2FileKey)
                }
                variant="outline"
                className="w-full border-sdhq-green-500/60 text-sdhq-green-600 font-semibold"
              >
                {busy === 'runway' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Starting Runway task…
                  </>
                ) : (
                  'Start Runway edit'
                )}
              </Button>
            </div>

            {(taskSnapshot != null || taskId) && (
              <div className="space-y-2">
                <div className="flex gap-3 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={pollTask} disabled={busy !== null}>
                    {busy === 'poll' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Checking…
                      </>
                    ) : (
                      'Refresh task status'
                    )}
                  </Button>
                  <span className={`text-xs self-center ${subtitleClasses}`}>{taskId && `task: ${taskId}`}</span>
                </div>
                <pre
                  className={`rounded-xl border p-4 text-xs font-mono overflow-auto max-h-64 ${
                    darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600 text-gray-300' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {JSON.stringify(taskSnapshot, null, 2)}
                </pre>
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
