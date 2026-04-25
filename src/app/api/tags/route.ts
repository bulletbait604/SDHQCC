import { NextResponse } from 'next/server'

// In-memory rate limit storage (in production, use Redis or a database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Check rate limit
function checkRateLimit(identifier: string, maxUses: number = 3, windowMs: number = 24 * 60 * 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
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

// Generate tags using Gemini
async function generateTagsWithGemini(description: string, platform: string, count: number): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured')
  }
  
  try {
    const platformContext: Record<string, string> = {
      'tiktok': 'TikTok',
      'instagram': 'Instagram',
      'youtube-shorts': 'YouTube Shorts',
      'youtube-long': 'YouTube',
      'facebook-reels': 'Facebook Reels'
    }
    
    const platformName = platformContext[platform.toLowerCase()] || platform
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate ${count} relevant hashtags for: "${description}" for ${platformName}. Return only a JSON array of lowercase hashtag strings without the # symbol, like ["tag1", "tag2", "tag3"]. Do not include any other text.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!content) {
      throw new Error('No content in Gemini response')
    }
    
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
  } catch (error) {
    throw error
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using Gemini for tag generation',
    rateLimit: '3 uses per 24 hours'
  })
}

// POST endpoint - generate tags from description
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, platform, count = 10, userId } = body
    
    if (!description || !platform) {
      return NextResponse.json({ error: 'Description and platform are required' }, { status: 400 })
    }
    
    // Use userId or IP for rate limiting
    const identifier = userId || request.headers.get('x-forwarded-for') || 'anonymous'
    
    // Check rate limit (3 uses per 24 hours)
    const rateLimit = checkRateLimit(identifier, 3, 24 * 60 * 60 * 1000)
    
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetTime)
      return NextResponse.json({ 
        error: 'Rate limit exceeded',
        message: 'You have used your 3 free tag generations for the day. Please try again later.',
        resetTime: rateLimit.resetTime,
        resetDate: resetDate.toISOString()
      }, { status: 429 })
    }
    
    // Generate tags using Gemini
    const tags = await generateTagsWithGemini(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      algorithm: 'gemini',
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate tags', details: errorMessage }, { status: 500 })
  }
}
