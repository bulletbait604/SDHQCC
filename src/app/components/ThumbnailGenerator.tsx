'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Wand2, Upload, X, Download, Loader2, ImageIcon, RotateCcw } from 'lucide-react'
import { useCoins } from '@/hooks/useCoins'

interface Platform {
  id: string
  name: string
  image: string
}

interface ThumbnailResult {
  imageBase64: string
  mimeType: string
  prompt: string
  key: string
  description?: string
}

interface Props {
  userId?: string
  userType?: string
  darkMode?: boolean
  platforms: Platform[]
  user?: { username: string } | null
  onLogActivity?: (entry: { action: string; details: string }) => void
  isDisabled?: boolean // When tab access is restricted
  usageCount?: number // Current usage count for limited roles
  maxUsage?: number | 'unlimited' // Max allowed usage
  onIncrementUsage?: () => void // Callback to increment usage
}

export default function ThumbnailGenerator({ 
  userId, 
  userType, 
  darkMode = true, 
  platforms, 
  user, 
  onLogActivity,
  isDisabled = false,
  usageCount = 0,
  maxUsage = 'unlimited',
  onIncrementUsage
}: Props) {
  const [prompt, setPrompt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>('image/jpeg')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ThumbnailResult | null>(null)
  const [history, setHistory] = useState<ThumbnailResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Platform selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['youtube-shorts', 'youtube-long'])

  // Coin system for free users
  const { 
    balance, 
    deductCoins, 
    hasEnoughCoins, 
    hasUnlimitedAccess,
    loading: coinLoading 
  } = useCoins({ 
    userId: userId || '', 
    userRole: userType 
  })
  
  const COIN_COST = 2 // Thumbnail generator costs 2 coins
  
  // Available platforms for thumbnails
  const availablePlatforms = [
    { id: 'youtube-shorts', name: 'YouTube Shorts', icon: '🔴' },
    { id: 'youtube-long', name: 'YouTube Horizontal', icon: '🔴' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'facebook-reels', name: 'Facebook Reels', icon: '📘' },
    { id: 'twitter', name: 'Twitter/X', icon: '🐦' },
  ]
  
  // Theme classes matching other tabs
  const cardClasses = darkMode
    ? 'bg-sdhq-dark-800/90 border border-sdhq-dark-700 rounded-xl shadow-lg'
    : 'bg-white/80 backdrop-blur-sm border border-sdhq-cyan-200 rounded-xl shadow-lg'
  
  const textClasses = darkMode
    ? 'text-gray-300'
    : 'text-gray-600'
  
  const subtitleClasses = darkMode
    ? 'text-gray-400'
    : 'text-gray-500'
  
  const card = darkMode
    ? 'bg-sdhq-dark-700 border border-sdhq-dark-600'
    : 'bg-gray-100 border border-gray-200'
  
  const inputClasses = darkMode
    ? 'bg-sdhq-dark-900 border-sdhq-dark-600 text-white placeholder-gray-500 focus:border-sdhq-cyan-500 focus:ring-sdhq-cyan-500/20'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-sdhq-cyan-500 focus:ring-sdhq-cyan-500/20'
  
  const subtle = darkMode ? 'text-gray-400' : 'text-gray-500'
  const accentText = darkMode ? 'text-sdhq-cyan-400' : 'text-sdhq-cyan-600'
  
  // Check if usage limit reached
  const isUsageLimited = maxUsage !== 'unlimited' && usageCount >= maxUsage
  
  // Determine if entire component should be disabled
  const isComponentDisabled = isDisabled || isUsageLimited

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleFileChange = (file: File) => {
    setImageFile(file)
    setImageMime(file.type)
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFileChange(file)
  }

  const clearImage = () => {
    setImageFile(null)
    setImageBase64(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Toggle platform selection
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = async (base64Override?: string, mimeOverride?: string) => {
    console.log('[Thumbnail] generate() called')
    if (!prompt.trim()) {
      console.log('[Thumbnail] No prompt, returning')
      return
    }
    if (selectedPlatforms.length === 0) {
      console.log('[Thumbnail] No platforms selected, returning')
      setError('Please select at least one platform')
      return
    }

    if (!hasUnlimitedAccess && !hasEnoughCoins('thumbnail-generator')) {
      setError('Insufficient coins. Thumbnail generation costs 2 coins for free users.')
      return
    }

    setIsGenerating(true)
    setError('')

    // Build platform-specific prompt
    const platformNames = selectedPlatforms.map(id => 
      availablePlatforms.find(p => p.id === id)?.name
    ).filter(Boolean).join(', ')
    
    const enhancedPrompt = `Create a thumbnail optimized for ${platformNames}. ${prompt}`
    console.log('[Thumbnail] Sending request to /api/thumbnail-generator')

    const result = await fetch('/api/thumbnail-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        imageBase64: base64Override ?? imageBase64 ?? undefined,
        mimeType: mimeOverride ?? imageMime,
        sessionId: userId || 'anon',
        platforms: selectedPlatforms,
      }),
    }).then(r => r.json())
    console.log('[Thumbnail] API response received:', { hasError: !!result.error, hasImage: !!result.imageBase64 })

    try {
      if (result.error) {
        console.log('[Thumbnail] API returned error:', result.error)
        throw new Error(result.error)
      }

      const newResult: ThumbnailResult = {
        imageBase64: result.imageBase64,
        mimeType: result.mimeType || 'image/png',
        prompt,
        key: result.key,
        description: result.description,
      }

      // Push current result to history before replacing (keep last 3)
      if (result) setHistory(prev => [result, ...prev].slice(0, 3))
      setResult(newResult)
      console.log('[Thumbnail] Result set, about to deduct coins')

      // Deduct coins for free users
      const deducted = await deductCoins('thumbnail-generator')
      if (!deducted) {
        setError('Insufficient coins. Purchase more coins or claim your daily free coins.')
        setIsGenerating(false)
        return
      }

      // Log thumbnail generation activity
      if (user && onLogActivity) {
        onLogActivity({
          action: 'thumbnail_generation',
          details: `Generated thumbnail with prompt: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`
        })
      }
      
      // Increment usage count for limited roles
      if (onIncrementUsage) {
        onIncrementUsage()
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Re-edit: use current result as input image
  const reEdit = () => {
    if (!result) return
    generate(result.imageBase64, result.mimeType)
  }

  // Restore a history item
  const restoreHistory = (item: ThumbnailResult, index: number) => {
    if (result) setHistory(prev => [result, ...prev.filter((_, i) => i !== index)].slice(0, 3))
    setResult(item)
  }

  // Download
  const download = (base64: string, mime: string) => {
    const ext = mime.split('/')[1]?.split(';')[0] || 'png'
    const link = document.createElement('a')
    link.href = `data:${mime};base64,${base64}`
    link.download = `thumbnail-${Date.now()}.${ext}`
    link.click()
  }

  const presets = [
    { label: '🎮 Gaming', text: 'Explosive gaming thumbnail with dramatic lighting, neon accents, and space for a bold title' },
    { label: '📚 Tutorial', text: 'Clean professional tutorial thumbnail with clear focal point and space for step number and title' },
    { label: '🔥 Viral', text: 'Maximum visual impact, high saturation, shocking composition designed to maximise clicks' },
    { label: '🎨 Cinematic', text: 'Moody cinematic thumbnail with film-grade colour grading and dramatic shadows' },
    { label: '💼 Business', text: 'Professional modern business thumbnail with clean layout and trustworthy feel' },
    { label: '⚡ Tech', text: 'Futuristic tech thumbnail with glowing UI elements, circuit patterns, and bold typography space' },
  ]

  return (
    <div className={`relative py-8 ${cardClasses} ${isComponentDisabled ? 'pointer-events-none' : ''}`}>
      {/* Disabled Overlay */}
      {isComponentDisabled && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 rounded-xl flex flex-col items-center justify-center p-6">
          <div className="text-center">
            <p className="text-white text-xl font-bold mb-2">
              {isDisabled ? '⛔ Access Restricted' : '📊 Usage Limit Reached'}
            </p>
            <p className="text-gray-300 text-sm">
              {isDisabled 
                ? 'This feature is currently disabled for your account.' 
                : `You have used ${usageCount} of ${maxUsage} thumbnail generations.\nPlease upgrade to continue.`}
            </p>
            {isUsageLimited && (
              <button 
                onClick={() => window.open('/subscribe', '_blank')}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 text-black font-semibold rounded-lg hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 transition-all pointer-events-auto"
              >
                Upgrade to Unlimited
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Usage Counter for Limited Roles */}
      {maxUsage !== 'unlimited' && (
        <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-sm font-medium ${
          isUsageLimited 
            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
            : 'bg-sdhq-cyan-500/20 text-sdhq-cyan-400 border border-sdhq-cyan-500/30'
        }`}>
          {usageCount} / {maxUsage} uses
        </div>
      )}
      
      {/* Platform Logos */}
      <div className="flex justify-center gap-4 mb-6">
        {platforms.map((platform) => (
          <Image
            key={platform.id}
            src={platform.image}
            alt={platform.name}
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-cover opacity-80 hover:opacity-100 transition-opacity"
          />
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center space-x-4 mb-3">
          <ImageIcon className="w-10 h-10 text-sdhq-cyan-500" />
          <h3 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Thumbnail Generator</h3>
        </div>
        <p className={`text-sm ${darkMode ? 'text-sdhq-green-400' : 'text-sdhq-green-600'} mb-2`}>
          Powered By: Gemini 2.5 Flash
        </p>
        <p className={`${textClasses} text-base`}>Generate AI-powered thumbnails for any platform</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Controls ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Image upload */}
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className={`border-2 border-dashed rounded-xl p-4 transition-colors ${card} ${imageFile ? 'border-cyan-500' : 'border-gray-600 hover:border-gray-500'}`}
            >
              {imageBase64 ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Image
                      src={`data:${imageMime};base64,${imageBase64}`}
                      alt="Uploaded"
                      width={400}
                      height={160}
                      unoptimized
                      className="w-full max-h-40 object-contain rounded-lg"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className={`text-xs truncate ${subtle}`}>{imageFile?.name}</p>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-4"
                >
                  <ImageIcon className={`w-8 h-8 ${subtle}`} />
                  <p className={`text-sm ${subtle}`}>Drop an image or click to upload</p>
                  <p className={`text-xs ${subtle}`}>Optional — PNG, JPG, WEBP</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
              />
            </div>

            {/* Style presets */}
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => setPrompt(p.text)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${card} hover:border-cyan-500 hover:text-cyan-400`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Prompt */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={imageBase64
                ? "Describe how to use your image in the thumbnail... (e.g. 'Place me on the left side with a red explosive background and bold white text space on the right')"
                : "Describe the thumbnail you want... (e.g. 'A dramatic gaming thumbnail for a Minecraft video with lava and a shocked face')"}
              rows={4}
              className={`w-full border rounded-xl px-4 py-3 text-base resize-none outline-none transition-all backdrop-blur-sm ${inputClasses}`}
            />

            {/* Platform Selection */}
            <div className={`p-4 rounded-xl border ${darkMode ? 'bg-sdhq-dark-800 border-sdhq-dark-600' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-sm font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                📱 Check your platform(s):
              </p>
              <div className="grid grid-cols-2 gap-2">
                {availablePlatforms.map((platform) => (
                  <label 
                    key={platform.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                      selectedPlatforms.includes(platform.id)
                        ? darkMode 
                          ? 'bg-sdhq-cyan-500/20 border border-sdhq-cyan-500/50' 
                          : 'bg-sdhq-cyan-100 border border-sdhq-cyan-300'
                        : darkMode
                          ? 'bg-sdhq-dark-700 border border-sdhq-dark-600 hover:bg-sdhq-dark-600'
                          : 'bg-white border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform.id)}
                      onChange={() => togglePlatform(platform.id)}
                      className="w-4 h-4 rounded border-gray-300 text-sdhq-cyan-500 focus:ring-sdhq-cyan-500"
                    />
                    <span className="text-lg">{platform.icon}</span>
                    <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {platform.name}
                    </span>
                  </label>
                ))}
              </div>
              {selectedPlatforms.length === 0 && (
                <p className="text-red-400 text-sm mt-2">Please select at least one platform</p>
              )}
            </div>

            {/* Generate button with coin cost */}
            {!hasUnlimitedAccess && (
              <div className="text-xs text-gray-500 mb-2">
                {hasEnoughCoins('thumbnail-generator') 
                  ? `🪙 ${balance} coins available (costs ${COIN_COST} coins)`
                  : `⚠️ Need ${COIN_COST} coins (you have ${balance})`}
              </div>
            )}
            {hasUnlimitedAccess && (
              <div className="text-xs text-green-500 mb-2">
                ✨✨ Unlimited access (no coin cost)
              </div>
            )}
            <button
              onClick={() => generate()}
              disabled={isGenerating || !prompt.trim() || selectedPlatforms.length === 0 || (!hasUnlimitedAccess && !hasEnoughCoins('thumbnail-generator'))}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all bg-gradient-to-r from-sdhq-cyan-500 to-sdhq-green-500 hover:from-sdhq-cyan-600 hover:to-sdhq-green-600 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Generating...</span></>
              ) : (
                <><Wand2 className="w-5 h-5" /><span>{imageBase64 ? 'Generate with Image' : 'Generate Thumbnail'} (2 coins)</span></>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-700 rounded-xl text-red-400 text-sm">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* ── Right: Output ───────────────────────────────────────────────── */}
          <div className={`p-6 rounded-lg border-2 ${darkMode ? 'bg-sdhq-dark-700 border-sdhq-cyan-500/30' : 'bg-gray-50 border-sdhq-cyan-300 shadow-md'} space-y-4`}>
            {isGenerating ? (
              <div className={`flex flex-col items-center justify-center h-64 rounded-xl border ${card}`}>
                <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mb-3" />
                <p className={`text-sm ${subtle}`}>Generating thumbnail...</p>
                <p className={`text-xs mt-1 ${subtle}`}>This takes 15–30 seconds</p>
              </div>
            ) : result ? (
              <div className="space-y-3">
                <div className={`relative rounded-xl overflow-hidden border-2 border-cyan-500`}>
                  <Image
                    src={`data:${result.mimeType};base64,${result.imageBase64}`}
                    alt="Generated thumbnail"
                    width={800}
                    height={450}
                    unoptimized
                    className="w-full object-cover"
                  />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => download(result.imageBase64, result.mimeType)}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={reEdit}
                      disabled={isGenerating}
                      className="p-2 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-40"
                      title="Re-edit this result"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setResult(null); setPrompt('') }}
                      className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Start over"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Re-edit controls */}
                <div className="flex gap-2">
                  <input
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Change the prompt and re-edit..."
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition-all backdrop-blur-sm ${inputClasses}`}
                  />
                  <button
                    onClick={reEdit}
                    disabled={isGenerating || !prompt.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Re-edit
                  </button>
                </div>

                {result.description && (
                  <p className={`text-xs italic ${subtle}`}>{result.description}</p>
                )}
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed ${card}`}>
                <Wand2 className={`w-10 h-10 mb-3 ${subtle}`} />
                <p className={`text-sm ${subtle}`}>Your thumbnail will appear here</p>
              </div>
            )}

            {/* History - Last 3 Generated */}
            {history.length > 0 && (
              <div className={`p-3 rounded-xl border ${card}`}>
                <p className={`text-xs font-medium mb-2 ${subtle}`}>Recent Thumbnails (Click to Restore)</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => restoreHistory(item, i)}
                      className="flex-shrink-0 group relative"
                      title={item.prompt}
                    >
                      <Image
                        src={`data:${item.mimeType};base64,${item.imageBase64}`}
                        alt={`v${history.length - i}`}
                        width={80}
                        height={48}
                        unoptimized
                        className="w-20 h-12 object-cover rounded-lg border-2 border-transparent group-hover:border-cyan-500 transition-all"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity flex items-center justify-center">
                        <RotateCcw className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
