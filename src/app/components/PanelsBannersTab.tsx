'use client'

import { useMemo, useRef, useState } from 'react'
import NextImage from 'next/image'
import {
  Download,
  ImageIcon,
  Loader2,
  PanelsTopLeft,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PANELS_BANNERS_PLATFORMS,
  PREMADE_PANEL_TITLES,
  MAX_PANEL_TITLES,
  MAX_CUSTOM_PANEL_TITLE_CHARS,
  type PanelsBannersOutputMode,
  type PanelsBannersPlatformId,
} from '@/lib/panelsBanners/platforms'
import type { KickUser } from '@/lib/home/types'

type GeneratedAsset = {
  kind: 'banner' | 'panel'
  label: string
  width: number
  height: number
  mimeType: string
  dataUrl: string
  panelIndex?: number
  panelTitle?: string
}

type MockupResult = {
  id: 'mockup-a' | 'mockup-b'
  title: string
  styleBrief: string
  assets: GeneratedAsset[]
}

type ResearchResult = {
  platformId: string
  platformName: string
  banner: { width: number; height: number; label: string; notes?: string }
  panel: { width: number; height: number; label: string; notes?: string }
  panelCount: number
  researchNotes: string
  sourcesNote: string
  model: string
}

type GenerateResponse = {
  research: ResearchResult
  mockups: MockupResult[]
  outputMode: PanelsBannersOutputMode
  imageModel: string
  textModel: string
  error?: string
  userMessage?: string
}

type RefSlot = {
  id: string
  file: File
  dataUrl: string
  mimeType: string
}

export interface PanelsBannersTabProps {
  darkMode: boolean
  subtitleClasses: string
  user: KickUser | null
}

const MAX_REFS = 3
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export default function PanelsBannersTab({
  darkMode,
  subtitleClasses,
  user,
}: PanelsBannersTabProps) {
  const [platformId, setPlatformId] = useState<PanelsBannersPlatformId>('kick')
  const [outputMode, setOutputMode] = useState<PanelsBannersOutputMode>('both')
  const [selectedPanelTitles, setSelectedPanelTitles] = useState<string[]>(['About Me', 'Socials'])
  const [customPanelTitle, setCustomPanelTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [refs, setRefs] = useState<RefSlot[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const needsPanels = outputMode === 'panels' || outputMode === 'both'

  const platform = useMemo(
    () => PANELS_BANNERS_PLATFORMS.find((p) => p.id === platformId)!,
    [platformId]
  )

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500'
  const chipIdle = darkMode
    ? 'border-sdhq-dark-600 bg-sdhq-dark-900 text-gray-200 hover:border-sdhq-cyan-500/50'
    : 'border-gray-300 bg-white text-gray-800 hover:border-sdhq-cyan-400'
  const chipActive = 'border-sdhq-cyan-500 bg-sdhq-cyan-500/15 text-sdhq-cyan-400'

  const addFiles = (fileList: FileList | File[] | null) => {
    if (!fileList) return
    setError('')
    setResult(null)
    const incoming = Array.from(fileList)

    for (const file of incoming) {
      if (!file.type.startsWith('image/')) {
        setError('Reference files must be images (PNG, JPG, WebP).')
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('Each reference image must be under 8MB.')
        continue
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result !== 'string') return
        setRefs((prev) => {
          if (prev.length >= MAX_REFS) return prev
          if (prev.some((r) => r.file.name === file.name && r.file.size === file.size)) {
            return prev
          }
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

  const removeRef = (id: string) => {
    setRefs((prev) => prev.filter((r) => r.id !== id))
    setResult(null)
  }

  const togglePremadeTitle = (title: string) => {
    setResult(null)
    setSelectedPanelTitles((prev) => {
      if (prev.some((t) => t.toLowerCase() === title.toLowerCase())) {
        return prev.filter((t) => t.toLowerCase() !== title.toLowerCase())
      }
      if (prev.length >= MAX_PANEL_TITLES) {
        setError(`You can select up to ${MAX_PANEL_TITLES} panels.`)
        return prev
      }
      setError('')
      return [...prev, title]
    })
  }

  const addCustomTitle = () => {
    const title = customPanelTitle.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_PANEL_TITLE_CHARS)
    if (!title) return
    if (selectedPanelTitles.some((t) => t.toLowerCase() === title.toLowerCase())) {
      setError('That panel title is already selected.')
      return
    }
    if (selectedPanelTitles.length >= MAX_PANEL_TITLES) {
      setError(`You can select up to ${MAX_PANEL_TITLES} panels.`)
      return
    }
    setError('')
    setResult(null)
    setSelectedPanelTitles((prev) => [...prev, title])
    setCustomPanelTitle('')
  }

  const removePanelTitle = (title: string) => {
    setResult(null)
    setSelectedPanelTitles((prev) => prev.filter((t) => t !== title))
  }

  const resetAll = () => {
    setPrompt('')
    setRefs([])
    setSelectedPanelTitles(['About Me', 'Socials'])
    setCustomPanelTitle('')
    setResult(null)
    setError('')
    setLoadingStep('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadAsset = (asset: GeneratedAsset, mockupId: string) => {
    const ext = asset.mimeType.includes('png') ? 'png' : 'jpg'
    const slug = (asset.panelTitle || asset.kind)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const a = document.createElement('a')
    a.href = asset.dataUrl
    a.download = `pb-${platformId}-${mockupId}-${slug || asset.kind}.${ext}`
    a.click()
  }

  const handleGenerate = async () => {
    if (!user) {
      setError('Login required.')
      return
    }
    if (refs.length === 0) {
      setError('Upload 1–3 reference images.')
      return
    }
    if (needsPanels && selectedPanelTitles.length === 0) {
      setError('Select at least one panel title.')
      return
    }

    setIsWorking(true)
    setError('')
    setResult(null)
    setLoadingStep('Researching platform banner & panel sizes…')

    try {
      const res = await fetch('/api/panels-banners/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platformId,
          outputMode,
          prompt,
          panelTitles: needsPanels ? selectedPanelTitles : [],
          references: refs.map((r) => ({
            base64: r.dataUrl,
            mimeType: r.mimeType,
          })),
        }),
      })

      setLoadingStep(
        needsPanels
          ? `Painting mockups (${selectedPanelTitles.length} panel${selectedPanelTitles.length === 1 ? '' : 's'} × 2 styles)…`
          : 'Painting banner mockups with Gemini…'
      )
      const data = (await res.json()) as GenerateResponse
      if (!res.ok) {
        throw new Error(data.userMessage || data.error || 'Generation failed')
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsWorking(false)
      setLoadingStep('')
    }
  }

  const modeOptions: { id: PanelsBannersOutputMode; label: string; hint: string }[] = [
    { id: 'banner', label: 'Banner only', hint: 'Offline / profile banner' },
    { id: 'panels', label: 'Panels only', hint: 'Info panels / feature cards' },
    { id: 'both', label: 'Banner + panels', hint: 'Full channel kit' },
  ]

  return (
    <div className="space-y-6">
      <p className={`text-sm ${subtitleClasses}`}>
        Pick a streaming platform, upload up to 3 references, describe the brand, then Gemini
        researches official sizing and paints <strong>two very different mockups</strong>.
      </p>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
          Platform
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PANELS_BANNERS_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlatformId(p.id)
                setResult(null)
              }}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                platformId === p.id ? chipActive : chipIdle
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className={`text-xs ${subtitleClasses}`}>
          Defaults — banner {platform.banner.width}×{platform.banner.height}, panel{' '}
          {platform.panel.width}×{platform.panel.height}. Gemini will verify before painting.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
          Output
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {modeOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setOutputMode(m.id)
                setResult(null)
              }}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                outputMode === m.id ? chipActive : chipIdle
              }`}
            >
              <div className="text-sm font-semibold">{m.label}</div>
              <div className={`text-xs mt-0.5 ${subtitleClasses}`}>{m.hint}</div>
            </button>
          ))}
        </div>
      </section>

      {needsPanels && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <h4
              className={`text-sm font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
            >
              Panel titles
            </h4>
            <p className={`text-xs ${subtitleClasses}`}>
              {selectedPanelTitles.length}/{MAX_PANEL_TITLES} selected · one art piece each × 2 mockups
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PREMADE_PANEL_TITLES.map((title) => {
              const active = selectedPanelTitles.some(
                (t) => t.toLowerCase() === title.toLowerCase()
              )
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => togglePremadeTitle(title)}
                  className={`rounded-full border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                    active ? chipActive : chipIdle
                  }`}
                >
                  {title}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customPanelTitle}
              onChange={(e) => setCustomPanelTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomTitle()
                }
              }}
              maxLength={MAX_CUSTOM_PANEL_TITLE_CHARS}
              placeholder="Custom panel title…"
              className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${inputShell}`}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addCustomTitle}
              disabled={!customPanelTitle.trim() || selectedPanelTitles.length >= MAX_PANEL_TITLES}
            >
              Add custom
            </Button>
          </div>
          {selectedPanelTitles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPanelTitles.map((title) => (
                <span
                  key={title}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                    darkMode
                      ? 'border-sdhq-cyan-500/40 bg-sdhq-cyan-500/10 text-sdhq-cyan-300'
                      : 'border-sdhq-cyan-300 bg-sdhq-cyan-50 text-sdhq-cyan-800'
                  }`}
                >
                  {title}
                  <button
                    type="button"
                    onClick={() => removePanelTitle(title)}
                    className="rounded-full p-0.5 hover:bg-black/20"
                    aria-label={`Remove ${title}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}>
          Reference images (up to {MAX_REFS})
        </h4>
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
              <div key={r.id} className="relative w-24 h-24 rounded-lg overflow-hidden border border-cyan-500/40">
                <NextImage src={r.dataUrl} alt="" fill className="object-cover" unoptimized />
                <button
                  type="button"
                  onClick={() => removeRef(r.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 text-white"
                  aria-label="Remove reference"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {refs.length < MAX_REFS && (
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
          <p className={`text-xs ${subtitleClasses}`}>PNG, JPG, or WebP · max 8MB each</p>
        </div>
      </section>

      <section className="space-y-2">
        <label
          className={`block text-sm font-semibold ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`}
        >
          Brand prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. Cozy variety streamer, fox mascot, soft purple + cream, schedule Tue/Thu/Sat 7pm PT…"
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputShell}`}
        />
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
          disabled={isWorking || refs.length === 0 || (needsPanels && selectedPanelTitles.length === 0)}
          className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
        >
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <PanelsTopLeft className="w-4 h-4 mr-2" />
              Generate 2 mockups
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={resetAll} disabled={isWorking}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      </div>

      {isWorking && loadingStep && (
        <p className={`text-sm flex items-center gap-2 ${subtitleClasses}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingStep}
        </p>
      )}

      {result && (
        <div className="space-y-6 pt-2">
          <section
            className={`rounded-xl border p-4 ${
              darkMode ? 'border-sdhq-dark-600 bg-sdhq-dark-900/50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <h4 className={`text-sm font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Size research — {result.research.platformName}
            </h4>
            <p className={`text-sm mb-2 ${subtitleClasses}`}>{result.research.researchNotes}</p>
            <ul className={`text-xs space-y-1 ${subtitleClasses}`}>
              <li>
                Banner: {result.research.banner.width}×{result.research.banner.height} —{' '}
                {result.research.banner.label}
              </li>
              <li>
                Panel: {result.research.panel.width}×{result.research.panel.height} —{' '}
                {result.research.panel.label} × {result.research.panelCount}
              </li>
              <li>{result.research.sourcesNote}</li>
              <li>
                Models: {result.textModel} (research) · {result.imageModel} (paint)
              </li>
            </ul>
          </section>

          {result.mockups.map((mockup) => (
            <section key={mockup.id} className="space-y-3">
              <div>
                <h4 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {mockup.title}
                </h4>
                <p className={`text-sm ${subtitleClasses}`}>{mockup.styleBrief}</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {mockup.assets.map((asset) => (
                  <div
                    key={`${mockup.id}-${asset.kind}-${asset.panelIndex ?? 0}`}
                    className={`rounded-xl border overflow-hidden ${
                      darkMode ? 'border-sdhq-dark-600' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-inherit">
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            darkMode ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {asset.label}
                        </div>
                        <div className={`text-xs ${subtitleClasses}`}>
                          Target {asset.width}×{asset.height}
                          {asset.kind === 'banner' ? ' · banner' : ' · panel'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadAsset(asset, mockup.id)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Save
                      </Button>
                    </div>
                    <div
                      className={`relative w-full bg-black/40 ${
                        asset.kind === 'banner' ? 'aspect-video' : 'aspect-[4/5] max-w-xs mx-auto'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.dataUrl}
                        alt={asset.label}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {result.mockups.every((m) => m.assets.length === 0) && (
            <p className={`text-sm flex items-center gap-2 ${subtitleClasses}`}>
              <ImageIcon className="w-4 h-4" />
              No assets returned.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
