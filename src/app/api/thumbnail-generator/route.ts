import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'

// In-memory rate limit storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxUses: number = 10, windowMs: number = 60 * 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
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
    // Check authentication via API key or session
    const apiKey = request.headers.get('x-api-key')
    const sessionCookie = request.cookies.get('session')?.value
    
    if (!apiKey && !sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const identifier = apiKey || sessionCookie || 'anonymous'
    const rateLimit = checkRateLimit(identifier)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          remaining: 0,
          resetTime: rateLimit.resetTime
        },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const prompt = formData.get('prompt') as string
    const previousImageBase64 = formData.get('previousImage') as string | null
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Image is now optional - can generate from text or edit an image

    const geminiApiKey = process.env.GEMINI_API
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API not configured' },
        { status: 500 }
      )
    }

    // Convert image to base64 if provided
    let imageBase64: string | null = null
    let mimeType: string = 'image/png'

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer()
      imageBase64 = Buffer.from(bytes).toString('base64')
      mimeType = imageFile.type
    } else if (previousImageBase64) {
      imageBase64 = previousImageBase64
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey })

    console.log('[Thumbnail] Calling Gemini API with model:', MODEL_NAME, imageBase64 ? '(editing image)' : '(generating from text)')

    // Build contents based on whether image is provided
    const parts: any[] = [
      {
        text: imageBase64 
          ? `You are an expert thumbnail designer and image editor. Edit the provided image according to the user's request.

USER REQUEST: "${prompt}"

INSTRUCTIONS:
1. Modify the image based on the user's request
2. Maintain high quality and professional appearance
3. Ensure the thumbnail is eye-catching and engaging
4. Keep the main subject clear and prominent
5. Use appropriate colors, contrast, and composition

Return the edited image.`
          : `You are an expert thumbnail designer. Create a thumbnail image based on the user's request.

USER REQUEST: "${prompt}"

INSTRUCTIONS:
1. Create a professional, eye-catching thumbnail
2. Ensure the image is relevant to the user's description
3. Use appropriate colors, contrast, and composition
4. Make it suitable for use as a video thumbnail
5. Return the generated image.`
      }
    ]

    // Add image to parts if provided
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      })
    }

    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ]
    })

    // Parse response
    let rawText: string
    try {
      rawText = typeof (response as any).text === 'function'
        ? (response as any).text()
        : (response as any).text ?? ''
    } catch (e) {
      rawText = ''
    }

    // Try to extract base64 image from response
    let generatedImageBase64: string | null = null
    
    // Check if response contains inline data
    const candidates = (response as any).candidates
    if (candidates && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data
            break
          }
        }
      }
    }

    // Fallback: try to parse markdown image
    if (!generatedImageBase64 && rawText) {
      const markdownMatch = rawText.match(/!\[.*?\]\(data:image\/[^;]+;base64,([^\)]+)\)/)
      if (markdownMatch) {
        generatedImageBase64 = markdownMatch[1]
      }
    }

    if (!generatedImageBase64) {
      return NextResponse.json(
        { error: 'Failed to generate image', details: rawText.substring(0, 500) },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imageBase64: generatedImageBase64,
      mimeType: 'image/png',
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime
    })

  } catch (error: any) {
    console.error('[Thumbnail] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
