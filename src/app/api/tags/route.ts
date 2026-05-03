import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { buildTagGeneratorPrompt } from '@/lib/tagGeneratorPrompt'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'

const FAL_OPENROUTER_URL = 'https://fal.run/openrouter/router'

function tagGeneratorBackend(): 'gemini' | 'fal' {
  const b = (process.env.TAG_GENERATOR_BACKEND || 'gemini').trim().toLowerCase()
  if (b === 'fal' || b === 'fal-openrouter') return 'fal'
  return 'gemini'
}

function falApiKey(): string | undefined {
  const k =
    process.env.SCHNELL_API_KEY?.trim() ||
    process.env.FAL_KEY?.trim() ||
    process.env.FAL_API_KEY?.trim()
  return k || undefined
}

// Generate tags using Gemini (direct Google API)
async function generateTagsWithGemini(description: string, platform: string, count: number): Promise<string[]> {
  const geminiApiKey = process.env.GEMINI_API

  if (!geminiApiKey) {
    throw new Error('GEMINI_API not configured')
  }

  const platformContext: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels',
  }

  const platformName = platformContext[platform.toLowerCase()] || platform

  try {
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey })

    console.log('[Tags] Calling Gemini API with model:', MODEL_NAME)

    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildTagGeneratorPrompt(description, platform, count),
            },
          ],
        },
      ],
    })

    let rawText: string
    try {
      rawText =
        typeof (response as any).text === 'function'
          ? (response as any).text()
          : (response as any).text ?? ''
    } catch {
      throw new Error('Gemini returned a response with no readable text — may have been blocked by safety filters')
    }

    console.log('[Tags] Gemini response received:', { contentLength: rawText.length, preview: rawText.substring(0, 100) })

    if (!rawText) {
      throw new Error('No content in Gemini response')
    }

    return parseTagResponse(rawText, platformName, count)
  } catch (error: any) {
    console.error('[Tags] Gemini API error:', error)
    const errorMessage = error.message || 'Unknown error'
    if (errorMessage.includes('quota')) {
      throw new Error('Gemini API quota exceeded')
    } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      throw new Error('Gemini API key invalid or unauthorized')
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new Error(`Gemini model not found: ${MODEL_NAME}`)
    }
    throw new Error(`Gemini API error: ${errorMessage}`)
  }
}

/** Fal OpenRouter (LLM) — uses same Fal account as FLUX; FLUX Schnell is image-only and not used here. */
async function generateTagsWithFalOpenRouter(
  description: string,
  platform: string,
  count: number
): Promise<{ tags: string[]; modelLabel: string }> {
  const key = falApiKey()
  if (!key) {
    throw new Error('SCHNELL_API_KEY or FAL_KEY not configured (required when TAG_GENERATOR_BACKEND=fal)')
  }

  const model = (process.env.FAL_TAG_LLM_MODEL || 'google/gemini-2.5-flash').trim()
  const prompt = buildTagGeneratorPrompt(description, platform, count)

  const platformContext: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels',
  }
  const platformName = platformContext[platform.toLowerCase()] || platform

  console.log('[Tags] Calling Fal OpenRouter:', { model, promptLength: prompt.length })

  const res = await fetch(FAL_OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model,
      temperature: 0.35,
      max_tokens: 2048,
    }),
  })

  const rawBody = await res.text()
  if (!res.ok) {
    console.error('[Tags] Fal OpenRouter error:', res.status, rawBody.slice(0, 500))
    throw new Error(`Fal OpenRouter HTTP ${res.status}: ${rawBody.slice(0, 280)}`)
  }

  let parsed: { output?: string; error?: string; data?: { output?: string } }
  try {
    parsed = JSON.parse(rawBody) as { output?: string; error?: string; data?: { output?: string } }
  } catch {
    throw new Error('Fal OpenRouter returned non-JSON response')
  }

  if (parsed.error) {
    throw new Error(`Fal OpenRouter: ${parsed.error}`)
  }

  const rawText = parsed.data?.output ?? parsed.output ?? ''
  if (!rawText) {
    throw new Error('Fal OpenRouter returned empty output')
  }

  const tags = parseTagResponse(rawText, platformName, count)
  return { tags, modelLabel: model }
}

// Parse tag response from any AI provider
function parseTagResponse(content: string, platformName: string, count: number): string[] {
  let tags: string[]
  try {
    tags = JSON.parse(content)
    if (!Array.isArray(tags)) {
      throw new Error('Response is not an array')
    }
  } catch {
    const match = content.match(/\[([^\]]+)\]/)
    if (match) {
      tags = match[1].split(',').map((t: string) => t.trim().replace(/["']/g, ''))
    } else {
      tags = content
        .split(/[,;\n]/)
        .map((t: string) => t.trim().replace(/[#"']/g, ''))
        .filter((t: string) => t.length > 0)
    }
  }

  const cleanedTags = tags
    .map((tag: string) => tag.toLowerCase().replace(/[^a-z0-9_]/g, ''))
    .filter((tag: string) => tag.length > 2)
    .slice(0, count)

  if (cleanedTags.length === 0) {
    return [platformName.toLowerCase().replace(/\s/g, ''), 'content', 'viral', 'trending']
  }

  return cleanedTags
}

async function generateTags(
  description: string,
  platform: string,
  count: number
): Promise<{ tags: string[]; provider: string }> {
  const backend = tagGeneratorBackend()

  if (backend === 'fal') {
    const geminiApiKey = process.env.GEMINI_API
    console.log('[Tags] Backend: fal (OpenRouter on Fal)', {
      hasGeminiKey: !!geminiApiKey,
      hasFalKey: !!falApiKey(),
      falModel: process.env.FAL_TAG_LLM_MODEL || 'google/gemini-2.5-flash',
    })
    const { tags, modelLabel } = await generateTagsWithFalOpenRouter(description, platform, count)
    return { tags, provider: `fal-openrouter:${modelLabel}` }
  }

  const geminiApiKey = process.env.GEMINI_API
  console.log('[Tags] Checking GEMINI_API configuration:', { hasKey: !!geminiApiKey, keyLength: geminiApiKey?.length })

  if (!geminiApiKey) {
    throw new Error('GEMINI_API environment variable not configured')
  }

  try {
    console.log('[Tags] Backend: gemini', MODEL_NAME)
    console.log('[Tags] Request:', { platform, count, descriptionLength: description.length })
    const tags = await generateTagsWithGemini(description, platform, count)
    console.log('[Tags] Gemini succeeded, generated', tags.length, 'tags')
    return { tags, provider: MODEL_NAME }
  } catch (error: any) {
    console.error('[Tags] Gemini failed:', error)
    console.error('[Tags] Error details:', error.message || error)
    throw new Error(`Tag generation failed: ${error.message || 'Unknown Gemini error'}`)
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  const backend = tagGeneratorBackend()
  const falModel = (process.env.FAL_TAG_LLM_MODEL || 'google/gemini-2.5-flash').trim()

  const message =
    backend === 'fal'
      ? `Tag generation via Fal OpenRouter (model: ${falModel}). FLUX Schnell is image-only — not used for tags.`
      : `Using Gemini ${MODEL_NAME} for tag generation (direct Google API).`

  const response = NextResponse.json({
    message,
    backend,
    model: backend === 'fal' ? `fal-openrouter:${falModel}` : MODEL_NAME,
    usageLimits: 'Coin/token limits only (client enforces purchase or subscription)',
    status: 'active',
  })

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

  return response
}

// DELETE — legacy no-op (admin); server no longer tracks per-day tag uses
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    const isAdmin = userId && ['bulletbait604', 'Bulletbait604'].includes(userId)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      message: 'No server use-counter store (legacy endpoint)',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reset rate limit' }, { status: 500 })
  }
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10 } = body

    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }

    const { tags, provider } = await generateTags(description, platform, count)

    const response = NextResponse.json({
      tags,
      platform,
      count: tags.length,
      provider,
      rateLimit: { remaining: -1, resetTime: null },
      generatedAt: new Date().toISOString(),
    })

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return response
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error('[Tags API] Final error:', errorMessage)
    return NextResponse.json(
      {
        error: 'Failed to generate tags',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
