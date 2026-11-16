import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Modality } from '@google/genai'
import { verifyAuth, AuthError, createAuthErrorResponse, type VerifiedUser } from '@/lib/auth/verifyAuth'
import { refundToolCoins, spendToolCoins } from '@/lib/coins/spendToolCoins'
import { TOOL_COIN_COSTS } from '@/lib/coins/toolCosts'
import { ANIMATED_EMOTE_EXPORT, ANIMATION_NOTE } from '@/lib/emoteMaker/presets'
import { buildEmotePrompt } from '@/lib/emoteMaker/prompt'
import { processGeneratedEmote, referenceForModel } from '@/lib/emoteMaker/process'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_SOURCE_BYTES = 6 * 1024 * 1024
const IMAGE_MODEL_FALLBACKS = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation']

function geminiKey(): string | undefined {
  return process.env.GEMINI_API?.trim() || undefined
}

function imageModelCandidates(): string[] {
  const primary = process.env.THUMBNAIL_GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'
  const seen = new Set<string>()
  const out: string[] = []
  for (const model of [primary, ...IMAGE_MODEL_FALLBACKS]) {
    if (!model || seen.has(model)) continue
    seen.add(model)
    out.push(model)
  }
  return out
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Emote generation failed'
  return message.replace(/AIza[\w-]*/g, '[key]').slice(0, 300)
}

function parseImageDataUrl(value: unknown): Buffer | null {
  if (typeof value !== 'string') return null
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([a-z0-9+/=\r\n]+)$/i.exec(value.trim())
  if (!match) return null
  const buffer = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64')
  if (buffer.length < 32 || buffer.length > MAX_SOURCE_BYTES) return null
  return buffer
}

function clientMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : ''
  if (
    message === 'Describe the emote first.' ||
    message === 'Pick a style.' ||
    message === 'Keep the prompt under 800 characters.' ||
    message === 'That reference image could not be read.'
  ) {
    return message
  }
  return null
}

async function generateEmote(input: {
  apiKey: string
  prompt: string
  referenceJpeg: Buffer | null
}): Promise<{ buffer: Buffer; model: string }> {
  const genAI = new GoogleGenAI({ apiKey: input.apiKey })
  const parts: Array<{ inlineData?: { data?: string; mimeType?: string } } | { text?: string }> = []
  if (input.referenceJpeg) {
    parts.push({
      inlineData: { data: input.referenceJpeg.toString('base64'), mimeType: 'image/jpeg' },
    })
  }
  parts.push({ text: input.prompt })

  let lastError: unknown = null
  for (const model of imageModelCandidates()) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      })
      const responseParts = response.candidates?.[0]?.content?.parts ?? []
      const imagePart = responseParts.find((part) => part.inlineData?.mimeType?.startsWith('image/'))
      const data = imagePart?.inlineData?.data
      if (!data) throw new Error('The image model did not return a picture.')
      return { buffer: Buffer.from(data, 'base64'), model }
    } catch (error) {
      lastError = error
      const message = publicError(error).toLowerCase()
      const missing = message.includes('not found') || message.includes('not supported')
      if (!missing) throw error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No compatible Gemini image model is available.')
}

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request)
    return NextResponse.json({
      available: Boolean(geminiKey()),
      missing: geminiKey() ? null : 'GEMINI_API',
      coinCost: TOOL_COIN_COSTS['emote-maker'],
      animated: ANIMATED_EMOTE_EXPORT,
      animationNote: ANIMATION_NOTE,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    return NextResponse.json({ error: 'Could not check emote generation.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let user: VerifiedUser | null = null
  let spent = 0
  try {
    user = await verifyAuth(request)
    const apiKey = geminiKey()
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Emote generation needs GEMINI_API, the same key the thumbnail generator uses. It is not set in this environment.',
          code: 'missing_gemini_api',
        },
        { status: 503 }
      )
    }

    const body = (await request.json()) as {
      prompt?: unknown
      style?: unknown
      transparent?: unknown
      referenceImageDataUrl?: unknown
    }
    const promptText = typeof body.prompt === 'string' ? body.prompt : ''
    const style = typeof body.style === 'string' ? body.style : ''
    const transparent = body.transparent !== false
    let instruction = ''
    try {
      instruction = buildEmotePrompt({
        prompt: promptText,
        style,
        transparent,
        hasReference: typeof body.referenceImageDataUrl === 'string' && body.referenceImageDataUrl.length > 0,
      })
    } catch (error) {
      const message = clientMessage(error)
      return NextResponse.json({ error: message || 'Check the prompt and try again.' }, { status: 400 })
    }

    let referenceJpeg: Buffer | null = null
    if (typeof body.referenceImageDataUrl === 'string' && body.referenceImageDataUrl.length > 0) {
      const reference = parseImageDataUrl(body.referenceImageDataUrl)
      if (!reference) {
        return NextResponse.json({ error: 'Reference images must be JPG, PNG, WebP, or GIF under 6 MB.' }, { status: 400 })
      }
      try {
        referenceJpeg = await referenceForModel(reference)
      } catch (error) {
        const message = clientMessage(error)
        return NextResponse.json({ error: message || 'That reference image could not be read.' }, { status: 400 })
      }
    }

    const spend = await spendToolCoins(user, 'emote-maker')
    if (!spend.ok) {
      return NextResponse.json(
        { error: spend.reason, required: spend.required, available: spend.available },
        { status: spend.status }
      )
    }
    spent = spend.deducted

    const generated = await generateEmote({ apiKey, prompt: instruction, referenceJpeg })
    const processed = await processGeneratedEmote({ image: generated.buffer, transparent })
    spent = 0

    return NextResponse.json({
      mimeType: 'image/png',
      width: processed.width,
      height: processed.height,
      transparent: processed.backgroundRemoved,
      backgroundRemoved: processed.backgroundRemoved,
      model: generated.model,
      animated: ANIMATED_EMOTE_EXPORT,
      animationNote: ANIMATION_NOTE,
      imageDataUrl: `data:image/png;base64,${processed.png.toString('base64')}`,
    })
  } catch (error) {
    if (user && spent > 0) {
      await refundToolCoins(user, 'emote-maker', spent).catch(() => {})
    }
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[emote-maker]', publicError(error))
    return NextResponse.json({ error: publicError(error) }, { status: 500 })
  }
}
