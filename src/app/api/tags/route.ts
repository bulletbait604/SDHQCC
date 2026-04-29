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
  
  const ai = new GoogleGenAI({ apiKey: geminiApiKey })
  
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash-latest',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are an expert social media algorithm analyst and hashtag generator. Generate ${count} platform-optimized hashtags.

Platform: ${platformName}
Content Description: "${description}"

Platform Strategies:
- TikTok: discovery hashtags (fyp, foryou, viral, trending) + niche-specific tags. Mix broad and specific.
- Instagram: community + aesthetic + niche tags. Include location/style tags if relevant.
- YouTube Shorts: SEO-focused + viral + content type tags. Search-optimized.
- YouTube Long: SEO + topic + search intent tags. Educational/entertainment focus.
- Facebook Reels: community + trending + entertainment tags. Broader appeal.

Requirements:
- Generate exactly ${count} hashtags
- All lowercase, no # symbols
- Mix of: platform-trending + content-specific + niche tags
- No spaces in tags (use underscores if needed)
- Relevant to both the content AND platform algorithm

Return ONLY a valid JSON array of strings:
["tag1", "tag2", "tag3", ...]`
          }
        ]
      }
    ]
  })
  
  const content = response.text || ''
  
  if (!content) {
    throw new Error('No content in Gemini response')
  }
  
  return parseTagResponse(content, platformName, count)
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
  
  if (!geminiApiKey) {
    throw new Error('GEMINI_API not configured')
  }
  
  try {
    console.log('[Tags] Generating tags with Gemini 1.5 Flash...')
    const tags = await generateTagsWithGemini(description, platform, count)
    console.log('[Tags] Gemini succeeded')
    return { tags, provider: 'gemini-1.5-flash' }
  } catch (error) {
    console.error('[Tags] Gemini failed:', error)
    throw new Error('Tag generation failed. Please check GEMINI_API configuration.')
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using Gemini 1.5 Flash for tag generation',
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Failed to generate tags', 
      details: errorMessage
    }, { status: 500 })
  }
}
