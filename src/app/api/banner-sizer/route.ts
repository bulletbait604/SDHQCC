import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { GoogleGenAI, Modality } from '@google/genai'
import { verifyAuth, AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { spendToolCoins } from '@/lib/coins/spendToolCoins'
import { bannerPreset } from '@/lib/bannerSizer/presets'
import { buildAiModelInput, compositeSubjectOverFill, type PlacedRect } from '@/lib/bannerSizer/aiComposite'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_SOURCE_BYTES = 6 * 1024 * 1024
const IMAGE_MODEL_FALLBACKS = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
]

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
  const message = error instanceof Error ? error.message : 'AI fill failed'
  return message.replace(/AIza[\w-]*/g, '[key]').slice(0, 300)
}

function parseImageDataUrl(value: unknown): { mime: string; buffer: Buffer } | null {
  if (typeof value !== 'string') return null
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(value.trim())
  if (!match) return null
  const buffer = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64')
  if (buffer.length < 32 || buffer.length > MAX_SOURCE_BYTES) return null
  const mime = match[1]!.toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1]!.toLowerCase()
  return { mime, buffer }
}

function readPlacement(value: unknown, width: number, height: number): PlacedRect | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const dx = Number(raw.dx)
  const dy = Number(raw.dy)
  const dw = Number(raw.dw)
  const dh = Number(raw.dh)
  if (![dx, dy, dw, dh].every((n) => Number.isFinite(n))) return null
  if (dw < 1 || dh < 1 || dw > width * 8 || dh > height * 8) return null
  const intersects = dx < width && dy < height && dx + dw > 0 && dy + dh > 0
  if (!intersects) return null
  return { dx, dy, dw, dh }
}

function coversFrame(placed: PlacedRect, width: number, height: number): boolean {
  return placed.dx <= 1 && placed.dy <= 1 && placed.dx + placed.dw >= width - 1 && placed.dy + placed.dh >= height - 1
}

async function generateFill(input: {
  apiKey: string
  jpeg: Buffer
  width: number
  height: number
}): Promise<{ buffer: Buffer; model: string }> {
  const genAI = new GoogleGenAI({ apiKey: input.apiKey })
  const prompt = [
    'Extend this banner to the edges of the frame.',
    `The frame is ${input.width} by ${input.height} pixels.`,
    'The photograph is already placed in the frame. Do not move, crop, stretch, or redraw the existing subject, face, logo, or text.',
    'Paint only the flat empty margins so the scene continues. Do not add words, logos, watermarks, or a border.',
    'Return one image with the same aspect ratio as the input.',
  ].join(' ')

  let lastError: unknown = null
  for (const model of imageModelCandidates()) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: input.jpeg.toString('base64'), mimeType: 'image/jpeg' } },
              { text: prompt },
            ],
          },
        ],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      })
      const parts = response.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find((part) => part.inlineData?.mimeType?.startsWith('image/'))
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
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    return NextResponse.json({ error: 'Could not check AI fill.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const apiKey = geminiKey()
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'AI fill needs GEMINI_API, the same key the thumbnail generator uses. It is not set in this environment.',
          code: 'missing_gemini_api',
        },
        { status: 503 }
      )
    }

    const body = (await request.json()) as { presetId?: unknown; imageDataUrl?: unknown; placement?: unknown }
    const preset = typeof body.presetId === 'string' ? bannerPreset(body.presetId) : undefined
    if (!preset) return NextResponse.json({ error: 'Unknown banner preset.' }, { status: 400 })

    const image = parseImageDataUrl(body.imageDataUrl)
    if (!image) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP under 6 MB.' }, { status: 400 })
    }
    const placement = readPlacement(body.placement, preset.width, preset.height)
    if (!placement) return NextResponse.json({ error: 'The crop placement is invalid.' }, { status: 400 })

    if (coversFrame(placement, preset.width, preset.height)) {
      return NextResponse.json({
        covered: true,
        message: 'This photo already covers the banner, so there are no edges to fill.',
      })
    }

    const spend = await spendToolCoins(user, 'banner-sizer')
    if (!spend.ok) {
      return NextResponse.json(
        { error: spend.reason, required: spend.required, available: spend.available },
        { status: spend.status }
      )
    }

    const modelInput = await buildAiModelInput({
      source: image.buffer,
      width: preset.width,
      height: preset.height,
      placed: placement,
    })
    const generated = await generateFill({
      apiKey,
      jpeg: modelInput.jpeg,
      width: modelInput.modelWidth,
      height: modelInput.modelHeight,
    })
    const composited = await compositeSubjectOverFill({
      source: image.buffer,
      fill: generated.buffer,
      width: preset.width,
      height: preset.height,
      placed: placement,
      maxBytes: preset.maxBytes,
    })

    const meta = await sharp(composited.jpeg).metadata()
    return NextResponse.json({
      covered: false,
      mimeType: 'image/jpeg',
      width: meta.width || preset.width,
      height: meta.height || preset.height,
      bytes: composited.jpeg.length,
      withinCap: composited.withinCap,
      model: generated.model,
      imageDataUrl: `data:image/jpeg;base64,${composited.jpeg.toString('base64')}`,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[banner-sizer]', publicError(error))
    return NextResponse.json({ error: publicError(error) }, { status: 500 })
  }
}
