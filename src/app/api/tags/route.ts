import { NextResponse } from 'next/server'

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

// Generate tags using Groq API
async function generateTagsWithRapidAPI(description: string, platform: string, count: number): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY || process.env.HUGGINGFACE_TOKEN || process.env.RAPID_API_UNLIMITED_GPT || process.env.RAPIDAPI || process.env.RAPID_API_KEY
  const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
  
  const apiUrl = 'https://api.groq.com/openai/v1/chat/completions'
  
  console.log('API Key present:', !!apiKey)
  console.log('API Key length:', apiKey?.length)
  console.log('API Key prefix:', apiKey?.substring(0, 5))
  console.log('Model:', modelName)
  
  if (!apiKey) {
    throw new Error('Groq API key not configured')
  }
  
  try {
    console.log(`Calling Groq API: ${apiUrl}`)
    
    const platformContext: Record<string, string> = {
      'tiktok': 'TikTok',
      'instagram': 'Instagram',
      'youtube-shorts': 'YouTube Shorts',
      'youtube-long': 'YouTube',
      'facebook-reels': 'Facebook Reels'
    }
    
    const platformName = platformContext[platform.toLowerCase()] || platform
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout for Groq
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: `You are an expert social media algorithm analyst and hashtag generator. You MUST generate DIFFERENT hashtags for each platform based on their unique algorithms and audience behaviors. The same content should have completely different hashtag strategies for TikTok vs Instagram vs YouTube.

CRITICAL: Always analyze the platform first, then generate platform-specific hashtags. Never use the same tags across platforms.

Platform-specific examples:
- TikTok gaming content: ["fyp", "gaming", "viral", "trending", "fps", "gamer"]
- Instagram gaming content: ["gamingcommunity", "gamersofinstagram", "esports", "gaminglife", "videogames", "pcgaming"]
- YouTube Shorts gaming: ["shorts", "gamingclips", "viralshorts", "gamingshorts", "fpsgame", "trending"]
- Facebook Reels gaming: ["gaming", "videogames", "gamingcommunity", "facebookgaming", "gamers", "entertainment"]

Platform-specific strategies:
- TikTok: Focus on discovery (fyp, viral, trending) + niche tags. 3-5 tags, broad reach focus.
- Instagram: Focus on community + niche + aesthetic tags. 10-30 tags, engagement focus.
- YouTube Shorts: Focus on SEO + viral + content type tags. Mix of search and discovery.
- YouTube Long-form: Focus on SEO + topic + search intent tags. Search optimization.
- Facebook Reels: Focus on community + trending + entertainment tags. Social engagement.

Return only valid JSON arrays of lowercase strings without # symbols.`
          },
          {
            role: 'user',
            content: `Platform: ${platformName}
Content: "${description}"
Number of tags: ${count}

Generate ${count} hashtags SPECIFICALLY for ${platformName}. Do NOT use generic tags - make them tailored to ${platformName}'s algorithm and audience.

Think step by step:
1. What is ${platformName}'s algorithm priority? (discovery, engagement, search, community)
2. What types of hashtags perform best on ${platformName}?
3. How should I balance broad vs specific tags for ${platformName}?
4. What are the optimal tag characteristics for ${platformName}?

Return exactly ${count} tags as a JSON array: ["tag1", "tag2", "tag3", ...]`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Groq error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in Groq response')
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
    throw error instanceof Error ? error : new Error(String(error))
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using Groq for tag generation',
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
    
    // Generate tags using RapidAPI
    const tags = await generateTagsWithRapidAPI(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      algorithm: 'groq',
      rateLimit: isAdmin ? { remaining: -1, resetTime: null } : {
        remaining: rateLimitResult!.remaining,
        resetTime: rateLimitResult!.resetTime,
        maxUses: maxUses
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const apiKey = process.env.RAPID_API_UNLIMITED_GPT || process.env.RAPIDAPI || process.env.RAPID_API_KEY
    return NextResponse.json({ 
      error: 'Failed to generate tags', 
      details: errorMessage,
      debug: {
        apiKeyPresent: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey?.substring(0, 5) || 'none',
        apiUrl: process.env.RAPID_API_URL || 'https://openai-chatgpt-gpt-api.p.rapidapi.com/v1/chat/completions',
        apiHost: process.env.RAPID_API_HOST || 'openai-chatgpt-gpt-api.p.rapidapi.com'
      }
    }, { status: 500 })
  }
}
