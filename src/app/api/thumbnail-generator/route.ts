import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client } from '@/lib/r2'

// R2 config
const BUCKET = process.env.R2_BUCKET_NAME || 'sdhq-uploads'
const PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`

// Gemini model - Updated for image generation with structural reference support
const MODEL_NAME = 'gemini-3.1-flash-image-preview'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
    const formData = await request.formData()
    const userId = (formData.get('userId') as string) || 'anonymous'
    const userType = (formData.get('userType') as string) || 'free'
    const identifier = userId
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

    let response
    try {
      // Use generationConfig with correct parameters for image generation
      const requestBody: any = {
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          aspectRatio: '16:9',
          temperature: 1.0,
          topP: 0.95,
          candidateCount: 1
        }
      }

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.json()
        throw new Error(`Gemini API error: ${geminiResponse.status} - ${JSON.stringify(errorData)}`)
      }

      response = await geminiResponse.json()
      console.log('[Thumbnail] Gemini API response received')
    } catch (geminiError: any) {
      console.error('[Thumbnail] Gemini API error:', geminiError)
      return NextResponse.json(
        { error: 'Gemini API error', details: geminiError.message },
        { status: 500 }
      )
    }

    // Parse response
    let rawText: string
    try {
      rawText = typeof (response as any).text === 'function'
        ? (response as any).text()
        : (response as any).text ?? ''
    } catch (e) {
      rawText = ''
    }

    console.log('[Thumbnail] Raw text length:', rawText.length)

    // Try to extract base64 image from response
    let generatedImageBase64: string | null = null
    
    // Check if response contains inline data
    const candidates = (response as any).candidates
    console.log('[Thumbnail] Candidates count:', candidates?.length || 0)
    
    if (candidates && candidates.length > 0) {
      const responseParts = candidates[0]?.content?.parts
      console.log('[Thumbnail] Response parts count:', responseParts?.length || 0)
      
      if (responseParts) {
        for (const part of responseParts) {
          console.log('[Thumbnail] Part type:', part.inlineData ? 'inlineData' : 'text')
          if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data
            console.log('[Thumbnail] Found inlineData, length:', generatedImageBase64?.length)
            break
          }
        }
      }
    }

    // Fallback: try to parse markdown image
    if (!generatedImageBase64 && rawText) {
      console.log('[Thumbnail] Trying markdown parse...')
      const markdownMatch = rawText.match(/!\[.*?\]\(data:image\/[^;]+;base64,([^\)]+)\)/)
      if (markdownMatch) {
        generatedImageBase64 = markdownMatch[1]
        console.log('[Thumbnail] Found markdown image, length:', generatedImageBase64.length)
      }
    }

    if (!generatedImageBase64) {
      console.error('[Thumbnail] No image found in response. Raw text preview:', rawText.substring(0, 200))
      return NextResponse.json(
        { error: 'Failed to generate image', details: rawText.substring(0, 500) },
        { status: 500 }
      )
    }

    // Upload generated image to R2 for persistence
    let r2Url: string | null = null
    let r2Key: string | null = null
    try {
      const imgBuffer = Buffer.from(generatedImageBase64, 'base64')
      const ext = 'png'
      const r2Key = `thumbnails/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: r2Key,
          Body: imgBuffer,
          ContentType: 'image/png',
        })
      )
      
      r2Url = `${PUBLIC_URL}/${r2Key}`
      console.log('[Thumbnail] Saved to R2:', r2Url)
    } catch (r2Error) {
      console.error('[Thumbnail] R2 upload failed:', r2Error)
      // Continue without R2 URL - base64 still available
    }

    return NextResponse.json({
      success: true,
      imageBase64: generatedImageBase64,
      url: r2Url,
      key: r2Key,
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
