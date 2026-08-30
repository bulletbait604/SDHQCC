import { GoogleGenAI } from '@google/genai'
import { extractBalancedJsonObject } from '@/lib/algorithmPlatformNormalize'
import {
  VIRAL_CLIP_ASPECT_RATIO,
  splitDurationIntoNativeChunks,
  viralClipGenGeminiModel,
  type ViralClipDuration,
} from '@/lib/viralClipGen/config'

export type ViralClipReference = {
  base64: string
  mimeType: string
}

export type ViralClipSegmentPlan = {
  duration: number
  prompt: string
}

export type ViralClipVideoPlan = {
  falPrompt: string
  negativePrompt: string
  mood: string
  camera: string
  lighting: string
  visualStyle: string
  composition: string
  pacing: string
  environment: string
  subject: string
  action: string
  referenceNotes: string
  segments: ViralClipSegmentPlan[]
  rawModel: string
}

function stripDataUrlPrefix(raw: string): string {
  return raw.replace(/^data:[^;]+;base64,/, '').trim()
}

function asTrimmed(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function geminiText(response: { text?: string }): string {
  if (typeof response.text === 'string' && response.text.trim()) return response.text
  const rec = response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = rec.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim()
}

function parsePlanJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const balanced = extractBalancedJsonObject(trimmed)
    if (!balanced) return null
    try {
      return JSON.parse(balanced) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function buildPlanPrompt(params: {
  userPrompt: string
  duration: ViralClipDuration
  chunks: number[]
  imageCount: number
}): string {
  const chunkList = params.chunks.map((d, i) => `${i + 1}) ${d}s`).join(', ')
  return `You are a short-form video director for TikTok / YouTube Shorts / Instagram Reels.

Convert the creator brief into a concise fal.ai video-generation plan.
Output format is ${VIRAL_CLIP_ASPECT_RATIO} vertical, ${params.duration} seconds total.

The fal model generates native clips of 5s or 10s. Split the story across these segments in order: ${chunkList}.
Each segment prompt must be a self-contained image-to-video / text-to-video instruction (subject, action, camera, lighting, style). Later segments should continue the same subject and world.

${params.imageCount > 0
    ? `${params.imageCount} reference image(s) are attached. Match identity, wardrobe, palette, and composition. Mention that the person/object in the references is the hero.`
    : 'No reference images — invent a clear visual from the brief.'}

Creator brief:
"""
${params.userPrompt.replace(/"""/g, '"')}
"""

Return ONLY JSON:
{
  "subject": "",
  "action": "",
  "environment": "",
  "camera": "",
  "lighting": "",
  "visualStyle": "",
  "composition": "",
  "mood": "",
  "pacing": "",
  "referenceNotes": "how the references were used, or empty",
  "falPrompt": "one overall fal prompt (under 1800 chars)",
  "negativePrompt": "things to avoid",
  "segments": [
    { "duration": ${params.chunks[0] ?? 5}, "prompt": "segment 1 fal prompt" }
  ]
}

Rules:
- segments length must be ${params.chunks.length} with durations ${JSON.stringify(params.chunks)}.
- Do not mention UI, credits, or being an AI.
- Keep prompts concrete and cinematic, not poetic.`
}

export async function planViralClip(params: {
  userPrompt: string
  duration: ViralClipDuration
  references: ViralClipReference[]
}): Promise<ViralClipVideoPlan> {
  const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
  if (!apiKey) throw new Error('GEMINI_API is not configured')

  const chunks = splitDurationIntoNativeChunks(params.duration)
  const model = viralClipGenGeminiModel()
  const genAI = new GoogleGenAI({ apiKey })

  const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = []
  for (const ref of params.references.slice(0, 5)) {
    parts.push({
      inlineData: {
        data: stripDataUrlPrefix(ref.base64),
        mimeType: ref.mimeType.startsWith('image/') ? ref.mimeType : 'image/jpeg',
      },
    })
  }
  parts.push({
    text: buildPlanPrompt({
      userPrompt: params.userPrompt,
      duration: params.duration,
      chunks,
      imageCount: params.references.length,
    }),
  })

  const response = await genAI.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: { temperature: 0.4 },
  })

  const raw = geminiText(response as { text?: string })
  const parsed = parsePlanJson(raw)
  if (!parsed) throw new Error('Could not plan this clip. Try a clearer prompt.')

  const falPrompt =
    asTrimmed(parsed.falPrompt, 1800) || asTrimmed(parsed.prompt, 1800) || params.userPrompt
  const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : []
  const segments: ViralClipSegmentPlan[] = chunks.map((duration, i) => {
    const rec = rawSegments[i] && typeof rawSegments[i] === 'object'
      ? (rawSegments[i] as Record<string, unknown>)
      : null
    return {
      duration,
      prompt: asTrimmed(rec?.prompt, 1800) || falPrompt,
    }
  })

  return {
    falPrompt,
    negativePrompt: asTrimmed(parsed.negativePrompt, 600),
    mood: asTrimmed(parsed.mood, 200),
    camera: asTrimmed(parsed.camera, 200),
    lighting: asTrimmed(parsed.lighting, 200),
    visualStyle: asTrimmed(parsed.visualStyle, 200),
    composition: asTrimmed(parsed.composition, 200),
    pacing: asTrimmed(parsed.pacing, 200),
    environment: asTrimmed(parsed.environment, 200),
    subject: asTrimmed(parsed.subject, 200),
    action: asTrimmed(parsed.action, 200),
    referenceNotes: asTrimmed(parsed.referenceNotes, 400),
    segments,
    rawModel: model,
  }
}
