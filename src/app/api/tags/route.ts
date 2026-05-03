import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Force dynamic rendering to prevent static optimization
export const dynamic = 'force-dynamic'

// Use gemini-2.5-flash model (stable release)
const MODEL_NAME = 'gemini-2.5-flash'

// Generate tags using Gemini
async function generateTagsWithGemini(description: string, platform: string, count: number): Promise<string[]> {
  const geminiApiKey = process.env.GEMINI_API
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API not configured')
  }
  
  const platformContext: Record<string, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels'
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
              text: `Act as a Social Media SEO Specialist and Algorithm Researcher.

CONTEXT:
I am creating content for ${platformName}.
DESCRIPTION: "${description}"

TASK:
1. Briefly analyze the current ${platformName} algorithm trends for April 2026 (focusing on "Social Search" and SEO).
2. Identify the core "High-Intent Keywords" from my description that users would actually type into a search bar.
3. Generate ${count} optimized hashtags based on the platform strategy below.

PLATFORM STRATEGY:
${platformName === 'TikTok' ? '- Focus on discovery and relevance. Mix 2-3 broad trending tags (fyp, foryou, viral) with 3-5 niche-specific tags. Total 5-8 tags maximum.' : ''}${platformName === 'Instagram' ? '- Focus on "Relevance" over "Volume." Use 3-5 highly targeted hashtags combining community + aesthetic + niche.' : ''}${platformName === 'YouTube Shorts' || platformName === 'YouTube' ? '- Focus on "Searchable" tags. Use SEO-focused keywords that users actually search for.' : ''}${platformName === 'Facebook Reels' ? '- Focus on community and trending. Use broader appeal tags with some niche-specific ones.' : ''}

CONSTRAINTS:
- Generate exactly ${count} hashtags
- All lowercase, no # symbols
- Mix high-reach and niche tags (don't overstuff trending tags)
- Use underscores_for_multi_word_tags
- Focus on keywords users actually search for

Return ONLY a valid JSON array of strings:
["tag1", "tag2", "tag3", ...]`
            }
          ]
        }
      ]
    })
    
    // Parse the response from Google GenAI SDK
    let rawText: string
    try {
      rawText = typeof (response as any).text === 'function'
        ? (response as any).text()
        : (response as any).text ?? ''
    } catch (textError) {
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

// Parse tag response from any AI provider
function parseTagResponse(content: string, platformName: string, count: number): string[] {
  let tags: string[]
  try {
    tags = JSON.parse(content)
    if (!Array.isArray(tags)) {
      throw new Error('Response is not an array')
    }
  } catch (e) {
    const match = content.match(/\[([^\]]+)\]/)
    if (match) {
      tags = match[1].split(',').map((t: string) => t.trim().replace(/["']/g, ''))
    } else {
      tags = content.split(/[,;\n]/).map((t: string) => t.trim().replace(/[#"']/g, '')).filter((t: string) => t.length > 0)
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

// Main tag generation using Gemini
async function generateTags(description: string, platform: string, count: number): Promise<{ tags: string[], provider: string }> {
  const geminiApiKey = process.env.GEMINI_API
  
  console.log('[Tags] Checking GEMINI_API configuration:', { hasKey: !!geminiApiKey, keyLength: geminiApiKey?.length })
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API environment variable not configured')
  }
  
  try {
    console.log('[Tags] Generating tags with Gemini:', MODEL_NAME)
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
  const response = NextResponse.json({ 
    message: 'Using Gemini 2.5 Flash for tag generation',
    model: 'gemini-2.5-flash',
    usageLimits: 'Coin/token limits only (client enforces purchase or subscription)',
    status: 'active',
  })
  
  // Add cache-busting headers
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  response.headers.set('X-Deploy-Hash', '2e2e9ae')
  
  return response
}

// DELETE — legacy no-op (admin); server no longer tracks per-day tag uses
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body
    
    // Check if user is admin
    const isAdmin = userId && ['bulletbait604', 'Bulletbait604'].includes(userId)
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json({ 
      message: 'No server use-counter store (legacy endpoint)',
    })
  } catch (error) {
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
    
    // Generate tags with cascading fallbacks
    const { tags, provider } = await generateTags(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const response = NextResponse.json({
      tags,
      platform,
      count: tags.length,
      provider: provider,
      rateLimit: { remaining: -1, resetTime: null },
      generatedAt: new Date().toISOString()
    })
    
    // Add cache-busting headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('X-Deploy-Hash', '2e2e9ae')
    
    return response
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error('[Tags API] Final error:', errorMessage)
    return NextResponse.json({ 
      error: 'Failed to generate tags', 
      details: errorMessage
    }, { status: 500 })
  }
}
