import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// In-memory rate limit storage (in production, use Redis or a database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Check rate limit
function checkRateLimit(identifier: string, maxUses: number = 5, windowMs: number = 24 * 60 * 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const userLimit = rateLimitStore.get(identifier)
  
  if (!userLimit || now > userLimit.resetTime) {
    // First use or window expired
    const resetTime = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: maxUses - 1, resetTime }
  }
  
  if (userLimit.count >= maxUses) {
    return { allowed: false, remaining: 0, resetTime: userLimit.resetTime }
  }
  
  // Increment count
  userLimit.count++
  rateLimitStore.set(identifier, userLimit)
  return { allowed: true, remaining: maxUses - userLimit.count, resetTime: userLimit.resetTime }
}

// Generate tags using Gemini 1.5 Flash
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
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    
    console.log('[Tags] Calling Gemini API with model: gemini-2.5-flash')
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    
    const content = response.text || ''
    
    console.log('[Tags] Gemini response received:', { contentLength: content.length, preview: content.substring(0, 100) })
    
    if (!content) {
      throw new Error('No content in Gemini response')
    }
    
    return parseTagResponse(content, platformName, count)
  } catch (error: any) {
    console.error('[Tags] Gemini API error:', error)
    if (error.message?.includes('quota')) {
      throw new Error('Gemini API quota exceeded')
    } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      throw new Error('Gemini API key invalid or unauthorized')
    } else if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error('Gemini model not found - check API version')
    }
    throw error
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

// Main tag generation using Gemini 1.5 Flash only
async function generateTags(description: string, platform: string, count: number): Promise<{ tags: string[], provider: string }> {
  const geminiApiKey = process.env.GEMINI_API
  
  console.log('[Tags] Checking GEMINI_API configuration:', { hasKey: !!geminiApiKey, keyLength: geminiApiKey?.length })
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API environment variable not configured')
  }
  
  try {
    console.log('[Tags] Generating tags with Gemini 2.5 Flash...')
    console.log('[Tags] Request:', { platform, count, descriptionLength: description.length })
    const tags = await generateTagsWithGemini(description, platform, count)
    console.log('[Tags] Gemini succeeded, generated', tags.length, 'tags')
    return { tags, provider: 'gemini-2.5-flash' }
  } catch (error: any) {
    console.error('[Tags] Gemini failed:', error)
    console.error('[Tags] Error details:', error.message || error)
    throw new Error(`Tag generation failed: ${error.message || 'Unknown Gemini error'}`)
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using Gemini 2.5 Flash for tag generation',
    rateLimit: '5 uses per 24 hours (20 for verified users)',
    status: 'active',
    totalUsers: rateLimitStore.size
  })
}

// DELETE endpoint - reset rate limit (admin only)
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body
    
    // Check if user is admin
    const isAdmin = userId && ['bulletbait604', 'Bulletbait604'].includes(userId)
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Clear all rate limits
    rateLimitStore.clear()
    
    return NextResponse.json({ 
      message: 'Rate limit store cleared successfully',
      clearedUsers: 0
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset rate limit' }, { status: 500 })
  }
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10, userId, isVerified } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    // Use userId or IP for rate limiting
    const identifier = userId || request.headers.get('x-forwarded-for') || 'anonymous'
    
    // Admin users bypass rate limit
    const isAdmin = userId && ['bulletbait604', 'Bulletbait604'].includes(userId)
    
    // Verified users get 20 uses/day, regular users get 5
    const maxUses = isVerified ? 20 : 5
    
    let rateLimitResult = null
    if (!isAdmin) {
      // Check rate limit
      rateLimitResult = checkRateLimit(identifier, maxUses, 24 * 60 * 60 * 1000)
      
      if (!rateLimitResult.allowed) {
        const resetDate = new Date(rateLimitResult.resetTime)
        return NextResponse.json({ 
          error: 'Rate limit exceeded',
          message: isVerified 
            ? 'You have used your 20 tag generations for the day. Please try again later.'
            : 'You have used your 5 free tag generations for the day. Please try again later.',
          resetTime: rateLimitResult.resetTime,
          resetDate: resetDate.toISOString()
        }, { status: 429 })
      }
    }
    
    // Generate tags with cascading fallbacks
    const { tags, provider } = await generateTags(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      provider: provider,
      rateLimit: isAdmin ? { remaining: -1, resetTime: null } : {
        remaining: rateLimitResult!.remaining,
        resetTime: rateLimitResult!.resetTime,
        maxUses: maxUses
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error('[Tags API] Final error:', errorMessage)
    return NextResponse.json({ 
      error: 'Failed to generate tags', 
      details: errorMessage
    }, { status: 500 })
  }
}
