'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Crop, Download, Image as ImageIcon, Loader2, RectangleHorizontal, Upload, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { postActivityLog } from '@/lib/home/activityLogUtils'
import type { ActivityLogEntry } from '@/lib/home/types'
import {
  BANNER_PRESETS,
  bannerExportFileName,
  bannerPresetsInGroup,
  formatByteLimit,
  sizeStatusLabel,
  type BannerPreset,
} from '@/lib/bannerSizer/presets'
import { encodeUnderCap } from '@/lib/bannerSizer/encodeUnderCap'
import {
  defaultFrame,
  placementFor,
  type BannerMode,
  type FrameState,
  type Placement,
} from '@/lib/bannerSizer/placement'
import { bannerWarnings, previewFrames, type PreviewFrame } from '@/lib/bannerSizer/previewFrames'
import { zipStore } from '@/lib/bannerSizer/zipStore'
import { COIN_COSTS, type ToolType } from '@/hooks/useCoins'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MODES: { id: BannerMode; label: string; hint: string }[] = [
  { id: 'crop', label: 'Crop', hint: 'Cut the photo to the banner shape.' },
  { id: 'fit', label: 'Fit', hint: 'Show the whole photo and leave empty edges.' },
  { id: 'stretch', label: 'Stretch', hint: 'Fill the frame even if it distorts.' },
  { id: 'ai', label: 'AI Fill', hint: 'Keep the photo and generate the missing edges.' },
]

interface AiResult {
  dataUrl: string
  frameKey: string
  withinCap: boolean
  bytes: number
}

export interface BannerSizerTabProps {
  darkMode: boolean
  textClasses: string
  subtitleClasses: string
  description: string
  user: { username: string } | null
  hasEnoughCoins: (tool: ToolType) => boolean
  hasUnlimitedAccess: boolean
  refreshBalance: () => void
  onActivityLog: (entry: ActivityLogEntry) => void
}

function frameKey(frame: FrameState): string {
  return [frame.mode, frame.zoom.toFixed(4), frame.panX.toFixed(4), frame.panY.toFixed(4)].join('|')
}

function downloadBytes(bytes: Uint8Array, fileName: string, type: string) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const url = URL.createObjectURL(new Blob([copy], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Could not encode that banner.'))
        return
      }
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/jpeg', quality)
  })
}

function paintBanner(
  image: HTMLImageElement,
  preset: BannerPreset,
  frame: FrameState
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = preset.width
  canvas.height = preset.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#111114'
  ctx.fillRect(0, 0, preset.width, preset.height)
  const placement = placementFor(image.naturalWidth, image.naturalHeight, preset.width, preset.height, frame)
  ctx.drawImage(image, placement.dx, placement.dy, placement.dw, placement.dh)
  return canvas
}

async function exportPreset(
  image: HTMLImageElement,
  preset: BannerPreset,
  frame: FrameState,
  ai: AiResult | undefined
): Promise<{ bytes: Uint8Array; withinCap: boolean; usedAi: boolean }> {
  if (frame.mode === 'ai' && ai && ai.frameKey === frameKey(frame)) {
    const response = await fetch(ai.dataUrl)
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { bytes, withinCap: ai.withinCap, usedAi: true }
  }
  const canvas = paintBanner(image, preset, frame)
  const encoded = await encodeUnderCap((quality) => canvasToJpeg(canvas, quality), preset.maxBytes)
  return { bytes: encoded.bytes, withinCap: encoded.withinCap, usedAi: false }
}

function sourceDataUrl(image: HTMLImageElement): string {
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

export default function BannerSizerTab({
  darkMode,
  textClasses,
  subtitleClasses,
  description,
  user,
  hasEnoughCoins,
  hasUnlimitedAccess,
  refreshBalance,
  onActivityLog,
}: BannerSizerTabProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; logo: boolean } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isGif, setIsGif] = useState(false)
  const [activeId, setActiveId] = useState(BANNER_PRESETS[0]!.id)
  const [frames, setFrames] = useState<Record<string, FrameState>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BANNER_PRESETS.map((preset) => [preset.id, true]))
  )
  const [logo, setLogo] = useState({ x: 0.5, y: 0.5 })
  const [ai, setAi] = useState<Record<string, AiResult>>({})
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [aiMissing, setAiMissing] = useState<string | null>(null)
  const [busy, setBusy] = useState<'ai' | 'one' | 'zip' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const preset = bannerPresetById(activeId)
  const frame = frames[preset.id] || defaultFrame(1, 1, preset.width, preset.height)
  const placement = image
    ? placementFor(image.naturalWidth, image.naturalHeight, preset.width, preset.height, frame)
    : null
  const views = previewFrames(preset)
  const warnings = image && placement
    ? bannerWarnings({ preset, frame, placement, logo })
    : []
  const aiResult = ai[preset.id]
  const aiMatches = Boolean(aiResult && aiResult.frameKey === frameKey(frame))
  const coinCost = COIN_COSTS['banner-sizer']

  const panel = darkMode ? 'border-white/10 bg-sdhq-dark-900/70' : 'border-sdhq-cyan-100 bg-white'
  const muted = subtitleClasses

  useEffect(() => {
    let cancelled = false
    void fetch('/api/banner-sizer', { credentials: 'include' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { available?: boolean; missing?: string | null }
        if (cancelled) return
        setAiAvailable(Boolean(data.available))
        setAiMissing(data.missing || null)
      })
      .catch(() => {
        if (!cancelled) setAiAvailable(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      setFrames((current) => {
        const prev = current[preset.id] || { mode: 'ai' as const, zoom: 1, panX: 0, panY: 0 }
        const nextZoom = Math.min(6, Math.max(0.2, prev.zoom * (event.deltaY < 0 ? 1.06 : 0.94)))
        return { ...current, [preset.id]: { ...prev, zoom: nextZoom } }
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [preset.id])

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const loadFile = (file: File | null) => {
    setError('')
    setNotice('')
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setError('Use a JPG, PNG, WebP, or GIF.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That file is over 12 MB. Export a smaller copy and try again.')
      return
    }
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => {
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setImage(next)
      setIsGif(file.type === 'image/gif')
      setLogo({ x: 0.5, y: 0.5 })
      setAi({})
      const initial: Record<string, FrameState> = {}
      for (const item of BANNER_PRESETS) {
        initial[item.id] = defaultFrame(next.naturalWidth, next.naturalHeight, item.width, item.height)
      }
      setFrames(initial)
    }
    next.onerror = () => {
      URL.revokeObjectURL(url)
      setError('That image could not be opened.')
    }
    next.src = url
  }

  const updateFrame = (patch: Partial<FrameState>) => {
    setFrames((current) => {
      const prev = current[preset.id] || frame
      return { ...current, [preset.id]: { ...prev, ...patch } }
    })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const logoHit = (event.target as HTMLElement).dataset.logo === '1'
    dragRef.current = { x: event.clientX, y: event.clientY, panX: frame.panX, panY: frame.panY, logo: logoHit }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage || !image) return
    const rect = stage.getBoundingClientRect()
    if (drag.logo && placement) {
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      const exportX = (localX / rect.width) * preset.width
      const exportY = (localY / rect.height) * preset.height
      const nextX = (exportX - placement.dx) / placement.dw
      const nextY = (exportY - placement.dy) / placement.dh
      setLogo({
        x: Math.min(1, Math.max(0, nextX)),
        y: Math.min(1, Math.max(0, nextY)),
      })
      return
    }
    updateFrame({
      panX: drag.panX + (event.clientX - drag.x) / rect.width,
      panY: drag.panY + (event.clientY - drag.y) / rect.height,
    })
  }

  const runAi = async () => {
    setError('')
    setNotice('')
    if (!image || !placement) {
      setError('Upload an image first.')
      return
    }
    if (frame.mode !== 'ai') {
      setError('Switch to AI Fill to extend the edges. Crop, Fit, and Stretch stay on this device.')
      return
    }
    if (!user) {
      setError('Log in with Kick to use AI fill.')
      return
    }
    if (aiAvailable === false) {
      setError('AI fill needs GEMINI_API, the same key the thumbnail generator uses. It is not set in this environment.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('banner-sizer')) {
      setError(`AI fill costs ${coinCost} coins. Purchase coins or subscribe for unlimited access.`)
      return
    }
    setBusy('ai')
    try {
      const res = await fetch('/api/banner-sizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          presetId: preset.id,
          imageDataUrl: sourceDataUrl(image),
          placement,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        covered?: boolean
        message?: string
        imageDataUrl?: string
        withinCap?: boolean
        bytes?: number
        code?: string
      }
      if (!res.ok) {
        if (data.code === 'missing_gemini_api') {
          setAiAvailable(false)
          setAiMissing('GEMINI_API')
        }
        throw new Error(data.error || 'AI fill failed.')
      }
      refreshBalance()
      if (data.covered || !data.imageDataUrl) {
        setNotice(data.message || 'This photo already covers the banner.')
        return
      }
      const key = frameKey(frame)
      setAi((current) => ({
        ...current,
        [preset.id]: {
          dataUrl: data.imageDataUrl!,
          frameKey: key,
          withinCap: data.withinCap !== false,
          bytes: data.bytes || 0,
        },
      }))
      const entry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'banner_sizer_fill',
        details: `AI fill for ${preset.name} ${preset.width}x${preset.height}`,
      }
      onActivityLog(entry)
      void postActivityLog({ username: user.username, action: entry.action, details: entry.details })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI fill failed.')
    } finally {
      setBusy(null)
    }
  }

  const downloadOne = async () => {
    if (!image) return
    setBusy('one')
    setError('')
    try {
      const result = await exportPreset(image, preset, frame, aiResult)
      downloadBytes(result.bytes, bannerExportFileName(preset), 'image/jpeg')
      if (!result.withinCap && preset.maxBytes) {
        setNotice(`Saved ${bannerExportFileName(preset)}, but it is still over the ${formatByteLimit(preset.maxBytes)} guide.`)
      } else if (frame.mode === 'ai' && !result.usedAi) {
        setNotice('AI fill has not been generated for this position, so the download is the unfilled placement.')
      } else {
        setNotice('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(null)
    }
  }

  const downloadZip = async () => {
    if (!image) return
    const chosen = BANNER_PRESETS.filter((item) => selected[item.id])
    if (chosen.length === 0) {
      setError('Select at least one preset for the zip.')
      return
    }
    setBusy('zip')
    setError('')
    try {
      const entries = []
      const skippedAi: string[] = []
      for (const item of chosen) {
        const itemFrame = frames[item.id] || defaultFrame(image.naturalWidth, image.naturalHeight, item.width, item.height)
        const result = await exportPreset(image, item, itemFrame, ai[item.id])
        if (itemFrame.mode === 'ai' && !result.usedAi) skippedAi.push(item.name)
        entries.push({ name: bannerExportFileName(item), data: result.bytes })
      }
      const zip = zipStore(entries)
      downloadBytes(zip, 'banner-sizer.zip', 'application/zip')
      setNotice(
        skippedAi.length
          ? `Zip saved. AI fill was not ready for ${skippedAi.join(', ')}, so those files use the unfilled placement.`
          : `Saved ${entries.length} banners.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zip export failed.')
    } finally {
      setBusy(null)
    }
  }

  const grouped = useMemo(
    () => [
      { id: 'streaming' as const, label: 'Streaming' },
      { id: 'social' as const, label: 'Social' },
    ],
    []
  )

  return (
    <div>
      <p className={`mx-auto mb-4 max-w-3xl text-center text-sm ${textClasses}`}>{description}</p>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              loadFile(event.dataTransfer.files?.[0] || null)
            }}
            className={`rounded-2xl border border-dashed p-3 text-center ${panel}`}
          >
            <ImageIcon className={`mx-auto mb-2 h-8 w-8 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
            <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {image ? 'Image ready' : 'Upload one image'}
            </p>
            <p className={`mb-3 text-xs ${muted}`}>JPG, PNG, WebP, or a still from a GIF.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {image ? 'Replace' : 'Pick image'}
              </Button>
              {image ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setImage(null)
                    setImageUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev)
                      return null
                    })
                    setAi({})
                    setIsGif(false)
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                loadFile(event.target.files?.[0] || null)
                event.target.value = ''
              }}
            />
          </div>

          {grouped.map((group) => (
            <div key={group.id} className={`rounded-2xl border p-2 ${panel}`}>
              <p className={`px-2 py-1 text-xs font-bold uppercase tracking-wide ${muted}`}>{group.label}</p>
              <div className="space-y-1">
                {bannerPresetsInGroup(group.id).map((item) => {
                  const active = item.id === preset.id
                  return (
                    <div key={item.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-2"
                        checked={selected[item.id] !== false}
                        aria-label={`Include ${item.name} in zip`}
                        onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.checked }))}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveId(item.id)}
                        className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left ${
                          active
                            ? 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black'
                            : darkMode
                              ? 'hover:bg-white/5'
                              : 'hover:bg-cyan-50'
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">{item.name}</span>
                        <span className={`block text-[11px] ${active ? 'text-black/70' : muted}`}>
                          {item.width}×{item.height} · {item.fileTypesShort}
                          {item.maxBytes ? ` · ${formatByteLimit(item.maxBytes)}` : ' · no published cap'}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className={`rounded-2xl border p-3 ${panel}`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{preset.name}</h4>
                <p className={`text-xs ${muted}`}>
                  {preset.width}×{preset.height} px · {sizeStatusLabel(preset.sizeStatus)} · {preset.fileTypes}
                </p>
                <p className={`text-xs ${muted}`}>{preset.maxBytesNote}</p>
              </div>
              <a className="text-xs text-sdhq-cyan-500 underline" href={preset.sourceUrl} target="_blank" rel="noreferrer">
                {preset.sourceLabel}
              </a>
            </div>
            <p className={`mb-3 text-sm ${textClasses}`}>{preset.summary}</p>

            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => updateFrame({ mode: mode.id })}
                  className={`rounded-xl border px-2 py-2 text-left text-sm ${
                    frame.mode === mode.id
                      ? 'border-transparent bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 font-semibold text-black'
                      : darkMode
                        ? 'border-white/10 text-white'
                        : 'border-sdhq-cyan-100 text-gray-800'
                  }`}
                >
                  {mode.label}
                  <span className={`mt-0.5 block text-[11px] font-normal ${frame.mode === mode.id ? 'text-black/70' : muted}`}>
                    {mode.hint}
                  </span>
                </button>
              ))}
            </div>

            <div
              ref={stageRef}
              tabIndex={0}
              role="application"
              aria-label="Banner canvas. Drag to reposition. Arrow keys nudge. Scroll to zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => {
                dragRef.current = null
              }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.04 : 0.012
                if (event.key === 'ArrowLeft') updateFrame({ panX: frame.panX - step })
                if (event.key === 'ArrowRight') updateFrame({ panX: frame.panX + step })
                if (event.key === 'ArrowUp') updateFrame({ panY: frame.panY - step })
                if (event.key === 'ArrowDown') updateFrame({ panY: frame.panY + step })
              }}
              className="relative mx-auto w-full max-w-3xl cursor-grab overflow-hidden rounded-xl bg-[#111114] outline outline-2 outline-sdhq-cyan-500/80"
              style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
            >
              {image && imageUrl && placement ? (
                <>
                  <div
                    className="absolute"
                    style={{
                      left: `${(placement.dx / preset.width) * 100}%`,
                      top: `${(placement.dy / preset.height) * 100}%`,
                      width: `${(placement.dw / preset.width) * 100}%`,
                      height: `${(placement.dh / preset.height) * 100}%`,
                      backgroundImage: `url("${imageUrl}")`,
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                    }}
                  />
                  <button
                    type="button"
                    data-logo="1"
                    aria-label="Text or logo marker"
                    className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sdhq-green-500 shadow"
                    style={{
                      left: `${((placement.dx + logo.x * placement.dw) / preset.width) * 100}%`,
                      top: `${((placement.dy + logo.y * placement.dh) / preset.height) * 100}%`,
                    }}
                  />
                  {views
                    .flatMap((view) => view.marks)
                    .filter((mark, index, all) => all.findIndex((other) => other.id === mark.id && other.tone === mark.tone) === index)
                    .map((mark) => (
                    <div
                      key={mark.id}
                      className={`pointer-events-none absolute border-2 border-dashed ${
                        mark.tone === 'safe' ? 'border-sdhq-green-400' : 'border-amber-400'
                      }`}
                      style={{
                        left: `${(mark.rect.x / preset.width) * 100}%`,
                        top: `${(mark.rect.y / preset.height) * 100}%`,
                        width: `${(mark.rect.width / preset.width) * 100}%`,
                        height: `${(mark.rect.height / preset.height) * 100}%`,
                      }}
                    />
                  ))}
                </>
              ) : (
                <div className="flex h-full min-h-40 items-center justify-center px-6 text-center text-sm text-white/70">
                  The crop box is the exact banner shape. Upload a photo to move it.
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className={`text-xs ${muted}`}>
                Zoom
                <input
                  className="ml-2 align-middle"
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.01}
                  value={frame.zoom}
                  onChange={(event) => updateFrame({ zoom: Number(event.target.value) })}
                />
              </label>
              <Button type="button" variant="outline" onClick={() => image && updateFrame(defaultFrame(image.naturalWidth, image.naturalHeight, preset.width, preset.height))}>
                Reset position
              </Button>
              <span className={`text-xs ${muted}`}>Drag the green dot onto your logo or title.</span>
            </div>
          </div>

          {isGif ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              Animated GIF export is not included. This uses the first frame and downloads a still JPEG. Club will not crop a GIF, so a moving Club banner still has to be sized before upload.
            </p>
          ) : null}
          {preset.sizeStatus === 'estimated' ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              Club does not publish a pixel size. 1134×567 is the banner file served on club.com/bulletbait604, and the preview follows that measured 2:1 header.
            </p>
          ) : null}
          {preset.sizeStatus === 'unpublished' ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              Twitch describes the offline player image but does not publish its pixel size. 1920×1080 is the standard player frame, not a number from the help page.
            </p>
          ) : null}

          {warnings.length > 0 ? (
            <ul className={`space-y-1 rounded-xl border px-3 py-2 text-sm ${panel}`}>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm">{error}</p> : null}
          {notice ? <p className={`rounded-xl border px-3 py-2 text-sm ${panel}`}>{notice}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={runAi} disabled={!image || busy !== null || frame.mode !== 'ai' || aiAvailable === false}>
              {busy === 'ai' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate AI fill{hasUnlimitedAccess ? '' : ` · ${coinCost} coins`}
            </Button>
            <Button type="button" variant="outline" onClick={downloadOne} disabled={!image || busy !== null}>
              {busy === 'one' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download this banner
            </Button>
            <Button type="button" variant="outline" onClick={downloadZip} disabled={!image || busy !== null}>
              {busy === 'zip' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crop className="mr-2 h-4 w-4" />}
              Download zip
            </Button>
          </div>
          {aiAvailable === false ? (
            <p className={`text-xs ${muted}`}>
              AI fill is off until {aiMissing || 'GEMINI_API'} is available. Crop, fit, stretch, and export still work. No new key was added.
            </p>
          ) : (
            <p className={`text-xs ${muted}`}>
              AI fill uses the thumbnail generator’s Gemini image model. Your original photo is pasted back on top so it is not stretched.
            </p>
          )}

          {frame.mode === 'ai' && imageUrl && placement ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CompareCard title="Before" darkMode={darkMode} note="Your photo, placed without stretching." width={preset.width} height={preset.height}>
                <StageImage imageUrl={imageUrl} preset={preset} placement={placement} />
              </CompareCard>
              <CompareCard
                title="After"
                darkMode={darkMode}
                width={preset.width}
                height={preset.height}
                note={aiMatches ? 'Generated edges, with your photo kept as-is.' : 'Generate AI fill to see the extended banner.'}
              >
                {aiMatches && aiResult ? (
                  <div
                    className="h-full w-full"
                    style={{ backgroundImage: `url("${aiResult.dataUrl}")`, backgroundSize: '100% 100%' }}
                    role="img"
                    aria-label="AI filled banner"
                  />
                ) : (
                  <div className={`flex h-full items-center justify-center text-xs ${muted}`}>No AI result yet</div>
                )}
              </CompareCard>
            </div>
          ) : null}

          <div className={`rounded-2xl border p-3 ${panel}`}>
            <div className="mb-2 flex items-center gap-2">
              <RectangleHorizontal className="h-4 w-4 text-sdhq-cyan-500" />
              <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>How this banner sits</h4>
            </div>
            {preset.id === 'youtube-channel' ? (
              <p className={`mb-3 text-xs ${muted}`}>{views[0]?.note}</p>
            ) : null}
            <div className={`grid gap-3 ${views.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {views.map((view) => (
                <ChannelMock key={view.id} darkMode={darkMode} preset={preset} view={view} imageUrl={imageUrl} placement={placement} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function bannerPresetById(id: string): BannerPreset {
  return BANNER_PRESETS.find((preset) => preset.id === id) || BANNER_PRESETS[0]!
}

function CompareCard({
  title,
  note,
  darkMode,
  width,
  height,
  children,
}: {
  title: string
  note: string
  darkMode: boolean
  width: number
  height: number
  children: ReactNode
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-white/10' : 'border-sdhq-cyan-100'}`}>
      <div className="px-3 py-2">
        <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</p>
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{note}</p>
      </div>
      <div className="relative bg-[#111114]" style={{ aspectRatio: `${width} / ${height}` }}>
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  )
}

function StageImage({
  imageUrl,
  preset,
  placement,
}: {
  imageUrl: string
  preset: BannerPreset
  placement: Placement
}) {
  return (
    <div className="relative h-full w-full bg-[#111114]">
      <div
        className="absolute"
        style={{
          left: `${(placement.dx / preset.width) * 100}%`,
          top: `${(placement.dy / preset.height) * 100}%`,
          width: `${(placement.dw / preset.width) * 100}%`,
          height: `${(placement.dh / preset.height) * 100}%`,
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: '100% 100%',
        }}
      />
    </div>
  )
}

function ChannelMock({
  darkMode,
  preset,
  view,
  imageUrl,
  placement,
}: {
  darkMode: boolean
  preset: BannerPreset
  view: PreviewFrame
  imageUrl: string | null
  placement: Placement | null
}) {
  const windowRect = view.window || { x: 0, y: 0, width: preset.width, height: preset.height }
  return (
    <div>
      <p className={`mb-1 text-xs font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{view.label}</p>
      <div className={`overflow-hidden rounded-xl border ${darkMode ? 'border-white/10 bg-black' : 'border-gray-200 bg-gray-950'}`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="h-6 w-6 rounded-full bg-sdhq-cyan-500" />
          <span className="text-xs text-white/80">Your channel</span>
        </div>
        <div className="relative overflow-hidden bg-[#111114]" style={{ aspectRatio: `${windowRect.width} / ${windowRect.height}` }}>
          <div
            className="absolute"
            style={{
              width: `${(preset.width / windowRect.width) * 100}%`,
              height: `${(preset.height / windowRect.height) * 100}%`,
              left: `${(-windowRect.x / windowRect.width) * 100}%`,
              top: `${(-windowRect.y / windowRect.height) * 100}%`,
            }}
          >
            {imageUrl && placement ? (
              <div
                className="absolute"
                style={{
                  left: `${(placement.dx / preset.width) * 100}%`,
                  top: `${(placement.dy / preset.height) * 100}%`,
                  width: `${(placement.dw / preset.width) * 100}%`,
                  height: `${(placement.dh / preset.height) * 100}%`,
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundSize: '100% 100%',
                }}
              />
            ) : null}
            {view.marks.map((mark) => (
              <div
                key={mark.id}
                className={`absolute border-2 border-dashed ${mark.tone === 'safe' ? 'border-sdhq-green-400' : 'border-amber-300'}`}
                style={{
                  left: `${(mark.rect.x / preset.width) * 100}%`,
                  top: `${(mark.rect.y / preset.height) * 100}%`,
                  width: `${(mark.rect.width / preset.width) * 100}%`,
                  height: `${(mark.rect.height / preset.height) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      {preset.id === 'youtube-channel' ? null : <p className={`mt-1 text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{view.note}</p>}
    </div>
  )
}
