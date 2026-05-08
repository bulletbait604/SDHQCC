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
import { generatePresignedReadUrl } from '@/lib/r2'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'

export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'
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
    const platformAlgorithmNotes = snapshot?.data?.[platform] ?? null
    const gemini = new GoogleGenAI({ apiKey })
    let sourceUrl = body.sourceUrl || ''
    if (!sourceUrl && hasR2FileKey) {
      const storageUser = user.username.replace(/^@/, '').toLowerCase()
      const prefix = `uploads/clips/${storageUser}/`
      const key = body.r2FileKey!
      if (!key.startsWith(prefix) || key.includes('..') || key.length > 500) {
        return NextResponse.json({ error: 'Invalid r2FileKey for current user' }, { status: 400 })
      }
      // Long TTL: Shotstack fetches this URL when the render runs (queue can be long); Gemini also uses it during planning.
      const readUrl = await generatePresignedReadUrl(key, 86400)
      if (!readUrl) {
        return NextResponse.json(
          { error: 'Could not prepare uploaded clip for processing' },
          { status: 503 }
        )
      }
      sourceUrl = readUrl
    }

    const response = await gemini.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are the "Viral Architect" engine. Build an upload-click-done package for a short-form video.
Target platform: ${platform}
Platform directive: ${platformEditingDirective(platform)}
Platform safe-zone offsets: ${JSON.stringify(safeZone)}
Stored algorithm notes for this platform (JSON): ${JSON.stringify(platformAlgorithmNotes)}

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
    "preferredTransitions": ["fade|reveal|wipeLeft|wipeRight|slideLeft|slideRight|slideUp|slideDown|zoom"]
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
- Final video is always 9:16 vertical (1080×1920). Sources may be landscape or webcam; the editor reframes to vertical (center-crop to fill by default, or letterbox the full wide frame if the user requests it). Keep faces and key action in the safe caption zone.
- If target platform is reels, still provide Instagram + Facebook Reels variants.
- If target platform is tiktok, still provide TikTok + Reels + Shorts variants.
- If target platform is youtube, prioritize Shorts fields quality and keep title under 70 chars.
- Include at least 8 hashtags for TikTok/Reels captions.
- Keep YouTube Shorts tags array between 10 and 20 items.
- Make the editBlueprint concrete: specify cut cadence, hook intensity, overlays, and transitions aligned with the platform directive and algorithm notes.
- Overlay text must be short, high-retention callouts and avoid covering the primary caption safe zone.

CLIP_BRIEF:
${body.clipBrief.trim()}`,
            },
          ],
        },
      ],
    })

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
      shotstack,
      source: hasR2FileKey ? 'r2-presigned-url' : 'source-url',
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[process-clip]', error)
    const message = error instanceof Error ? error.message : 'process-clip failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
