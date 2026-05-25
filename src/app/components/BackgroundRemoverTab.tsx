'use client'

import { useRef, useState } from 'react'
import NextImage from 'next/image'
import { Download, Image as ImageIcon, Loader2, RotateCcw, Scissors, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
type BackgroundRemoverResult = {
  imageUrl: string
  mimeType?: string
  fileName?: string
  width?: number | null
  height?: number | null
  model?: string
  cropApplied?: boolean
  promptNote?: string | null
}

export interface BackgroundRemoverTabProps {
  darkMode: boolean
  cardClasses: string
  textClasses: string
  subtitleClasses: string
  title: string
  description: string
  user: { username: string } | null
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export default function BackgroundRemoverTab({
  darkMode,
  cardClasses,
  textClasses,
  subtitleClasses,
  title,
  description,
  user,
}: BackgroundRemoverTabProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [keepPrompt, setKeepPrompt] = useState('')
  const [cropToSubject, setCropToSubject] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BackgroundRemoverResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-cyan-500/30 text-gray-200 placeholder-gray-500'
    : 'bg-white border-sdhq-cyan-300 text-gray-900 placeholder-gray-400'
  const panelClasses = darkMode
    ? 'bg-sdhq-dark-800/80 border-sdhq-dark-600'
    : 'bg-gray-50 border-sdhq-cyan-200'

  const clearImage = () => {
    setImageFile(null)
    setImageDataUrl(null)
    setResult(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const loadImageFile = (file: File | null) => {
    setError('')
    setResult(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPG, or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image is too large. Use an image under 10MB.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageFile(file)
      setImageDataUrl(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => setError('Could not read that image.')
    reader.readAsDataURL(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    loadImageFile(event.dataTransfer.files?.[0] || null)
  }

  const removeBackground = async () => {
    setError('')
    setResult(null)
    if (!user) {
      setError('Log in with Kick first.')
      return
    }
    if (!imageDataUrl) {
      setError('Upload an image first.')
      return
    }

    setIsRemoving(true)
    try {
      const res = await fetch('/api/background-remover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageDataUrl,
          keepPrompt: keepPrompt.trim() || undefined,
          cropToSubject,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as BackgroundRemoverResult & {
        error?: string
      }
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Background removal failed.')
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Background removal failed.')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className={`py-8 ${cardClasses}`}>
      <div className={`flex flex-col items-center text-center ${title ? 'mb-8' : 'mb-4'}`}>
        {title ? (
          <div className="flex items-center gap-3 mb-2">
            <Scissors className="w-10 h-10 text-sdhq-cyan-500 shrink-0" />
            <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
          </div>
        ) : null}
        <p className={`max-w-xl ${textClasses} text-base`}>{description}</p>
        <p className={`mt-2 text-xs ${subtitleClasses}`}>
          Powered by Fal — Ideogram background removal by default for clean cutouts and natural edges.
        </p>
      </div>

      {!user ? (
        <p className={`text-center ${subtitleClasses}`}>Log in with Kick to remove image backgrounds.</p>
      ) : (
        <div className="max-w-5xl mx-auto px-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${panelClasses}`}
            >
              {imageDataUrl ? (
                <div className="space-y-4">
                  <NextImage
                    src={imageDataUrl}
                    alt="Uploaded image preview"
                    width={900}
                    height={600}
                    unoptimized
                    className="max-h-80 w-full object-contain rounded-xl"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Replace
                    </Button>
                    <Button type="button" variant="outline" onClick={clearImage}>
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-10">
                  <ImageIcon className={`w-14 h-14 mx-auto mb-4 ${darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'}`} />
                  <p className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Upload a photo</p>
                  <p className={`text-sm mb-4 ${subtitleClasses}`}>Drag and drop an image, or pick one from your device.</p>
                  <Button type="button" onClick={() => fileInputRef.current?.click()} className="sdhq-button">
                    <Upload className="w-4 h-4 mr-2" />
                    Pick Image
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => loadImageFile(event.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-3">
              <label className={`block text-sm font-semibold ${subtitleClasses}`} htmlFor="background-remover-prompt">
                Object to keep (optional)
              </label>
              <textarea
                id="background-remover-prompt"
                value={keepPrompt}
                onChange={(event) => setKeepPrompt(event.target.value)}
                placeholder="Example: keep the person, keep the product, keep the dog..."
                rows={3}
                className={`w-full rounded-xl border px-4 py-3 text-sm ${inputShell}`}
              />
              <p className={`text-xs ${subtitleClasses}`}>
                Note: this Fal model auto-detects the foreground subject. The prompt is captured for intent, but this model does not support prompt-guided masking.
              </p>
            </div>

            <label className={`flex items-start gap-3 cursor-pointer ${subtitleClasses}`}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-sdhq-cyan-500 text-sdhq-cyan-600"
                checked={cropToSubject}
                onChange={(event) => setCropToSubject(event.target.checked)}
              />
              <span>
                <span className={`block text-sm font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Crop to subject
                </span>
                <span className="block text-xs opacity-90 mt-0.5">
                  Trim empty transparent space around the detected object. Only applies when the server is configured to use
                  legacy RemBG; ignored for the default Ideogram engine.
                </span>
              </span>
            </label>

            <Button
              type="button"
              onClick={removeBackground}
              disabled={isRemoving || !imageDataUrl}
              className="w-full bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                  Removing background...
                </>
              ) : (
                'Remove Background (free)'
              )}
            </Button>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>

          <div className={`rounded-2xl border p-5 ${panelClasses}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Result</p>
                <p className={`text-xs ${subtitleClasses}`}>Transparent PNG output when available.</p>
              </div>
              {result && (
                <Button type="button" variant="outline" onClick={() => setResult(null)}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>

            {result ? (
              <div className="space-y-4">
                <div className={`rounded-xl overflow-hidden ${darkMode ? 'bg-sdhq-dark-900' : 'bg-white'}`}>
                  <NextImage
                    src={result.imageUrl}
                    alt="Background removed result"
                    width={900}
                    height={900}
                    unoptimized
                    className="max-h-[28rem] w-full object-contain"
                  />
                </div>
                <a
                  href={result.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={result.fileName || 'background-removed.png'}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-sdhq-green-500 px-4 py-3 text-sm font-semibold text-black hover:bg-sdhq-green-400 transition"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Result
                </a>
                {result.promptNote && <p className={`text-xs ${subtitleClasses}`}>{result.promptNote}</p>}
              </div>
            ) : (
              <div className={`min-h-80 flex flex-col items-center justify-center rounded-xl border border-dashed ${darkMode ? 'border-sdhq-dark-600 text-gray-400' : 'border-gray-300 text-gray-500'}`}>
                <ImageIcon className="w-12 h-12 mb-3 opacity-70" />
                <p className="text-sm">Your transparent cutout will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
