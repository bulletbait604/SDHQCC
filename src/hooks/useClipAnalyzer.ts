'use client'

import { useState, useMemo, useCallback } from 'react'
import type { ActivityLogEntry, KickUser, Platform } from '@/lib/home/types'
import { getEditSuggestionsTagSlice } from '@/lib/home/tagUtils'
import { postActivityLog } from '@/lib/home/activityLogUtils'

export interface ClipAnalysisResult {
  score: number
  scoreTitle?: string
  scoreSummary?: string
  hookStrength?: number
  engagementPotential?: number
  visualQuality?: number
  audioQuality?: number
  analysisSource?: string
  title?: string
  titles?: string[]
  description?: string
  tags?: string[]
  overlays?: Array<{ type: string; timing: string; description?: string }>
  extractedData?: unknown
  estimatedCostUsd?: number
  estimatedCostNote?: string
}

interface UseClipAnalyzerOptions {
  user: KickUser | null
  userType: string
  platforms: Platform[]
  hasEnoughCoins: (tool: 'clip-analyzer') => boolean
  hasUnlimitedAccess: boolean
  refreshBalance: () => void
  onActivityLog?: (entry: ActivityLogEntry) => void
}

export function useClipAnalyzer({
  user,
  userType,
  platforms,
  hasEnoughCoins,
  hasUnlimitedAccess,
  refreshBalance,
  onActivityLog,
}: UseClipAnalyzerOptions) {
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipPlatform, setClipPlatform] = useState<string>('tiktok')
  const [isAnalyzingClip, setIsAnalyzingClip] = useState(false)
  const [clipAnalysisResult, setClipAnalysisResult] = useState<ClipAnalysisResult | null>(null)
  const [clipError, setClipError] = useState('')
  const [loadingStep, setLoadingStep] = useState('')
  const [extractedData, setExtractedData] = useState<unknown>(null)
  const [showReanalysis, setShowReanalysis] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [copiedTags, setCopiedTags] = useState(false)
  const [copiedDescription, setCopiedDescription] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState<number | null>(null)

  const clipEditSuggestionTags = useMemo(
    () =>
      clipAnalysisResult != null
        ? getEditSuggestionsTagSlice(clipPlatform, clipAnalysisResult.tags, platforms)
        : [],
    [clipAnalysisResult, clipPlatform, platforms]
  )

  const toggleCard = useCallback((cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }, [])

  const handleResetClip = useCallback(() => {
    setClipFile(null)
    setClipPlatform('tiktok')
    setClipAnalysisResult(null)
    setClipError('')
    setExtractedData(null)
    setShowReanalysis(false)
    setExpandedCards(new Set())
    setCopiedTags(false)
    setCopiedDescription(false)
  }, [])

  const logClipAnalysis = useCallback(
    (platform: string, data: ClipAnalysisResult) => {
      if (!user) return
      const detailLine = `Analyzed clip for ${platform} (score: ${data.score})`
      const clipEstUsd =
        typeof data.estimatedCostUsd === 'number' && Number.isFinite(data.estimatedCostUsd)
          ? data.estimatedCostUsd
          : undefined
      const clipCostNote =
        typeof data.estimatedCostNote === 'string' ? data.estimatedCostNote : undefined
      const entry: ActivityLogEntry = {
        id: Date.now().toString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        action: 'clip_analysis',
        details: detailLine,
        ...(clipEstUsd !== undefined ? { estimatedCostUsd: clipEstUsd } : {}),
        ...(clipCostNote !== undefined ? { estimatedCostNote: clipCostNote } : {}),
      }
      onActivityLog?.(entry)
      void postActivityLog({
        username: user.username,
        action: 'clip_analysis',
        details: detailLine,
        ...(clipEstUsd !== undefined ? { estimatedCostUsd: clipEstUsd } : {}),
        ...(clipCostNote !== undefined ? { estimatedCostNote: clipCostNote } : {}),
      })
    },
    [onActivityLog, user]
  )

  const handleAnalyzeClip = useCallback(async () => {
    if (!clipFile) {
      setClipError('Please select a video file to analyze.')
      return
    }
    if (!clipPlatform) {
      setClipError('Please select a target platform.')
      return
    }

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (!validTypes.includes(clipFile.type)) {
      setClipError('Please select a valid video file (MP4, WebM, MOV, or AVI).')
      return
    }

    const maxSize = 250 * 1024 * 1024
    const minSize = 100 * 1024
    if (clipFile.size < minSize) {
      setClipError('File size is too small. Video must be at least 100KB to analyze properly.')
      return
    }
    if (clipFile.size > maxSize) {
      setClipError('File size must be less than 250MB.')
      return
    }

    if (!hasEnoughCoins('clip-analyzer')) {
      setClipError(
        'Not enough coins to run Clip Analyzer. Please purchase more coins or upgrade for unlimited access.'
      )
      return
    }

    setClipError('')
    setIsAnalyzingClip(true)
    setClipAnalysisResult(null)
    setExtractedData(null)
    setShowReanalysis(false)

    const loadingSteps = [
      'Requesting secure upload...',
      'Uploading video to storage...',
      'Processing video with AI...',
      'Analyzing visual and audio elements...',
      'Cross-referencing with platform algorithm...',
      'Generating optimization recommendations...',
      'Creating final report...',
    ]

    let step = 0
    const stepInterval = setInterval(() => {
      if (step < loadingSteps.length) {
        setLoadingStep(loadingSteps[step])
        step++
      }
    }, 2000)

    try {
      setLoadingStep(loadingSteps[0])
      const presignRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: clipFile.name,
          contentType: clipFile.type,
          purpose: 'clip-analyzer',
        }),
      })

      if (!presignRes.ok) {
        const errBody = await presignRes.json().catch(() => ({}))
        throw new Error(
          (errBody as { error?: string }).error ||
            'Could not get upload URL. Check R2 credentials on the server.'
        )
      }

      const { uploadUrl, fileKey } = (await presignRes.json()) as {
        uploadUrl: string
        fileKey: string
      }

      setLoadingStep(loadingSteps[1])
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': clipFile.type },
        body: clipFile,
      })
      if (!putRes.ok) {
        throw new Error('Failed to upload clip to storage. Please try again.')
      }

      setLoadingStep(loadingSteps[2])
      const analyzeRes = await fetch('/api/clip-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          r2FileKey: fileKey,
          mimeType: clipFile.type,
          fileName: clipFile.name,
          fileSize: clipFile.size,
          platform: clipPlatform,
          userId: user?.id || '',
          userType,
        }),
      })

      clearInterval(stepInterval)
      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json()
        throw new Error(errorData.userMessage || errorData.error || 'Analysis failed')
      }

      const data = (await analyzeRes.json()) as ClipAnalysisResult
      setClipAnalysisResult(data)
      setExtractedData(data.extractedData || null)
      setShowReanalysis(true)
      refreshBalance()
      logClipAnalysis(clipPlatform, data)
    } catch (error) {
      clearInterval(stepInterval)
      setClipError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzingClip(false)
      setLoadingStep('')
    }
  }, [
    clipFile,
    clipPlatform,
    hasEnoughCoins,
    logClipAnalysis,
    refreshBalance,
    user?.id,
    userType,
  ])

  const analyzeFromSourceUrl = useCallback(
    async (params: {
      sourceUrl: string
      platform: string
      fileName: string
      loadingLabel?: string
    }): Promise<{ ok: true; data: ClipAnalysisResult } | { ok: false; error: string }> => {
      if (!hasUnlimitedAccess && !hasEnoughCoins('clip-analyzer')) {
        return {
          ok: false,
          error:
            'Not enough coins to analyze this clip. Please purchase more coins or upgrade for unlimited access.',
        }
      }

      setClipFile(null)
      setClipPlatform(params.platform)
      setClipError('')
      setIsAnalyzingClip(true)
      setClipAnalysisResult(null)
      setExtractedData(null)
      setShowReanalysis(false)
      setLoadingStep(params.loadingLabel || 'Analyzing clip...')

      try {
        const analyzeRes = await fetch('/api/clip-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sourceUrl: params.sourceUrl,
            mimeType: 'video/mp4',
            fileName: params.fileName,
            platform: params.platform,
            userId: user?.id || '',
            userType,
          }),
        })

        if (!analyzeRes.ok) {
          const errorData = await analyzeRes.json().catch(() => ({}))
          throw new Error(errorData.userMessage || errorData.error || 'Analysis failed')
        }

        const data = (await analyzeRes.json()) as ClipAnalysisResult
        setClipAnalysisResult(data)
        setExtractedData(data.extractedData || null)
        setShowReanalysis(true)
        refreshBalance()
        logClipAnalysis(params.platform, data)
        return { ok: true, data }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed'
        setClipError(message)
        return { ok: false, error: message }
      } finally {
        setIsAnalyzingClip(false)
        setLoadingStep('')
      }
    },
    [hasEnoughCoins, hasUnlimitedAccess, logClipAnalysis, refreshBalance, user?.id, userType]
  )

  return {
    clipFile,
    setClipFile,
    clipPlatform,
    setClipPlatform,
    isAnalyzingClip,
    clipAnalysisResult,
    clipError,
    setClipError,
    loadingStep,
    extractedData,
    showReanalysis,
    expandedCards,
    copiedTags,
    setCopiedTags,
    copiedDescription,
    setCopiedDescription,
    copiedTitle,
    setCopiedTitle,
    clipEditSuggestionTags,
    toggleCard,
    handleResetClip,
    handleAnalyzeClip,
    analyzeFromSourceUrl,
  }
}
