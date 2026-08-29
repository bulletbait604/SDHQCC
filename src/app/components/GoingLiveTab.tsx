'use client'

import { useMemo, useRef, useState } from 'react'
import NextImage from 'next/image'
import {
  Copy,
  Download,
  Loader2,
  RadioTower,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GOING_LIVE_SOCIAL,
  GOING_LIVE_STREAMING,
  GOING_LIVE_TONES,
  MAX_GOING_LIVE_REFS,
  MAX_STREAM_TOPIC_CHARS,
  MAX_STREAM_USERNAME_CHARS,
  type GoingLiveSocialId,
  type GoingLiveStreamingId,
  type GoingLiveToneId,
} from '@/lib/goingLive/platforms'
import type { KickUser } from '@/lib/home/types'

type PosterAsset = {
  key: string
  width: number
  height: number
  mimeType: string
}

type GoingLivePost = {
  platformId: GoingLiveSocialId
  platformName: string
  title?: string
  copy: string
  poster: PosterAsset | null
  posterError?: string
}

type GenerateResponse = {
  streamTitle: string
  liveUrl: string
  streamingPlatformName: string
  username: string
  posts: GoingLivePost[]
  error?: string
  userMessage?: string
}

type RefSlot = {
  id: string
  file: File
  dataUrl: string
  mimeType: string
}

export interface GoingLiveTabProps {
  darkMode: boolean
  subtitleClasses: string
  description: string
  user: KickUser | null
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const COMPRESS_MAX_SIDE = 1280
const COMPRESS_QUALITY = 0.82

function assetImageSrc(key: string): string {
  return `/api/image?key=${encodeURIComponent(key)}`
}

async function compressReferenceDataUrl(
  dataUrl: string
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, COMPRESS_MAX_SIDE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not compress reference image'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const out = canvas.toDataURL('image/jpeg', COMPRESS_QUALITY)
      resolve({ base64: out, mimeType: 'image/jpeg' })
    }
    img.onerror = () => reject(new Error('Could not read reference image'))
    img.src = dataUrl
  })
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (/request entity too large/i.test(text) || res.status === 413) {
      throw new Error('Upload too large for the server. Use fewer/smaller reference images.')
    }
    throw new Error(
      snippet
        ? `Server error (${res.status}): ${snippet}`
        : `Server returned a non-JSON response (${res.status}).`
    )
  }
}

function fullPostText(post: GoingLivePost): string {
  if (post.title) return `${post.title}\n\n${post.copy}`
  return post.copy
}

export default function GoingLiveTab({
  darkMode,
  subtitleClasses,
  description,
  user,
}: GoingLiveTabProps) {
  const [username, setUsername] = useState(user?.username?.replace(/^@/, '') || '')
  const [topic, setTopic] = useState('')
  const [streamingId, setStreamingId] = useState<GoingLiveStreamingId>('kick')
  const [socialIds, setSocialIds] = useState<GoingLiveSocialId[]>(['twitter', 'reddit'])
  const [toneId, setToneId] = useState<GoingLiveToneId>('funny')
  const [refs, setRefs] = useState<RefSlot[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const streaming = useMemo(
    () => GOING_LIVE_STREAMING.find((p) => p.id === streamingId)!,
    [streamingId]
  )

  const inputShell = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500'
  const chipIdle = darkMode
    ? 'border-sdhq-dark-600 bg-sdhq-dark-900 text-gray-200 hover:border-sdhq-cyan-500/50'
    : 'border-gray-300 bg-white text-gray-800 hover:border-sdhq-cyan-400'
  const chipActive = 'border-sdhq-cyan-500 bg-sdhq-cyan-500/15 text-sdhq-cyan-400'
  const sectionTitle = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  const card = darkMode
    ? 'bg-sdhq-dark-700/80 border-sdhq-dark-600'
    : 'bg-gray-50 border-gray-200'
  const panel = darkMode ? 'bg-sdhq-dark-800' : 'bg-white'
  const textMain = darkMode ? 'text-white' : 'text-gray-900'

  const markCopied = (key: string) => {
    setCopied((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000)
  }

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    markCopied(key)
  }

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
          if (prev.length >= MAX_GOING_LIVE_REFS) return prev
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

  const toggleSocial = (id: GoingLiveSocialId) => {
    setResult(null)
    setSocialIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((p) => p !== id)
      }
      return [...prev, id]
    })
  }

  const resetAll = () => {
    setTopic('')
    setRefs([])
    setResult(null)
    setError('')
    setLoadingStep('')
    setCopied({})
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadPoster = (post: GoingLivePost) => {
    if (!post.poster) return
    const a = document.createElement('a')
    a.href = `${assetImageSrc(post.poster.key)}&download=1`
    a.download = `going-live-${post.platformId}-${username || 'stream'}`
    a.click()
  }

  const handleGenerate = async () => {
    if (!user) {
      setError('Login required.')
      return
    }
    const handle = username.replace(/^@+/, '').trim()
    if (!handle) {
      setError('Enter your stream username.')
      return
    }
    if (socialIds.length === 0) {
      setError('Select at least one social media platform.')
      return
    }
    if (refs.length === 0) {
      setError('Upload 1–4 reference images.')
      return
    }

    setIsWorking(true)
    setError('')
    setResult(null)
    setCopied({})
    setLoadingStep('Compressing reference images…')

    try {
      const compressed = await Promise.all(refs.map((r) => compressReferenceDataUrl(r.dataUrl)))

      setLoadingStep('Writing stream title and social posts…')
      const res = await fetch('/api/going-live/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          streamingPlatformId: streamingId,
          socialPlatformIds: socialIds,
          toneId,
          username: handle,
          topic,
          references: compressed.map((c) => ({
            base64: c.base64,
            mimeType: c.mimeType,
          })),
        }),
      })

      setLoadingStep(`Painting ${socialIds.length} poster${socialIds.length === 1 ? '' : 's'}…`)
      const data = await parseJsonResponse<GenerateResponse>(res)
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

  const canGenerate = Boolean(username.trim()) && socialIds.length > 0 && refs.length > 0 && !isWorking

  return (
    <div className="space-y-6">
      <p className={`text-sm ${subtitleClasses}`}>{description}</p>

      <section className="space-y-2">
        <label className={`block text-sm font-semibold ${sectionTitle}`}>Stream username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setResult(null)
          }}
          maxLength={MAX_STREAM_USERNAME_CHARS}
          placeholder="e.g. bulletbait604"
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputShell}`}
        />
      </section>

      <section className="space-y-2">
        <label className={`block text-sm font-semibold ${sectionTitle}`}>
          What are you streaming? <span className={`font-normal ${subtitleClasses}`}>(optional)</span>
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value)
            setResult(null)
          }}
          maxLength={MAX_STREAM_TOPIC_CHARS}
          placeholder="e.g. Valorant ranked, Just Chatting, cooking…"
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${inputShell}`}
        />
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Streaming platform</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GOING_LIVE_STREAMING.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setStreamingId(p.id)
                setResult(null)
              }}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                streamingId === p.id ? chipActive : chipIdle
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className={`text-xs ${subtitleClasses}`}>
          Stream title max {streaming.titleMaxChars} characters on {streaming.name}.
        </p>
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Social media platforms</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GOING_LIVE_SOCIAL.map((p) => {
            const active = socialIds.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleSocial(p.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active ? chipActive : chipIdle
                }`}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className={`text-xs mt-0.5 ${subtitleClasses}`}>{p.poster.label}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>Vibe / tone</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {GOING_LIVE_TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setToneId(t.id)
                setResult(null)
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                toneId === t.id ? chipActive : chipIdle
              }`}
            >
              <div className="text-sm font-semibold">{t.name}</div>
              <div className={`text-xs mt-0.5 ${subtitleClasses}`}>{t.hint}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h4 className={`text-sm font-semibold ${sectionTitle}`}>
          Reference images (up to {MAX_GOING_LIVE_REFS})
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
              <div
                key={r.id}
                className="relative w-24 h-24 rounded-lg overflow-hidden border border-cyan-500/40"
              >
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
            {refs.length < MAX_GOING_LIVE_REFS && (
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

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="bg-sdhq-cyan-500 hover:bg-sdhq-cyan-400 text-black"
        >
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <RadioTower className="w-4 h-4 mr-2" />
              Generate go-live kit
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
        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-4 ${card}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-semibold uppercase text-sdhq-cyan-400">
                  {result.streamingPlatformName} stream title
                </p>
                <p className={`text-lg font-bold mt-1 ${textMain}`}>{result.streamTitle}</p>
                <p className={`text-xs mt-1 ${subtitleClasses}`}>{result.liveUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => copyText('stream-title', result.streamTitle)}
                className="text-xs text-sdhq-cyan-400 hover:text-sdhq-cyan-300 shrink-0"
              >
                {copied['stream-title'] ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const chunks = [
                  `${result.streamingPlatformName} title:\n${result.streamTitle}`,
                  `Live: ${result.liveUrl}`,
                  ...result.posts.map((p) => `--- ${p.platformName} ---\n${fullPostText(p)}`),
                ]
                copyText('all-posts', chunks.join('\n\n'))
              }}
              className="w-full mt-2"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied['all-posts'] ? 'Copied!' : 'Copy all'}
            </Button>
          </div>

          {result.posts.map((post) => (
            <section key={post.platformId} className={`rounded-xl border-2 p-4 ${card}`}>
              <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                <h5 className={`font-bold ${textMain}`}>{post.platformName}</h5>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(`post-${post.platformId}`, fullPostText(post))}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied[`post-${post.platformId}`] ? 'Copied!' : 'Copy all'}
                </Button>
              </div>

              {post.title && (
                <div className={`p-3 rounded-lg mb-3 ${panel}`}>
                  <span className="text-xs font-semibold text-sdhq-cyan-400 block mb-1">Title</span>
                  <p className={`text-sm font-medium ${textMain}`}>{post.title}</p>
                </div>
              )}

              <div className={`p-3 rounded-lg mb-4 ${panel}`}>
                <span className="text-xs font-semibold text-sdhq-cyan-400 block mb-1">Post</span>
                <p className={`text-sm whitespace-pre-wrap ${subtitleClasses}`}>{post.copy}</p>
              </div>

              {post.poster ? (
                <div className="space-y-2">
                  <div className="relative w-full overflow-hidden rounded-lg border border-cyan-500/30 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetImageSrc(post.poster.key)}
                      alt={`${post.platformName} go-live poster`}
                      className="w-full h-auto"
                    />
                  </div>
                  <p className={`text-xs ${subtitleClasses}`}>
                    {post.poster.width}×{post.poster.height}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => downloadPoster(post)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download poster
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-amber-400">
                  {post.posterError || 'Poster could not be generated for this platform.'}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
