import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import clientPromise from '@/lib/mongodb'
import { verifyAuth, hasUnlimitedAccess, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import { toolCoinCost } from '@/lib/coins/toolCosts'
import {
  getFileFromR2,
  deleteFileFromR2,
  getR2ObjectMetadata,
  generatePresignedReadUrl,
} from '@/lib/r2'
import {
  uploadBufferToGeminiFilesApi,
  pollGeminiFileUntilActive,
  deleteGeminiUploadedFile,
} from '@/lib/geminiFiles'
import { estimateClipAnalysisUsd } from '@/lib/estimatedInferenceCost'
import {
  isYouTubeClipPlatform,
  normalizeClipAnalysisMetadata,
  youtubeShortsMetadataPromptBlock,
} from '@/lib/clipAnalyzerMetadata'
import { formatAlgorithmContextForPlatform } from '@/lib/algorithmContext'
import { geoPromptBlock, resolveRequestGeo } from '@/lib/requestGeo'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

const CLIP_ANALYZE_COIN_COST = toolCoinCost('clip-analyzer') ?? 2

/** Gemini can fetch HTTPS / signed URLs directly; larger clips still use the Files API after R2. */
const GEMINI_EXTERNAL_URL_MAX_BYTES = 100 * 1024 * 1024
const CLIP_MAX_BYTES = 250 * 1024 * 1024

// Use gemini-2.5-flash model (stable release)
const MODEL_NAME = 'gemini-2.5-flash'

type TargetPlatform = 'tiktok' | 'youtube' | 'reels'

function normalizeTargetPlatform(platform: string): TargetPlatform {
  const p = platform.trim().toLowerCase()
  if (p === 'youtube' || p === 'youtube-shorts' || p === 'shorts') return 'youtube'
  if (p === 'instagram' || p === 'instagram-reels' || p === 'reels') return 'reels'
  return 'tiktok'
}

function platformEditingDirective(platform: TargetPlatform): string {
  if (platform === 'youtube') {
    return `Focus on the "Loop." Ensure the last 2 seconds lead back into the first 2 seconds for infinite loop potential.`
  }
  if (platform === 'reels') {
    return `Focus on "Cinematic Quality." Use longer cuts (3-4 seconds) and ensure the center of the frame is the priority for the Grid view.`
  }
  return `Focus on a 3-second visual hook. Edit for "Chaos Pacing"—cut every 1.5 seconds to keep retention high.`
}

function clipAnalyzerBackend(): string {
  return (process.env.CLIP_ANALYZER_BACKEND || 'gemini').trim().toLowerCase()
}

type ClipIngestionMode =
  | 'r2-presigned-url'
  | 'r2-gemini-files'
  | 'legacy-gemini-file'
  | 'external-url'

/**
 * Gemini sometimes returns valid JSON plus trailing prose or a duplicate blob.
 * JSON.parse(fullText) then fails with "Unexpected non-whitespace character after JSON".
 */
function extractFirstBalancedJsonObject(raw: string): string | null {
  const s = raw.trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  console.log('[DEBUG] Clip Analyze API: Request received - DEPLOY: f3366cc')
  
  try {
    const user = await verifyAuth(request)

    console.log('[DEBUG] Clip Analyze API: Parsing request body...')
    const body = await request.json()
    const { fileUri, r2FileKey, sourceUrl, mimeType, fileName, fileSize, platform } = body as {
      fileUri?: string
      r2FileKey?: string
      sourceUrl?: string
      mimeType?: string
      fileName?: string
      fileSize?: number
      platform?: string
    }

    console.log('[DEBUG] Clip Analyze API: Request data:', {
      hasR2Key: !!r2FileKey,
      hasFileUri: !!fileUri,
      hasSourceUrl: !!sourceUrl,
      fileUriPreview: fileUri ? fileUri.substring(0, 60) : 'none',
      sourceUrlPreview: sourceUrl ? sourceUrl.substring(0, 60) : 'none',
      mimeType,
      fileName,
      fileSizeMB: fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : 'unknown',
      platform,
      username: user.username,
      role: user.role,
      timestamp: new Date().toISOString(),
    })

    if (!platform) {
      console.error('[DEBUG] Clip Analyze API: platform is required')
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }
    const targetPlatform = normalizeTargetPlatform(platform)
    const isYouTubeMetadata = isYouTubeClipPlatform(platform)

    // Note: 150MB limit is enforced on the frontend for direct URLs
    // Videos larger than 150MB may not be accessible for analysis

    // Access: paid tiers unlimited; free tier gated by coin balance (coins deducted client-side after success)
    if (!hasUnlimitedAccess(user)) {
      if (user.role !== 'free') {
        return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
      }
      const client = await clientPromise
      const db = client.db('sdhq')
      const balanceKey = await resolveCoinBalanceUserId(db, user)
      const row = await db.collection('coinBalances').findOne({ userId: balanceKey })
      const coins = typeof row?.coins === 'number' ? row.coins : 0
      if (coins < CLIP_ANALYZE_COIN_COST) {
        return NextResponse.json(
          {
            error: 'Not enough coins',
            userMessage: `Clip Analyzer needs at least ${CLIP_ANALYZE_COIN_COST} coins. Purchase coins or upgrade for unlimited access.`,
          },
          { status: 403 }
        )
      }
    }

    const backend = clipAnalyzerBackend()
    const geminiApiKey = process.env.GEMINI_API
    
    if (backend !== 'gemini') {
      return NextResponse.json(
        {
          error: 'Unsupported clip analyzer backend',
          details: `CLIP_ANALYZER_BACKEND=${backend} is not supported yet`,
        },
        { status: 400 }
      )
    }

    if (!geminiApiKey) {
      console.log('[ACTIVITY_LOG] Clip Analyze: GEMINI_API key not configured')
      return NextResponse.json({ 
        error: 'API not configured',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'GEMINI_API key not configured'
      }, { status: 503 })
    }

    let analysisFileUri: string
    let cleanupGeminiName: string | null = null
    let cleanupR2Key: string | null = null
    let clipIngestionMode: ClipIngestionMode = 'legacy-gemini-file'
    let effectiveMime = typeof mimeType === 'string' && mimeType ? mimeType : 'video/mp4'

    const clipFromR2 = typeof r2FileKey === 'string' && r2FileKey.length > 0
    const storageUser = user.username.replace(/^@/, '').toLowerCase()

    if (clipFromR2) {
      const prefix = `uploads/clips/${storageUser}/`
      if (!r2FileKey!.startsWith(prefix) || r2FileKey!.includes('..') || r2FileKey!.length > 500) {
        return NextResponse.json({ error: 'Invalid clip file key' }, { status: 400 })
      }

      const meta = await getR2ObjectMetadata(r2FileKey!)
      if (!meta) {
        return NextResponse.json(
          {
            error: 'Clip not found',
            userMessage: 'Could not load your upload. Try uploading again.',
          },
          { status: 404 }
        )
      }

      if (meta.contentLength > CLIP_MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 250MB)' }, { status: 400 })
      }

      effectiveMime = mimeType || meta.contentType || 'video/mp4'
      cleanupR2Key = r2FileKey!

      if (meta.contentLength <= GEMINI_EXTERNAL_URL_MAX_BYTES) {
        const readUrl = await generatePresignedReadUrl(r2FileKey!, 3600)
        if (!readUrl) {
          return NextResponse.json(
            {
              error: 'Storage misconfigured',
              userMessage: 'Could not prepare your clip for analysis. Please try again later.',
              details: 'Presigned read URL unavailable',
            },
            { status: 503 }
          )
        }
        analysisFileUri = readUrl
        clipIngestionMode = 'r2-presigned-url'
        console.log(
          '[DEBUG] Clip Analyze: Gemini will fetch clip via R2 presigned URL (no Files API upload, size:',
          meta.contentLength,
          ')'
        )
      } else {
        console.log('[DEBUG] Clip Analyze: Clip > 100MB — loading from R2 and uploading to Gemini Files API')
        const buffer = await getFileFromR2(r2FileKey!)
        if (!buffer) {
          return NextResponse.json(
            {
              error: 'Clip not found',
              userMessage: 'Could not load your upload. Try uploading again.',
            },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey: geminiApiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof fileName === 'string' ? fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(geminiApiKey, uploaded.uri)
        analysisFileUri = uploaded.uri
        clipIngestionMode = 'r2-gemini-files'
      }
    } else if (
      typeof fileUri === 'string' &&
      fileUri.startsWith('https://generativelanguage.googleapis.com/')
    ) {
      analysisFileUri = fileUri
      clipIngestionMode = 'legacy-gemini-file'
      console.log('[DEBUG] Clip Analyze: Using client-provided Gemini fileUri (legacy)')
    } else if (typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl)) {
      analysisFileUri = sourceUrl
      clipIngestionMode = 'external-url'
      console.log('[DEBUG] Clip Analyze: Using client-provided external sourceUrl')
    } else {
      return NextResponse.json(
        {
          error: 'Missing clip source',
          details: 'Provide r2FileKey after R2 upload, sourceUrl for public clips, or fileUri for legacy flow',
        },
        { status: 400 }
      )
    }

    let fileUriForGemini = analysisFileUri
    let attemptedPresignedFallback = false

    try {
    const extractedSource =
      clipIngestionMode === 'r2-presigned-url'
        ? 'r2-presigned-url'
        : clipIngestionMode === 'r2-gemini-files'
          ? 'r2-then-gemini-files'
          : clipIngestionMode === 'external-url'
            ? 'external-url'
          : 'legacy-gemini-file-uri'

    // Create basic extracted data from file metadata
    let extractedData = {
      fileName: fileName || 'Unknown',
      fileSize: fileSize || 0,
      fileType: effectiveMime,
      duration: 'Unknown (requires video processing)',
      summary: `Uploaded video file: ${fileName || 'Unknown'} (${fileSize ? (fileSize / (1024 * 1024)).toFixed(2) : 'Unknown'} MB)`,
      visualAnalysis: 'Video file uploaded for analysis',
      audioAnalysis: 'Video file uploaded for analysis',
      topics: [],
      keyPoints: [],
      source: extractedSource,
    }

    console.log('[DEBUG] Clip Analyze API: Starting Gemini analysis with file URI...')

    // Use AI to analyze the video file using the provided file URI
    let analysisResult = null
    let analysisSource = 'none'

    const algoCtx = await formatAlgorithmContextForPlatform(platform || 'tiktok')
    const geo = resolveRequestGeo(request.headers)
    const locationBlock = geoPromptBlock(geo)

      const genAI = new GoogleGenAI({ apiKey: geminiApiKey })

      for (;;) {
      try {
      console.log('[DEBUG] Using model:', MODEL_NAME)
      console.log('[DEBUG] Starting Gemini API call with timeout protection...')
      
      // Add timeout protection (Vercel serverless has 60s timeout)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gemini API timeout after 52 seconds')), 52000)
      })
      
      console.log('[DEBUG] Analyzing file URI:', fileUriForGemini.substring(0, 120))
      
      const geminiResponse = await Promise.race([
        genAI.models.generateContent({
          model: MODEL_NAME,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  fileData: {
                    mimeType: effectiveMime,
                    fileUri: fileUriForGemini
                  }
                },
                {
                  text: `You are an expert social media algorithm analyst and content strategist. Analyze this video file IN-DEPTH for ${platform} optimization.

PLATFORM EDITING DIRECTIVE:
${platformEditingDirective(targetPlatform)}

LIVE ALGORITHM DATA (must drive recommendations — do not ignore):
${algoCtx.block}

${locationBlock}

CRITICAL ANALYSIS REQUIREMENTS:
1. **SUBJECT MATTER IDENTIFICATION**: 
   - What is the video about? Identify main topic, theme, niche, and target audience
   - Detect if this is gaming content - identify the specific game being played
   - Detect if this is from a streaming platform (Twitch, YouTube Live, Kick, etc.) - identify the original streaming platform
   - Identify the content type (gameplay, commentary, tutorial, highlight, montage, vlog, etc.)
2. **VISUAL ANALYSIS**: 
   - Scene-by-scene breakdown (first 3 seconds, middle, ending)
   - Camera angles, lighting, color grading
   - Visual effects, transitions, text overlays
   - Motion, energy, pacing throughout
   - Thumbnail-worthy moments
   - Cross-platform watermarks (TikTok/IG/YT logos, burn-ins) — flag if present
3. **AUDIO ANALYSIS**:
   - Speech/dialogue content
   - Background music genre, mood, energy
   - Whether audio sounds original vs trending-sound friendly
   - Sound effects, mix quality, game audio
4. **HOOK ANALYSIS** (mandatory):
   - Exact timestamp of the strongest hook (seconds)
   - What grabs attention in first 1–3 seconds?
   - Is the hook visual, audio, or conceptual?
   - How well does it fit ${platform} vs Facebook-style sharebait?
5. **TRENDING AUDIO / SOUND STRATEGY**:
   - Recommend whether to keep original audio, layer a trending sound, or replace
   - Give a concrete search phrase to find sounds on ${platform} (genre/mood/keywords) — not a fake specific song title unless clearly audible
6. **WATERMARK / CROSS-POST RISK**:
   - Detect visible platform watermarks or UI chrome from another app
   - Advise whether to re-export clean / crop / reframe before posting
7. **ENGAGEMENT + POSTING FIT**:
   - What keeps viewers watching?
   - Best local posting windows for this creator's timezone (${geo.timezone}) using the LIVE algorithm posting tips
8. **PLATFORM ALGORITHM PRIORITIES** — combine LIVE snapshot above with:
- TikTok: early hook, completion, rewatches, comments, trending audio, niche tags
- Instagram Reels: saves/shares, first-line caption, clean visuals, avoid watermarked cross-posts
- YouTube Shorts: title CTR, retention, search keywords, loop potential
9. **SCORING (0-100)**: Hook 25 + Engagement 20 + Visual/Audio 15 + Platform fit 20 + Metadata 20
10. **TAG REQUIREMENTS**:
${
  isYouTubeMetadata
    ? youtubeShortsMetadataPromptBlock()
    : `Mix platform + niche + content tags. Prefer 5–12 high-signal tags for Reels/TikTok (not 30 spam tags). Use # prefix.`
}

Return this exact JSON structure:
{
  "score": <integer 0-100>,
  "scoreTitle": "<Excellent/Good/Fair/Needs Improvement>",
  "scoreSummary": "<2 sentences: main strength + key improvement>",
  "hookStrength": <integer 0-100>,
  "engagementPotential": <integer 0-100>,
  "visualQuality": <integer 0-100>,
  "audioQuality": <integer 0-100>,
  "insights": [
    { "icon": "🎯", "label": "Hook Strength", "value": "<Strong/Moderate/Weak>", "description": "<why + specific fix>", "score": <0-100> },
    { "icon": "⚡", "label": "Engagement Potential", "value": "<High/Medium/Low>", "description": "<why + boost>", "score": <0-100> },
    { "icon": "🎬", "label": "Visual Quality", "value": "<Professional/Good/Fair>", "description": "<why + fix>", "score": <0-100> },
    { "icon": "🔊", "label": "Audio Quality", "value": "<Clear/Muffled/Unbalanced>", "description": "<why + fix>", "score": <0-100> }
  ],
  "hookAnalysis": {
    "timestampSeconds": <number>,
    "type": "<visual|audio|conceptual|mixed>",
    "summary": "<what the hook is>",
    "platformFit": "<how well it fits ${platform}>",
    "improvement": "<specific edit to strengthen the first 1-3s>"
  },
  "trendingAudioAdvice": {
    "recommendation": "<keep_original|layer_trending|replace_with_trending>",
    "rationale": "<why>",
    "searchKeywords": "<concrete sound-search phrase for ${platform}>",
    "mixTip": "<e.g. keep VO loud; layer trend at ~15-25% if useful>"
  },
  "watermarkCheck": {
    "detected": <true|false>,
    "details": "<what was seen or 'none detected'>",
    "action": "<re-export clean / crop edges / safe to post>"
  },
  "postingPlan": {
    "timezone": "${geo.timezone}",
    "areaLabel": "${geo.areaLabel}",
    "bestWindowsLocal": ["<local window 1>", "<local window 2>", "<local window 3>"],
    "frequencyTip": "<how often to post this style on ${platform}>",
    "crossPostNote": "<how this clip may perform vs Facebook Reels if identical cross-post>"
  },
  "recommendations": [
    { "priority": "high", "category": "Hook", "text": "<actionable>" },
    { "priority": "high", "category": "Trending Audio", "text": "<actionable>" },
    { "priority": "high", "category": "Watermark", "text": "<actionable>" },
    { "priority": "med", "category": "Pacing", "text": "<actionable>" },
    { "priority": "med", "category": "Visual", "text": "<actionable>" },
    { "priority": "med", "category": "Posting Time", "text": "<local-time actionable using ${geo.timezone}>" },
    { "priority": "low", "category": "Metadata", "text": "<actionable>" }
  ],
  "overlays": [
    { "type": "text",   "description": "<suggestion>", "timing": "<timestamp>" },
    { "type": "sound", "description": "<suggestion aligned with trendingAudioAdvice>", "timing": "<timestamp>" },
    { "type": "visual", "description": "<suggestion>", "timing": "<timestamp>" },
    { "type": "cta",    "description": "<suggestion>", "timing": "<timestamp>" }
  ],
  "titles": [
    "<title 1>",
    "<title 2>",
    "<title 3>"
  ],
  "description": "<platform-optimized caption/description>",
  "tags": ["<platform-native tags/keywords>"],
  "algorithmUsed": "${algoCtx.algorithmPlatformId}",
  "algorithmUpdatedAt": "${algoCtx.lastUpdated || 'unknown'}"
}
IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside of JSON.
`
              }
            ]
          }
        ]
      }),
      timeoutPromise
    ]) as any
      
      // Parse the response from Google GenAI SDK
      let rawText: string
      try {
        rawText = typeof (geminiResponse as any).text === 'function'
          ? (geminiResponse as any).text()
          : (geminiResponse as any).text ?? ''
      } catch (textError) {
        throw new Error('Gemini returned a response with no readable text — may have been blocked by safety filters')
      }
      
      console.log('[DEBUG] Gemini raw response length:', rawText.length)
      console.log('[DEBUG] Gemini response preview:', rawText.substring(0, 200))
      
      if (rawText) {
        let cleanContent = rawText
        if (rawText.includes('```')) {
          cleanContent = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          console.log('[DEBUG] Removed markdown code blocks from response')
        }
        
        try {
          try {
            analysisResult = JSON.parse(cleanContent)
          } catch {
            const extracted = extractFirstBalancedJsonObject(cleanContent)
            if (!extracted) throw new Error('No JSON object found in Gemini response')
            analysisResult = JSON.parse(extracted)
            console.log('[DEBUG] Parsed first balanced JSON object only (response had trailing content)')
          }
          analysisSource = MODEL_NAME
          console.log('✅ [DEBUG] Gemini analysis successful - parsed JSON with keys:', Object.keys(analysisResult))
          break
        } catch (parseError) {
          console.error('[DEBUG] JSON parse error:', parseError)
          console.error('[DEBUG] Failed content:', cleanContent.substring(0, 500))
          throw parseError
        }
      } else {
        break
      }
    } catch (geminiError: any) {
      const canFallback =
        !attemptedPresignedFallback &&
        clipFromR2 &&
        cleanupR2Key &&
        !cleanupGeminiName &&
        clipIngestionMode === 'r2-presigned-url'

      if (canFallback) {
        attemptedPresignedFallback = true
        console.warn(
          '[clip-analyze] Presigned URL analysis failed; retrying via Gemini Files API:',
          geminiError?.message
        )
        const buffer = await getFileFromR2(cleanupR2Key!)
        if (!buffer) {
          return NextResponse.json(
            {
              error: 'Clip not found',
              userMessage: 'Could not load your upload. Try uploading again.',
            },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey: geminiApiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof fileName === 'string' ? fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(geminiApiKey, uploaded.uri)
        fileUriForGemini = uploaded.uri
        clipIngestionMode = 'r2-gemini-files'
        extractedData = { ...extractedData, source: 'r2-gemini-files-fallback' }
        continue
      }

      console.error('[ERROR] Gemini analysis error:', geminiError)
      console.error('[ERROR] Error type:', geminiError.constructor.name)
      console.error('[ERROR] Error message:', geminiError.message)
      
      const errorMessage = geminiError.message || 'Unknown error'
      
      // Extract HTTP status code if available
      let httpStatus = 'unknown'
      if (geminiError.status) {
        httpStatus = geminiError.status.toString()
      } else if (errorMessage.includes('403') || errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
        httpStatus = '403'
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        httpStatus = '404'
      } else if (errorMessage.includes('timeout')) {
        httpStatus = 'timeout'
      }
      
      console.error('[ERROR] HTTP Status:', httpStatus)
      
      // Handle timeout specifically
      if (errorMessage.includes('timeout')) {
        console.error('[ERROR] Request timed out - video too large or processing too slow')
        return NextResponse.json({ 
          error: 'Analysis timeout',
          userMessage: 'The video is taking too long to analyze. Please try a shorter video or check back later.',
          details: 'Gemini API timeout after 52 seconds'
        }, { status: 504 })
      }
      
      // Handle permission/forbidden errors (credential mismatch)
      if (httpStatus === '403' || errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
        console.error('[ERROR] Permission denied - fileUri uploaded with different credentials')
        return NextResponse.json({ 
          error: 'Permission denied',
          userMessage: 'The file was uploaded with different API credentials than those used for analysis. Please try uploading the file again.',
          details: 'fileUri was uploaded with a different API key than GEMINI_API. Both upload and analysis must use the same GEMINI_API key.'
        }, { status: 403 })
      }
      
      // Handle not found errors (expired URI)
      if (httpStatus === '404' || errorMessage.includes('not found')) {
        console.error('[ERROR] File not found - URI may have expired')
        return NextResponse.json({ 
          error: 'File not found',
          userMessage: 'The uploaded file could not be found. Files API URIs expire after 48 hours. Please upload the file again.',
          details: 'Google Files API URIs expire after 48 hours. The fileUri may have expired or been deleted.'
        }, { status: 404 })
      }
      
      // Handle all other errors
      const errorDetails = `Model: ${MODEL_NAME}, HTTP ${httpStatus}: ${errorMessage}`
      return NextResponse.json({ 
        error: 'Analysis failed',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: errorDetails
      }, { status: 503 })
    }
      }

    // Only Gemini - no fallbacks
    if (!analysisResult) {
      console.log(`[ACTIVITY_LOG] Clip Analyze: Gemini failed to analyze content`)
      
      return NextResponse.json({ 
        error: 'Analysis failed',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'Gemini API analysis failed'
      }, { status: 503 })
    }

    if (analysisResult && typeof analysisResult === 'object') {
      const meta = normalizeClipAnalysisMetadata(platform, {
        title: (analysisResult as Record<string, unknown>).title,
        titles: (analysisResult as Record<string, unknown>).titles,
        description: (analysisResult as Record<string, unknown>).description,
        tags: (analysisResult as Record<string, unknown>).tags,
      })
      analysisResult = {
        ...(analysisResult as Record<string, unknown>),
        title: meta.title,
        titles: meta.titles,
        description: meta.description,
        tags: meta.tags,
      }
    }

    console.log('[DEBUG] Returning successful analysis response:', {
      hasScore: !!analysisResult?.score,
      hasInsights: !!analysisResult?.insights,
      hasRecommendations: !!analysisResult?.recommendations,
      analysisSource: analysisSource,
      extractedDataSize: JSON.stringify(extractedData).length
    })

    const clipCost = estimateClipAnalysisUsd()

    if (!hasUnlimitedAccess(user)) {
      const spend = await spendToolCoins(user, 'clip-analyzer')
      if (!spend.ok) {
        return NextResponse.json(
          { error: spend.reason, required: spend.required, available: spend.available },
          { status: spend.status }
        )
      }
    }

    const response = NextResponse.json({
      ...analysisResult,
      extractedData: extractedData,
      analysisSource: analysisSource,
      backend,
      estimatedCostUsd: clipCost.estimatedCostUsd,
      estimatedCostNote: clipCost.estimatedCostNote,
      algorithmUsed: algoCtx.algorithmPlatformId,
      algorithmUpdatedAt: algoCtx.lastUpdated,
      geo: {
        areaLabel: geo.areaLabel,
        timezone: geo.timezone,
        countryCode: geo.countryCode,
      },
    })

    // Add cache-busting headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('X-Deploy-Hash', 'f3366cc')

    return response
    } finally {
      if (cleanupGeminiName && geminiApiKey) {
        await deleteGeminiUploadedFile(geminiApiKey, cleanupGeminiName).catch((e) =>
          console.warn('[clip-analyze] Gemini temp file cleanup:', e)
        )
      }
      if (cleanupR2Key) {
        await deleteFileFromR2(cleanupR2Key).catch((e) =>
          console.warn('[clip-analyze] R2 clip cleanup:', e)
        )
      }
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[DEBUG] Clip Analyze API: Unhandled error:', error)
    console.error('[DEBUG] Clip Analyze API: Error stack:', error instanceof Error ? error.stack : 'No stack available')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
