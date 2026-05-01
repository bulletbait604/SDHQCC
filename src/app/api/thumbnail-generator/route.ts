import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { S3Client } from '@aws-sdk/client-s3'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── R2 client ────────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

// ── Gemini client ─────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API!)

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxUses: number = 10, windowMs: number = 60 * 60 * 1000) {
  const now = Date.now()
  const userLimit = rateLimitStore.get(identifier)
  
  if (!userLimit || now > userLimit.resetTime) {
    const resetTime = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: maxUses - 1, resetTime }
  }
  
  if (userLimit.count >= maxUses) {
    return { allowed: false, remaining: 0, resetTime: userLimit.resetTime }
  }
  
  userLimit.count++
  rateLimitStore.set(identifier, userLimit)
  return { allowed: true, remaining: maxUses - userLimit.count, resetTime: userLimit.resetTime }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, mimeType, prompt, sessionId, userId, userType } = body

    // Rate limiting
    const identifier = userId || 'anonymous'
    const rateLimit = checkRateLimit(identifier)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', remaining: 0, resetTime: rateLimit.resetTime },
        { status: 429 }
      )
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    console.log('[Thumbnail] Calling Gemini API with model: gemini-2.0-flash-preview-image-generation', imageBase64 ? '(editing image)' : '(generating from text)')

    // ── IMPORTANT ─────────────────────────────────────────────────────────────
    // Do NOT put any of these in generationConfig — they are Imagen-only fields
    // and will cause 400 INVALID_ARGUMENT for generateContent:
    //   ✗ aspectRatio
    //   ✗ outputMimeType
    //   ✗ structuralReference
    //   ✗ personGeneration
    //   ✗ safetyFilterLevel
    //
    // The ONLY extra config this model needs is responseModalities so it knows
    // to return an image alongside text.
    // ─────────────────────────────────────────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-preview-image-generation',
      // @ts-ignore – responseModalities is valid but not yet in the TS types
      generationConfig: { responseModalities: ['Text', 'Image'] },
    })

    // Build content parts
    const contentParts: any[] = []
    
    // Add image if provided
    if (imageBase64) {
      contentParts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      })
    }
    
    // Add prompt
    contentParts.push({
      text: imageBase64
        ? `You are an expert thumbnail designer and image editor. Edit the provided image according to the user's request.

Instructions: ${prompt}

Requirements:
- High contrast, eye-catching composition
- Bold visual hierarchy
- Keep the main subject clearly recognizable
- Return the edited image.`
        : `You are an expert thumbnail designer. Create a thumbnail image based on the user's request.

Instructions: ${prompt}

Requirements:
- High contrast, eye-catching composition
- Bold visual hierarchy
- Optimized for 1280×720 landscape format
- Return the generated image.`,
    })

    const result = await model.generateContent(contentParts)
    const parts = result.response.candidates?.[0]?.content?.parts ?? []

    // Find the image part Gemini returned
    const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

    if (!imgPart?.inlineData) {
      console.error(
        '[Thumbnail] Gemini returned no image. Parts:',
        parts.map((p: any) => ({
          type: p.text ? 'text' : p.inlineData ? 'image' : 'unknown',
          mimeType: p.inlineData?.mimeType,
        }))
      )
      return NextResponse.json(
        { error: 'Gemini did not return an image. Try rephrasing your prompt.' },
        { status: 500 }
      )
    }

    // ── Save output to R2 ────────────────────────────────────────────────────
    const imgBuffer = Buffer.from(imgPart.inlineData.data, 'base64')
    const ext = imgPart.inlineData.mimeType.split('/')[1]?.split(';')[0] || 'png'
    const key = `thumbnails/${sessionId || userId || 'anon'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: imgBuffer,
        ContentType: imgPart.inlineData.mimeType,
        Metadata: { prompt: prompt.slice(0, 1024) },
      })
    )

    const outputUrl = `/api/image?key=${key}`
    const textPart = parts.find((p: any) => p.text)

    console.log('[Thumbnail] Success – saved to R2:', key)

    return NextResponse.json({
      url: outputUrl,
      key,
      imageBase64: imgPart.inlineData.data,
      description: textPart?.text || '',
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime,
    })
  } catch (err: any) {
    const message: string = err?.message ?? 'Unknown error'
    console.error('[Thumbnail] Gemini API error:', err)

    if (message.includes('403') || message.includes('API_KEY')) {
      return NextResponse.json(
        { error: 'Invalid or missing GEMINI_API_KEY.' },
        { status: 500 }
      )
    }
    if (message.includes('429')) {
      return NextResponse.json(
        { error: 'Gemini rate limit hit – wait a moment and try again.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: `Gemini error: ${message}` },
      { status: 500 }
    )
  }
}
