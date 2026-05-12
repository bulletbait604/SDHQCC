import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import {
  platformEditingDirective,
  platformSafeZoneOffsets,
  type TargetPlatform,
} from '@/lib/platformEditing'
import { generateShotstackJSON } from '@/lib/generateShotstackJSON'
import { generatePresignedReadUrl, getFileFromR2, getR2ObjectMetadata } from '@/lib/r2'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import {
  resolveClipEditorAlgorithmNotes,
  summarizeClipEditorAlgorithmSources,
} from '@/lib/clipEditorAlgorithmNotes'
import {
  deleteGeminiUploadedFile,
  pollGeminiFileUntilActive,
  uploadBufferToGeminiFilesApi,
} from '@/lib/geminiFiles'

export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'
const GEMINI_EXTERNAL_URL_MAX_BYTES = 100 * 1024 * 1024
function isTargetPlatform(value: string): value is TargetPlatform {
  return value === 'tiktok' || value === 'youtube' || value === 'reels'
}

function extractFirstJsonObject(raw: string): string | null {
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

type EditBlueprint = {
  cutSeconds?: number
  introHookSeconds?: number
  renderSeconds?: number
  captionWordsPerChunk?: number
  overlayTexts?: string[]
  preferredTransitions?: string[]
  sourceMoments?: Array<{
    startSeconds?: number
    endSeconds?: number
    reason?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const body = (await request.json()) as {
      platform?: string
      clipBrief?: string
      sourceUrl?: string
      r2FileKey?: string
      landscapeMode?: 'crop' | 'letterbox'
      sourceDurationSeconds?: number
      mimeType?: string
      fileName?: string
    }

    if (!body.platform || !isTargetPlatform(body.platform)) {
      return NextResponse.json(
        { error: "platform is required and must be one of: 'tiktok' | 'youtube' | 'reels'" },
        { status: 400 }
      )
    }
    if (!body.clipBrief || body.clipBrief.trim().length < 10) {
      return NextResponse.json({ error: 'clipBrief is required' }, { status: 400 })
    }
    const clipBrief = body.clipBrief.trim()
    const hasSourceUrl = typeof body.sourceUrl === 'string' && /^https?:\/\//i.test(body.sourceUrl)
    const hasR2FileKey = typeof body.r2FileKey === 'string' && body.r2FileKey.length > 0
    if (!hasSourceUrl && !hasR2FileKey) {
      return NextResponse.json(
        { error: 'Provide either sourceUrl (http/https) or r2FileKey from upload flow' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API is not configured' }, { status: 503 })
    }

    const platform = body.platform
    const safeZone = platformSafeZoneOffsets(platform)
    const snapshot = await readAlgorithmSnapshotFromMongo()
    const platformAlgorithmNotes = resolveClipEditorAlgorithmNotes(snapshot, platform)
    const gemini = new GoogleGenAI({ apiKey })
    let sourceUrl = body.sourceUrl || ''
    let geminiFileUri = sourceUrl
    let effectiveMime = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'video/mp4'
    let cleanupGeminiName: string | null = null
    let r2KeyForGeminiFallback: string | null = null
    if (!sourceUrl && hasR2FileKey) {
      const storageUser = user.username.replace(/^@/, '').toLowerCase()
      const prefix = `uploads/clips/${storageUser}/`
      const key = body.r2FileKey!
      if (!key.startsWith(prefix) || key.includes('..') || key.length > 500) {
        return NextResponse.json({ error: 'Invalid r2FileKey for current user' }, { status: 400 })
      }
      r2KeyForGeminiFallback = key
      const meta = await getR2ObjectMetadata(key)
      if (!meta) {
        return NextResponse.json(
          { error: 'Could not read uploaded clip metadata' },
          { status: 404 }
        )
      }
      effectiveMime = meta.contentType || effectiveMime
      // Long TTL: Shotstack fetches this URL when the render runs (queue can be long); Gemini also uses it during planning.
      const readUrl = await generatePresignedReadUrl(key, 86400)
      if (!readUrl) {
        return NextResponse.json(
          { error: 'Could not prepare uploaded clip for processing' },
          { status: 503 }
        )
      }
      sourceUrl = readUrl
      geminiFileUri = readUrl

      if (meta.contentLength > GEMINI_EXTERNAL_URL_MAX_BYTES) {
        const buffer = await getFileFromR2(key)
        if (!buffer) {
          return NextResponse.json(
            { error: 'Could not load uploaded clip for Gemini analysis' },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof body.fileName === 'string' ? body.fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(apiKey, uploaded.uri)
        geminiFileUri = uploaded.uri
      }
    }

    try {
      const createGeminiRequest = () => ({
        model: MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: effectiveMime,
                  fileUri: geminiFileUri,
                },
              },
              {
                text: `You are the "Viral Architect" engine. Build an upload-click-done package for a short-form video.
Target platform: ${platform}
Platform directive: ${platformEditingDirective(platform)}
Platform safe-zone offsets: ${JSON.stringify(safeZone)}
Clip-editor algorithm context (JSON): ${JSON.stringify(platformAlgorithmNotes)}
Source duration seconds: ${typeof body.sourceDurationSeconds === 'number' ? body.sourceDurationSeconds : 'unknown'}

Return valid JSON only:
{
  "captionText": "string (on-video caption)",
  "hookPlan": "string",
  "pacePlan": "string",
  "facecamGuidance": "string",
  "shotstackEditPrompt": "string (clear editing instructions for Shotstack timeline setup, pacing, visual emphasis, and platform-safe framing)",
  "editBlueprint": {
    "cutSeconds": "number 1.0..4.5",
    "introHookSeconds": "number 1.0..5.0",
    "renderSeconds": "number 8..45",
    "captionWordsPerChunk": "number 3..14",
    "overlayTexts": ["short overlay callouts, max 6"],
    "preferredTransitions": ["fade|reveal|wipeLeft|wipeRight|slideLeft|slideRight|slideUp|slideDown|zoom"],
    "sourceMoments": [
      { "startSeconds": "number", "endSeconds": "number", "reason": "why this exact moment should be used" }
    ]
  },
  "publishPackage": {
    "tiktok": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "instagramReels": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "facebookReels": {
      "captionWithEmojisAndTags": "string with emojis and hashtags"
    },
    "youtubeShorts": {
      "title": "string",
      "description": "string with emojis",
      "tags": ["string"]
    }
  }
}

Rules:
- Analyze the supplied video file directly. Do not create a generic edit plan from the text brief alone.
- Pick 3-8 sourceMoments from the strongest visual/audio moments in the actual clip. Order them in final edit order with the best hook first. Use exact timestamps and prefer moments with clear action, speech payoff, reactions, surprises, or loop potential.
- The generated render should start on the strongest hook moment, not automatically at 0:00 unless 0:00 is genuinely the best hook.
- Final video is always 9:16 vertical (1080×1920). Sources may be landscape or webcam; the editor reframes to vertical (center-crop to fill by default, or letterbox the full wide frame if the user requests it). Keep faces and key action in the safe caption zone.
- Use every available source in the clip-editor algorithm context. For Reels, blend Instagram Reels and Facebook Reels advice; for YouTube, prioritize Shorts while borrowing applicable long-form retention/title lessons.
- If target platform is reels, still provide Instagram + Facebook Reels variants.
- If target platform is tiktok, still provide TikTok + Reels + Shorts variants.
- If target platform is youtube, prioritize Shorts fields quality and keep title under 70 chars.
- Include at least 8 hashtags for TikTok/Reels captions.
- Keep YouTube Shorts tags array between 10 and 20 items.
- Make the editBlueprint concrete: specify cut cadence, hook intensity, overlays, and transitions aligned with the platform directive and algorithm notes.
- Overlay text must be short, high-retention callouts and avoid covering the primary caption safe zone.

CLIP_BRIEF:
${clipBrief}`,
              },
            ],
          },
        ],
      })

      let response
      try {
        response = await gemini.models.generateContent(createGeminiRequest())
      } catch (geminiError) {
        if (!r2KeyForGeminiFallback || cleanupGeminiName) {
          throw geminiError
        }

        console.warn(
          '[process-clip] Presigned URL analysis failed; retrying via Gemini Files API:',
          geminiError instanceof Error ? geminiError.message : geminiError
        )
        const buffer = await getFileFromR2(r2KeyForGeminiFallback)
        if (!buffer) {
          return NextResponse.json(
            { error: 'Could not load uploaded clip for Gemini analysis' },
            { status: 404 }
          )
        }
        const uploaded = await uploadBufferToGeminiFilesApi({
          apiKey,
          buffer,
          mimeType: effectiveMime,
          displayName: typeof body.fileName === 'string' ? body.fileName : 'clip.mp4',
        })
        cleanupGeminiName = uploaded.name
        await pollGeminiFileUntilActive(apiKey, uploaded.uri)
        geminiFileUri = uploaded.uri
        response = await gemini.models.generateContent(createGeminiRequest())
      }

    const raw = typeof response.text === 'string' ? response.text : ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const jsonSlice = extractFirstJsonObject(clean) || clean
    const parsed = JSON.parse(jsonSlice || '{}') as {
      captionText?: string
      hookPlan?: string
      pacePlan?: string
      facecamGuidance?: string
      shotstackEditPrompt?: string
      editBlueprint?: EditBlueprint
      publishPackage?: {
        tiktok?: { captionWithEmojisAndTags?: string }
        instagramReels?: { captionWithEmojisAndTags?: string }
        facebookReels?: { captionWithEmojisAndTags?: string }
        youtubeShorts?: { title?: string; description?: string; tags?: string[] }
      }
    }

    const captionForVideo =
      (parsed.captionText && parsed.captionText.trim()) ||
      (parsed.hookPlan && parsed.hookPlan.trim()) ||
      ''

    const lm = body.landscapeMode === 'letterbox' ? 'letterbox' : 'crop'
    const editBlueprint = parsed.editBlueprint
    const sourceDurationSeconds =
      typeof body.sourceDurationSeconds === 'number' && Number.isFinite(body.sourceDurationSeconds)
        ? body.sourceDurationSeconds
        : undefined

    const shotstack = generateShotstackJSON({
      title: `Viral Architect ${platform}`,
      sourceUrl,
      platform,
      captionText: captionForVideo || undefined,
      safeZone,
      shotstackEditPrompt: parsed.shotstackEditPrompt,
      hookPlan: parsed.hookPlan,
      pacePlan: parsed.pacePlan,
      landscapeMode: lm,
      editBlueprint,
      sourceDurationSeconds,
    })

    return NextResponse.json({
      platform,
      model: MODEL_NAME,
      safeZone,
      analysis: parsed,
      shotstackEditPrompt:
        parsed.shotstackEditPrompt ||
        `${parsed.hookPlan || ''} ${parsed.pacePlan || ''} ${parsed.facecamGuidance || ''}`.trim(),
      editBlueprint: editBlueprint || null,
      publishPackage: parsed.publishPackage || null,
      algorithmContext: summarizeClipEditorAlgorithmSources(platformAlgorithmNotes),
      shotstack,
      source: hasR2FileKey ? 'r2-presigned-url' : 'source-url',
    })
    } finally {
      if (cleanupGeminiName) {
        await deleteGeminiUploadedFile(apiKey, cleanupGeminiName).catch((e) =>
          console.warn('[process-clip] Gemini temp file cleanup:', e)
        )
      }
    }
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[process-clip]', error)
    const message = error instanceof Error ? error.message : 'process-clip failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
