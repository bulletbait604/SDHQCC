import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
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
import {
  clipEditorOpenAiModel,
  resolveDeepSeekApiKey,
  resolveOpenAiApiKey,
} from '@/lib/clipEditorServerKeys'

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
  preferredTransitions?: string[]
  sourceMoments?: Array<{
    startSeconds?: number
    endSeconds?: number
    reason?: string
    visualTreatment?: 'none' | 'slowZoomIn' | 'slowZoomOut'
  }>
  textOverlays?: Array<{
    text?: string
    timelineStartSeconds?: number
    sourceStartSeconds?: number
    sourceMomentIndex?: number
    offsetSeconds?: number
    durationSeconds?: number
    position?: 'top' | 'middle' | 'bottom'
    type?: 'callout'
  }>
  subtitles?: Array<{
    text?: string
    timelineStartSeconds?: number
    sourceStartSeconds?: number
    sourceMomentIndex?: number
    offsetSeconds?: number
    durationSeconds?: number
    position?: 'bottom'
    type?: 'subtitle'
  }>
}

type ClipEditPlan = {
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
  aiProvidersUsed?: string[]
}

const SHOTSTACK_RENDERER_CONTRACT = `SHOTSTACK_RENDERER_CONTRACT:
- Output is a vertical 9:16 Shotstack edit (1080x1920).
- Renderer builds ONE main video track from sourceMoments. It does not support duplicate video layers, picture-in-picture, music beds, sound effects, stickers, stock b-roll, or transition stacks.
- Renderer supports sourceMoments ordered in final edit order. Each sourceMoment uses original SOURCE timestamps.
- Renderer will target at least 8 seconds unless the uploaded source is shorter. Select enough sourceMoments to cover the requested renderSeconds.
- Renderer supports visualTreatment on sourceMoments: "slowZoomIn", "slowZoomOut", or "none". Use this for emphasis, not on every cut.
- Renderer supports timed textOverlays: max 3 callouts. Use sourceMomentIndex + offsetSeconds whenever possible so the text appears over that selected moment in the final cut.
- Renderer supports timed subtitles: max 8 short snippets. Use sourceMomentIndex + offsetSeconds whenever possible.
- sourceMomentIndex is the 0-based index of the sourceMoments array AFTER your final ordering, not a source timestamp and not a timeline segment index.
- timelineStartSeconds means seconds in the FINAL rendered clip. sourceStartSeconds means seconds in the ORIGINAL uploaded source. Do not confuse them.
- Prefer sourceMomentIndex + offsetSeconds for every overlay/subtitle; only use timelineStartSeconds when you have computed the final rendered timeline position and it is inside the clip.
- Keep textOverlays readable: durationSeconds should usually be 1.6 to 3.0 seconds. Do not flash text for less than 1.5 seconds.
- Unsupported requests in shotstackEditPrompt will be ignored. Make the JSON fields do the work.`

function buildDirectorPrompt(params: {
  platform: TargetPlatform
  clipBrief: string
  sourceDurationSeconds?: number
  platformAlgorithmNotes: unknown
  geminiPlan: ClipEditPlan
  priorPlan?: ClipEditPlan
  role: 'director' | 'critic'
}): string {
  const planToReview = params.priorPlan || params.geminiPlan
  return `You are the ${params.role === 'critic' ? 'final quality-control editor' : 'senior edit director'} for a short-form clip editor.

Target platform: ${params.platform}
Platform directive: ${platformEditingDirective(params.platform)}
Source duration seconds: ${typeof params.sourceDurationSeconds === 'number' ? params.sourceDurationSeconds : 'unknown'}
Creator brief: ${params.clipBrief}
Algorithm context JSON: ${JSON.stringify(params.platformAlgorithmNotes)}

${SHOTSTACK_RENDERER_CONTRACT}

Gemini video-understanding draft JSON:
${JSON.stringify(params.geminiPlan)}

Plan to review JSON:
${JSON.stringify(planToReview)}

Return one JSON object using the same high-level shape. Your job is to improve only the edit plan and publishing copy.

Rules:
- Respect Gemini's actual video understanding. Prefer its timestamped sourceMoments; only reorder or trim them if the draft itself supports it.
- Think like StreamLadder/OpusClip: clip selection first, then reframing/zoom, captions/callouts, pacing, metadata.
- Use visualTreatment on sourceMoments only when a slow zoom helps attention. Leave most moments as "none".
- Use textOverlays only for grounded callouts from visible/spoken clip content. No generic hype text, no unrelated slogans. Prefer sourceMomentIndex + offsetSeconds so text lands inside the final cut.
- Use subtitles only for short spoken lines you are confident were said in the clip. Prefer sourceMomentIndex + offsetSeconds. If unsure, return [].
- Keep sourceMoments in final edit order with the strongest hook first.
- Choose 3-8 sourceMoments, each with startSeconds, endSeconds, reason, and visualTreatment.
- The combined selected sourceMoments should cover at least 10-18 seconds for normal source clips. Do not return a 1-3 second final edit unless the uploaded source itself is that short.
- Avoid repeated adjacent source ranges that would look like screen flashing.
- Keep renderSeconds realistic for the useful source moments.
- Timing contract: sourceMoments use original source timestamps. textOverlays/subtitles should use either sourceMomentIndex plus offsetSeconds, or timelineStartSeconds in the final rendered clip. Do not use source timestamps as timelineStartSeconds.
- If text cannot be placed confidently inside a selected sourceMoment, omit it.
- Return valid JSON only, no markdown.`
}

async function refineWithOpenAI(params: Parameters<typeof buildDirectorPrompt>[0]): Promise<ClipEditPlan | null> {
  const apiKey = resolveOpenAiApiKey()
  if (!apiKey) return null
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: clipEditorOpenAiModel(),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a practical video editor. Return only valid JSON.',
      },
      { role: 'user', content: buildDirectorPrompt(params) },
    ],
    temperature: 0.35,
  })
  const raw = completion.choices[0]?.message?.content?.trim() || ''
  const jsonSlice = extractFirstJsonObject(raw) || raw
  return JSON.parse(jsonSlice || '{}') as ClipEditPlan
}

async function refineWithDeepSeek(params: Parameters<typeof buildDirectorPrompt>[0]): Promise<ClipEditPlan | null> {
  const apiKey = resolveDeepSeekApiKey()
  if (!apiKey) return null
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a practical video editor and quality-control reviewer. Return only valid JSON.',
        },
        { role: 'user', content: buildDirectorPrompt(params) },
      ],
      temperature: 0.35,
      max_tokens: 2500,
    }),
  })
  if (!res.ok) {
    throw new Error(`DeepSeek edit director failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content?.trim() || ''
  const jsonSlice = extractFirstJsonObject(raw) || raw
  return JSON.parse(jsonSlice || '{}') as ClipEditPlan
}

async function refineClipEditPlan(params: {
  platform: TargetPlatform
  clipBrief: string
  sourceDurationSeconds?: number
  platformAlgorithmNotes: unknown
  geminiPlan: ClipEditPlan
}): Promise<ClipEditPlan> {
  let plan = params.geminiPlan
  const providersUsed = ['gemini-video']

  try {
    const openAiPlan = await refineWithOpenAI({ ...params, role: 'director' })
    if (openAiPlan) {
      plan = openAiPlan
      providersUsed.push('openai-director')
    }
  } catch (error) {
    console.warn('[process-clip] OpenAI edit director failed:', error)
  }

  try {
    const deepSeekPlan = await refineWithDeepSeek({
      ...params,
      priorPlan: plan,
      role: providersUsed.includes('openai-director') ? 'critic' : 'director',
    })
    if (deepSeekPlan) {
      plan = deepSeekPlan
      providersUsed.push(providersUsed.includes('openai-director') ? 'deepseek-critic' : 'deepseek-director')
    }
  } catch (error) {
    console.warn('[process-clip] DeepSeek edit director failed:', error)
  }

  return { ...plan, aiProvidersUsed: providersUsed }
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

${SHOTSTACK_RENDERER_CONTRACT}

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
    "preferredTransitions": ["fade|reveal|wipeLeft|wipeRight|slideLeft|slideRight|slideUp|slideDown|zoom"],
    "sourceMoments": [
      { "startSeconds": "number", "endSeconds": "number", "reason": "why this exact moment should be used", "visualTreatment": "none|slowZoomIn|slowZoomOut" }
    ],
    "textOverlays": [
      { "text": "short grounded callout from visible/spoken clip content", "sourceMomentIndex": "number 0-based", "offsetSeconds": "number within that selected moment", "timelineStartSeconds": "optional number in final render timeline", "durationSeconds": "number 1.6..3.0", "position": "top|middle|bottom", "type": "callout" }
    ],
    "subtitles": [
      { "text": "short spoken line from the clip", "sourceMomentIndex": "number 0-based", "offsetSeconds": "number within that selected moment", "timelineStartSeconds": "optional number in final render timeline", "durationSeconds": "number 1.4..3.2", "position": "bottom", "type": "subtitle" }
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
- Build this like a viral human editor using a StreamLadder/OpusClip style workflow: find the strongest hook, cut dead air, preserve context, escalate, deliver payoff, then optionally end on a loopable beat.
- First 0-2 seconds: start on the highest-retention source moment. It can be a reaction, impact frame, surprising line, visible outcome, or conflict point. Do not start with setup unless setup itself is compelling.
- Pick 3-8 sourceMoments from the strongest visual/audio moments in the actual clip. Order them in FINAL EDIT ORDER, not chronological order, with the best hook first.
- Select enough sourceMoments to make the final edit feel complete: usually 10-18 seconds total for a normal uploaded clip, never 1-3 seconds unless the source video is only that long.
- For each sourceMoment, use exact original source timestamps, a reason tied to what is seen/heard, and visualTreatment.
- Every selected moment must serve one role: hook, context, escalation, punchline/payoff, proof, or loop.
- Remove dead air, menus, loading screens, long pauses, repeated frames, streamer silence, and context that does not raise retention.
- Use visualTreatment sparingly: mark at most 3 sourceMoments for slowZoomIn or slowZoomOut when it improves focus on a face, gameplay action, reaction, or readable UI. Otherwise use none.
- textOverlays must be grounded in visible/spoken clip content and timed to the relevant selected moment. Use 0-3 total. Do not invent unrelated text.
- subtitles must be short spoken lines from the clip. Use [] if speech is unclear.
- CRITICAL TIMING: sourceMoments use original source timestamps. textOverlays/subtitles should use sourceMomentIndex + offsetSeconds, or timelineStartSeconds in the final rendered clip. Do not put original source timestamps in timelineStartSeconds.
- sourceMomentIndex is the 0-based index of your final ordered sourceMoments array. If sourceMoments[0] is the hook, sourceMomentIndex 0 means text appears during that hook in the final rendered clip.
- Do not place overlays/subtitles after the last useful cut. Every text clip must appear while its relevant selected sourceMoment is visible.
- Avoid generic overlays like "Wait for it", "You won't believe this", "Epic moment", unless that phrase is actually spoken/visible or specifically true for the clip.
- Prefer 1 strong callout in the first 1.5 seconds if it clarifies the hook. Otherwise skip callouts and rely on subtitles.
- Make text readable. Callouts should stay on screen about 1.6-3.0 seconds; subtitles about 1.4-3.2 seconds.
- For gameplay/stream clips: prioritize kills, fails, clutch moments, rage/reaction, chat-worthy lines, visual outcome, scoreboard/proof, or sudden reversal.
- For talking clips: prioritize bold claim, contradiction, actionable takeaway, emotional reaction, or concise quote.
- Optimize by platform:
  - TikTok: fastest hook, dense cuts, visible payoff, punchy captions, no slow intro.
  - YouTube Shorts: immediate clarity, title/description strong SEO, loop ending when possible.
  - Reels: cleaner pacing, fewer but better callouts, visually polished framing.
- Final video is always 9:16 vertical (1080×1920). Sources may be landscape or webcam; the editor reframes to vertical (center-crop to fill by default, or letterbox the full wide frame if the user requests it). Keep faces and key action in the safe caption zone.
- Use every available source in the clip-editor algorithm context. For Reels, blend Instagram Reels and Facebook Reels advice; for YouTube, prioritize Shorts while borrowing applicable long-form retention/title lessons.
- If target platform is reels, still provide Instagram + Facebook Reels variants.
- If target platform is tiktok, still provide TikTok + Reels + Shorts variants.
- If target platform is youtube, prioritize Shorts fields quality and keep title under 70 chars.
- Include at least 8 hashtags for TikTok/Reels captions.
- Keep YouTube Shorts tags array between 10 and 20 items.
- Make the editBlueprint concrete: specify cut cadence, hook intensity, source moments, selective zooms, grounded text overlays/subtitles, and platform pacing aligned with the platform directive and algorithm notes.

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
    const geminiPlan = JSON.parse(jsonSlice || '{}') as ClipEditPlan
    const sourceDurationSeconds =
      typeof body.sourceDurationSeconds === 'number' && Number.isFinite(body.sourceDurationSeconds)
        ? body.sourceDurationSeconds
        : undefined
    const parsed = await refineClipEditPlan({
      platform,
      clipBrief,
      sourceDurationSeconds,
      platformAlgorithmNotes,
      geminiPlan,
    })

    const captionForVideo =
      (parsed.captionText && parsed.captionText.trim()) ||
      (parsed.hookPlan && parsed.hookPlan.trim()) ||
      ''

    const lm = body.landscapeMode === 'letterbox' ? 'letterbox' : 'crop'
    const editBlueprint = parsed.editBlueprint

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
      aiProvidersUsed: parsed.aiProvidersUsed || ['gemini-video'],
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
