'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Download, Image as ImageIcon, Loader2, Smile, Upload, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { postActivityLog } from '@/lib/home/activityLogUtils'
import type { ActivityLogEntry } from '@/lib/home/types'
import { COIN_COSTS, type ToolType } from '@/hooks/useCoins'
import { zipStore } from '@/lib/bannerSizer/zipStore'
import { canvasHasTransparency, encodeEmoteUnderCap, paintEmote } from '@/lib/emoteMaker/canvasExport'
import { containZoom, defaultEmoteFrame, type EmoteFrame } from '@/lib/emoteMaker/placement'
import {
  ANIMATION_NOTE,
  EMOTE_PRESETS,
  OMITTED_EMOTE_PLATFORMS,
  byteCapLabel,
  emoteExportFileName,
  emotePreset,
  emotePresetsInGroup,
  outputSizeLabel,
  type EmoteGroup,
  type EmotePreset,
} from '@/lib/emoteMaker/presets'
import { EMOTE_STYLES, type EmoteStyleId } from '@/lib/emoteMaker/prompt'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const CHAT_SIZES = [28, 56, 112] as const
const PREVIEW_SIZE = 512

export interface EmoteMakerTabProps {
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

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That image could not be opened.'))
    image.src = src
  })
}

function referenceDataUrl(image: HTMLImageElement): string {
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.84)
}

function paintCanvas(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
  size: number,
  frame: EmoteFrame,
  crisp: boolean
) {
  if (!canvas) return
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  paintEmote(ctx, image, image.naturalWidth, image.naturalHeight, size, frame, crisp)
}

export default function EmoteMakerTab({
  darkMode,
  textClasses,
  subtitleClasses,
  description,
  user,
  hasEnoughCoins,
  hasUnlimitedAccess,
  refreshBalance,
  onActivityLog,
}: EmoteMakerTabProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const chatRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const blobsRef = useRef<string[]>([])
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState<EmoteStyleId>('sticker')
  const [transparent, setTransparent] = useState(true)
  const [crisp, setCrisp] = useState(false)
  const [reference, setReference] = useState<HTMLImageElement | null>(null)
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  const [artSource, setArtSource] = useState<'generated' | 'upload' | null>(null)
  const [frame, setFrame] = useState<EmoteFrame>(defaultEmoteFrame())
  const [activeId, setActiveId] = useState(EMOTE_PRESETS[0]!.id)
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EMOTE_PRESETS.map((preset) => [preset.id, true]))
  )
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [aiMissing, setAiMissing] = useState<string | null>(null)
  const [busy, setBusy] = useState<'generate' | 'one' | 'zip' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [backgroundRemoved, setBackgroundRemoved] = useState<boolean | null>(null)
  const [hasAlpha, setHasAlpha] = useState(false)

  const preset = emotePreset(activeId) || EMOTE_PRESETS[0]!
  const coinCost = COIN_COSTS['emote-maker']
  const panel = darkMode ? 'border-white/10 bg-sdhq-dark-900/70' : 'border-sdhq-cyan-100 bg-white'
  const muted = subtitleClasses
  const groups = useMemo(
    () =>
      [
        { id: 'streaming' as const, label: 'Streaming' },
        { id: 'chat' as const, label: 'Chat apps' },
        { id: 'badges' as const, label: 'Badges' },
      ] satisfies Array<{ id: EmoteGroup; label: string }>,
    []
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/emote-maker', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
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
    const blobs = blobsRef.current
    return () => {
      for (const url of blobs) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    if (!art) {
      setHasAlpha(false)
      return
    }
    setHasAlpha(canvasHasTransparency(art, art.naturalWidth, art.naturalHeight))
    paintCanvas(previewRef.current, art, PREVIEW_SIZE, frame, crisp)
    for (const tone of ['dark', 'light']) {
      for (const size of CHAT_SIZES) {
        paintCanvas(chatRefs.current[`${tone}-${size}`] || null, art, size, frame, crisp || size <= 28)
      }
    }
  }, [art, frame, crisp])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (event: WheelEvent) => {
      if (!art) return
      event.preventDefault()
      setFrame((current) => ({
        ...current,
        zoom: Math.min(6, Math.max(0.2, current.zoom * (event.deltaY < 0 ? 1.06 : 0.94))),
      }))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [art])

  const readUpload = async (file: File | null) => {
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
    blobsRef.current.push(url)
    try {
      const image = await loadHtmlImage(url)
      setReferenceUrl(url)
      setReference(image)
      if (file.type === 'image/gif') {
        setNotice('GIF uploads use the first frame. Animated export is not included.')
      }
    } catch (err) {
      URL.revokeObjectURL(url)
      setError(err instanceof Error ? err.message : 'That image could not be opened.')
    }
  }

  const useUploadAsArt = () => {
    if (!reference || !referenceUrl) {
      setError('Upload an image to resize.')
      return
    }
    setArt(reference)
    setArtSource('upload')
    setFrame(defaultEmoteFrame())
    setCrisp(false)
    setBackgroundRemoved(null)
    setError('')
    setNotice('Resizing the upload. Nothing was generated and no coins were spent.')
  }

  const generate = async () => {
    setError('')
    setNotice('')
    if (!prompt.trim()) {
      setError('Describe the emote before generating.')
      return
    }
    if (!user) {
      setError('Log in with Kick to generate an emote.')
      return
    }
    if (aiAvailable === false) {
      setError('Generation needs GEMINI_API, the same key the thumbnail generator uses. It is not set in this environment.')
      return
    }
    if (!hasUnlimitedAccess && !hasEnoughCoins('emote-maker')) {
      setError(`Generating an emote costs ${coinCost} coins. Purchase coins or subscribe for unlimited access.`)
      return
    }
    setBusy('generate')
    try {
      const res = await fetch('/api/emote-maker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt,
          style,
          transparent,
          referenceImageDataUrl: reference ? referenceDataUrl(reference) : undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        code?: string
        imageDataUrl?: string
        backgroundRemoved?: boolean
      }
      if (!res.ok || !data.imageDataUrl) {
        if (data.code === 'missing_gemini_api') {
          setAiAvailable(false)
          setAiMissing('GEMINI_API')
        }
        throw new Error(data.error || 'Emote generation failed.')
      }
      const image = await loadHtmlImage(data.imageDataUrl)
      setArt(image)
      setArtSource('generated')
      setFrame(defaultEmoteFrame())
      setCrisp(style === 'pixel')
      setBackgroundRemoved(Boolean(data.backgroundRemoved))
      refreshBalance()
      const entry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'emote_generation',
        details: `Emote: ${prompt.trim().slice(0, 80)}`,
      }
      onActivityLog(entry)
      void postActivityLog({ username: user.username, action: entry.action, details: entry.details })
      setNotice(
        data.backgroundRemoved
          ? 'Emote ready. Drag the square to crop it, then export the platforms you need.'
          : 'Emote ready, but the background was not a flat color that could be removed. You can crop it or turn transparency off and generate again.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Emote generation failed.')
    } finally {
      setBusy(null)
    }
  }

  const encodePreset = async (item: EmotePreset) => {
    if (!art) throw new Error('Make or upload an emote first.')
    const files: Array<{ name: string; data: Uint8Array; withinCap: boolean }> = []
    for (const output of item.outputs) {
      const encoded = await encodeEmoteUnderCap({
        image: art,
        srcW: art.naturalWidth,
        srcH: art.naturalHeight,
        size: output.width,
        frame,
        crisp: crisp || output.width <= 32,
        maxBytes: item.maxBytes,
        byteCap: item.byteCap,
        allowWebp: item.allowsWebpFallback,
      })
      files.push({
        name: emoteExportFileName(item, output, encoded.extension),
        data: encoded.bytes,
        withinCap: encoded.withinCap,
      })
    }
    return files
  }

  const downloadOne = async () => {
    if (!art) return
    setBusy('one')
    setError('')
    try {
      const files = await encodePreset(preset)
      if (files.length === 1) {
        downloadBytes(files[0]!.data, files[0]!.name, files[0]!.name.endsWith('.webp') ? 'image/webp' : 'image/png')
      } else {
        downloadBytes(
          zipStore(files.map((file) => ({ name: file.name, data: file.data }))),
          `${preset.fileSlug}.zip`,
          'application/zip'
        )
      }
      const over = files.filter((file) => !file.withinCap).map((file) => file.name)
      setNotice(
        over.length
          ? `Saved ${preset.name}, but ${over.join(', ')} is still over the published file-size cap.`
          : `Saved ${preset.name} (${files.map((file) => file.name).join(', ')}).`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setBusy(null)
    }
  }

  const downloadZip = async () => {
    if (!art) return
    const chosen = EMOTE_PRESETS.filter((item) => selected[item.id])
    if (chosen.length === 0) {
      setError('Select at least one preset for the zip.')
      return
    }
    setBusy('zip')
    setError('')
    try {
      const entries: Array<{ name: string; data: Uint8Array }> = []
      const over: string[] = []
      for (const item of chosen) {
        const files = await encodePreset(item)
        for (const file of files) {
          entries.push({ name: file.name, data: file.data })
          if (!file.withinCap) over.push(file.name)
        }
      }
      downloadBytes(zipStore(entries), 'emote-maker.zip', 'application/zip')
      setNotice(
        over.length
          ? `Saved ${entries.length} files. Still over the cap: ${over.join(', ')}.`
          : `Saved ${entries.length} files for ${chosen.length} presets.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zip export failed.')
    } finally {
      setBusy(null)
    }
  }

  const startOver = () => {
    setPrompt('')
    setStyle('sticker')
    setTransparent(true)
    setCrisp(false)
    setReference(null)
    setReferenceUrl(null)
    setArt(null)
    setArtSource(null)
    setFrame(defaultEmoteFrame())
    setBackgroundRemoved(null)
    setError('')
    setNotice('')
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!art) return
    dragRef.current = { x: event.clientX, y: event.clientY, panX: frame.panX, panY: frame.panY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const rect = stage.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    setFrame((current) => ({
      ...current,
      panX: drag.panX + (event.clientX - drag.x) / rect.width,
      panY: drag.panY + (event.clientY - drag.y) / rect.height,
    }))
  }

  const nudge = (panX: number, panY: number) => {
    setFrame((current) => ({ ...current, panX: current.panX + panX, panY: current.panY + panY }))
  }

  return (
    <div>
      <p className={`mx-auto mb-4 max-w-3xl text-center text-sm ${textClasses}`}>{description}</p>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className={`rounded-2xl border p-3 ${panel}`}>
            <label htmlFor="emote-prompt" className={`mb-1 block text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Emote prompt
            </label>
            <textarea
              id="emote-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={800}
              rows={4}
              placeholder="A cheerful frog in a tiny crown, waving"
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                darkMode
                  ? 'border-white/10 bg-black/30 text-white placeholder:text-white/40'
                  : 'border-sdhq-cyan-100 bg-white text-gray-900'
              }`}
            />
            <p className={`mt-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>Style</p>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {EMOTE_STYLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={style === item.id}
                  onClick={() => setStyle(item.id)}
                  className={`rounded-xl px-2 py-1.5 text-sm ${
                    style === item.id
                      ? 'bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 font-semibold text-black'
                      : darkMode
                        ? 'bg-white/5 text-white'
                        : 'bg-cyan-50 text-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className={`mt-3 flex items-center gap-2 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <input type="checkbox" checked={transparent} onChange={(event) => setTransparent(event.target.checked)} />
              Transparent background
            </label>
            <label className={`mt-2 flex items-center gap-2 text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <input type="checkbox" checked={crisp} onChange={(event) => setCrisp(event.target.checked)} />
              Sharp pixels when scaled down
            </label>
          </div>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              void readUpload(event.dataTransfer.files?.[0] || null)
            }}
            className={`rounded-2xl border border-dashed p-3 text-center ${panel}`}
          >
            <ImageIcon className={`mx-auto mb-2 h-8 w-8 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
            <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {reference ? 'Reference ready' : 'Optional reference'}
            </p>
            <p className={`mb-3 text-xs ${muted}`}>JPG, PNG, WebP, or the first frame of a GIF. It guides subject, colors, and style.</p>
            {referenceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={referenceUrl} alt="Reference" className="mx-auto mb-3 h-16 w-16 rounded-lg object-cover" />
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {reference ? 'Replace' : 'Upload'}
              </Button>
              <Button type="button" variant="outline" onClick={useUploadAsArt} disabled={!reference || busy !== null}>
                Resize this image
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                void readUpload(event.target.files?.[0] || null)
                event.target.value = ''
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void generate()} disabled={busy !== null || aiAvailable === false || !prompt.trim()}>
              {busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {artSource === 'generated' ? 'Regenerate' : 'Generate emote'}
              {hasUnlimitedAccess ? '' : ` (${coinCost} coins)`}
            </Button>
            <Button type="button" variant="outline" onClick={startOver}>
              <X className="mr-2 h-4 w-4" />
              Start over
            </Button>
          </div>
          <p className={`text-xs ${muted}`}>{ANIMATION_NOTE}</p>
          {aiAvailable === false ? (
            <p className={`text-xs ${muted}`}>
              Generate is off until {aiMissing || 'GEMINI_API'} is available. Resize and export still work on an uploaded image. No new key was added.
            </p>
          ) : (
            <p className={`text-xs ${muted}`}>
              Generate uses the same Gemini image model as the thumbnail generator. Log in with Kick. Resize and export do not spend coins.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.id} className={`rounded-2xl border p-2 ${panel}`}>
              <p className={`px-2 py-1 text-xs font-bold uppercase tracking-wide ${muted}`}>
                {group.label}
                {group.id === 'badges' ? ' · not emotes' : ''}
              </p>
              <div className="space-y-1">
                {emotePresetsInGroup(group.id).map((item) => {
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
                        <span className={`block text-[11px] leading-snug ${active ? 'text-black/70' : muted}`}>
                          {outputSizeLabel(item)} · PNG · {byteCapLabel(item)}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <p className={`text-xs ${muted}`}>
            {OMITTED_EMOTE_PLATFORMS.map((item) => `${item.name}: ${item.reason}`).join(' ')}
          </p>
        </div>

        <div className="space-y-3">
          <div className={`rounded-2xl border p-3 ${panel}`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className={`flex items-center gap-2 text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Smile className="h-5 w-5" />
                  {preset.name}
                  {preset.kind === 'badge' ? <span className="text-xs font-semibold uppercase">Badge</span> : null}
                </h4>
                <p className={`text-xs ${muted}`}>
                  {outputSizeLabel(preset)} px · {preset.formats} · {byteCapLabel(preset)}
                </p>
                <p className={`text-xs ${muted}`}>{preset.maxBytesNote}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <a className="text-xs text-sdhq-cyan-500 underline" href={preset.sourceUrl} target="_blank" rel="noreferrer">
                  {preset.sourceLabel}
                </a>
                {preset.alsoSourceUrl ? (
                  <a className="text-xs text-sdhq-cyan-500 underline" href={preset.alsoSourceUrl} target="_blank" rel="noreferrer">
                    {preset.alsoSourceLabel}
                  </a>
                ) : null}
              </div>
            </div>
            <p className={`mb-3 text-sm ${textClasses}`}>{preset.summary}</p>

            <div
              ref={stageRef}
              tabIndex={0}
              role="application"
              aria-label="Emote crop. Drag to nudge. Arrow keys nudge. Scroll to zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => {
                dragRef.current = null
              }}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 0.04 : 0.012
                if (event.key === 'ArrowLeft') nudge(-step, 0)
                if (event.key === 'ArrowRight') nudge(step, 0)
                if (event.key === 'ArrowUp') nudge(0, -step)
                if (event.key === 'ArrowDown') nudge(0, step)
              }}
              className="relative mx-auto w-full max-w-md touch-none cursor-grab overflow-hidden rounded-xl outline outline-2 outline-sdhq-cyan-500/80"
              style={{
                aspectRatio: '1 / 1',
                backgroundColor: darkMode ? '#111114' : '#e7e7ea',
                backgroundImage:
                  'linear-gradient(45deg, rgba(127,127,127,0.28) 25%, transparent 25%), linear-gradient(-45deg, rgba(127,127,127,0.28) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(127,127,127,0.28) 75%), linear-gradient(-45deg, transparent 75%, rgba(127,127,127,0.28) 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
              }}
            >
              {art ? (
                <canvas ref={previewRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE} className="block h-full w-full" />
              ) : (
                <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-sm text-white/80">
                  Generate an emote, or upload art and choose Resize this image. Then drag it inside the square.
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
                  aria-label="Zoom emote"
                  onChange={(event) => setFrame((current) => ({ ...current, zoom: Number(event.target.value) }))}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => art && setFrame({ zoom: containZoom(art.naturalWidth, art.naturalHeight), panX: 0, panY: 0 })}
                disabled={!art}
              >
                Show all
              </Button>
              <Button type="button" variant="outline" onClick={() => setFrame(defaultEmoteFrame())} disabled={!art}>
                Reset crop
              </Button>
            </div>
          </div>

          <div className={`rounded-2xl border p-3 ${panel}`}>
            <h4 className={`mb-2 text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chat size</h4>
            <p className={`mb-3 text-xs ${muted}`}>Actual pixels on a dark chat and a light chat: 28, 56, and 112.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['dark', '#0e0e10', '#efeff1', 'Dark chat'],
                ['light', '#f7f7f8', '#1f1f23', 'Light chat'],
              ] as const).map(([tone, background, color, label]) => (
                <div key={tone} className="rounded-xl p-3" style={{ backgroundColor: background, color }}>
                  <p className="mb-2 text-xs font-semibold">{label}</p>
                  <div className="flex items-end gap-4">
                    {CHAT_SIZES.map((size) => (
                      <div key={size} className="text-center">
                        <canvas
                          ref={(node) => {
                            chatRefs.current[`${tone}-${size}`] = node
                          }}
                          width={size}
                          height={size}
                          aria-label={`${label} preview at ${size} pixels`}
                          style={{ width: size, height: size }}
                          className="mx-auto bg-transparent"
                        />
                        <p className="mt-1 text-[10px]">{size}px</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {preset.requiresTransparency && art && !hasAlpha ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              {preset.name} asks for a transparent background. This image still has a solid background.
            </p>
          ) : null}
          {backgroundRemoved === false && artSource === 'generated' ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              The model did not leave a flat background, so it was not removed. Crop tighter or generate again with transparency on.
            </p>
          ) : null}
          {error ? <p className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm">{error}</p> : null}
          {notice ? <p className={`rounded-xl border px-3 py-2 text-sm ${panel}`}>{notice}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void downloadOne()} disabled={!art || busy !== null}>
              {busy === 'one' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download this preset
            </Button>
            <Button type="button" variant="outline" onClick={() => void downloadZip()} disabled={!art || busy !== null}>
              {busy === 'zip' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download selected zip
            </Button>
          </div>
          <p className={`text-xs ${muted}`}>
            A preset with more than one size, including Twitch 112, 56, and 28, downloads as a zip. The selected zip includes every checked preset.
          </p>
        </div>
      </div>
    </div>
  )
}
