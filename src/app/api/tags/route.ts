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

// Generate tags using DeepSeek via RapidAPI
async function generateTagsWithDeepSeek(description: string, platform: string, count: number): Promise<string[]> {
  const rapidApiKey = process.env.RAPID_API_KEY
  
  if (!rapidApiKey) {
    throw new Error('RAPID_API_KEY not configured')
  }
  
  const platformContext: Record<string, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels'
  }
  
  const platformName = platformContext[platform.toLowerCase()] || platform
  
  const response = await fetch('https://deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': rapidApiKey,
      'X-RapidAPI-Host': 'deepseek-r1-zero-ai-model-with-emergent-reasoning-ability.p.rapidapi.com'
    },
    body: JSON.stringify({
      model: 'deepseek-r1-zero',
      messages: [
        {
          role: 'system',
          content: `You are an expert social media algorithm analyst and hashtag generator. Generate DIFFERENT hashtags for each platform based on their unique algorithms.

Platform strategies:
- TikTok: discovery (fyp, viral, trending) + niche tags. 3-5 tags.
- Instagram: community + niche + aesthetic tags. 10-30 tags.
- YouTube Shorts: SEO + viral + content type tags.
- YouTube Long: SEO + topic + search intent tags.
- Facebook Reels: community + trending + entertainment tags.

Return only valid JSON arrays of lowercase strings without # symbols.`
        },
        {
          role: 'user',
          content: `Platform: ${platformName}
Content: "${description}"
Number of tags: ${count}

Generate ${count} hashtags SPECIFICALLY for ${platformName}.

Return exactly ${count} tags as JSON: ["tag1", "tag2", ...]`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  })
  
  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  
  if (!content) {
    throw new Error('No content in DeepSeek response')
  }
  
  return parseTagResponse(content, platformName, count)
}

// Fallback: Groq API
async function generateTagsWithGroq(description: string, platform: string, count: number): Promise<string[]> {
  const groqApiKey = process.env.GROQ_API_KEY
  
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY not configured')
  }
  
  const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
  
  const platformContext: Record<string, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels'
  }
  
  const platformName = platformContext[platform.toLowerCase()] || platform
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are an expert hashtag generator. Return only valid JSON arrays.'
        },
        {
          role: 'user',
          content: `Platform: ${platformName}\nContent: "${description}"\nGenerate ${count} hashtags for ${platformName}. Return JSON: ["tag1", ...]`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  })
  
  clearTimeout(timeout)
  
  if (!response.ok) {
    throw new Error(`Groq error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  
  if (!content) {
    throw new Error('No content in Groq response')
  }
  
  return parseTagResponse(content, platformName, count)
}

// Backup: Pollinations API
async function generateTagsWithPollinations(description: string, platform: string, count: number): Promise<string[]> {
  const pollinationsApiKey = process.env.POLLINATIONS_API_KEY
  
  if (!pollinationsApiKey) {
    throw new Error('POLLINATIONS_API_KEY not configured')
  }
  
  const platformContext: Record<string, string> = {
    'tiktok': 'TikTok',
    'instagram': 'Instagram',
    'youtube-shorts': 'YouTube Shorts',
    'youtube-long': 'YouTube',
    'facebook-reels': 'Facebook Reels'
  }
  
  const platformName = platformContext[platform.toLowerCase()] || platform
  
  const response = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pollinationsApiKey}`
    },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        {
          role: 'system',
          content: 'You are an expert hashtag generator. Return only valid JSON arrays.'
        },
        {
          role: 'user',
          content: `Platform: ${platformName}\nContent: "${description}"\nGenerate ${count} hashtags for ${platformName}. Return JSON: ["tag1", ...]`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  })
  
  if (!response.ok) {
    throw new Error(`Pollinations error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  
  if (!content) {
    throw new Error('No content in Pollinations response')
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

// Main tag generation with cascading fallbacks
async function generateTags(description: string, platform: string, count: number): Promise<{ tags: string[], provider: string }> {
  // Try DeepSeek first
  if (process.env.RAPID_API_KEY) {
    try {
      console.log('[Tags] Trying DeepSeek...')
      const tags = await generateTagsWithDeepSeek(description, platform, count)
      console.log('[Tags] DeepSeek succeeded')
      return { tags, provider: 'deepseek' }
    } catch (error) {
      console.error('[Tags] DeepSeek failed:', error)
    }
  }
  
  // Fallback to Groq
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[Tags] Falling back to Groq...')
      const tags = await generateTagsWithGroq(description, platform, count)
      console.log('[Tags] Groq succeeded')
      return { tags, provider: 'groq' }
    } catch (error) {
      console.error('[Tags] Groq failed:', error)
    }
  }
  
  // Final fallback to Pollinations
  if (process.env.POLLINATIONS_API_KEY) {
    try {
      console.log('[Tags] Falling back to Pollinations...')
      const tags = await generateTagsWithPollinations(description, platform, count)
      console.log('[Tags] Pollinations succeeded')
      return { tags, provider: 'pollinations' }
    } catch (error) {
      console.error('[Tags] Pollinations failed:', error)
    }
  }
  
  throw new Error('All AI providers failed for tag generation')
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
