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
            content: `You are an expert social media algorithm analyst and hashtag generator. You understand how different platform algorithms work and what types of hashtags perform best on each platform. Generate hashtags that are both relevant to the content AND optimized for the specific platform's algorithm to maximize reach and engagement. Return only valid JSON arrays of lowercase strings without # symbols.

Platform-specific guidance:
- TikTok: Use trending sounds, viral challenges, and niche-specific tags. Mix of broad discovery tags and specific content tags. 3-5 tags optimal.
- Instagram: Use a mix of niche, community, and trending tags. Include location tags when relevant. 10-30 tags optimal.
- YouTube Shorts: Use trending topics, viral content themes, and SEO-friendly tags. Mix of broad and specific tags.
- YouTube Long-form: Use SEO-focused tags, topic-specific, and search-friendly keywords.
- Facebook Reels: Use trending topics, community-focused tags, and viral content themes.`
          },
          {
            role: 'user',
            content: `Generate ${count} highly effective hashtags for: "${description}" specifically for ${platformName}.

IMPORTANT: The platform is ${platformName}. Tailor the hashtags specifically for this platform's algorithm and audience behavior.

Requirements:
- Analyze the content and extract key themes, topics, and entities
- Consider ${platformName}'s algorithm preferences and what types of tags perform best on this specific platform
- Include a mix of specific content tags and broader discovery tags appropriate for ${platformName}
- Focus on tags that are currently popular and likely to get impressions on ${platformName}
- Ensure all tags are directly relevant to the described content
- Return exactly ${count} tags as a JSON array of lowercase strings without # symbols
- Example format: ["gaming", "callofduty", "warzone", "fps", "competitive"]

Platform: ${platformName}
Content: "${description}"
Number of tags: ${count}`
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
    rateLimit: '3 uses per 24 hours',
    status: 'active'
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
    
    // Generate tags using RapidAPI
    const tags = await generateTagsWithRapidAPI(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      algorithm: 'rapidapi',
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
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
