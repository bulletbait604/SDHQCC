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

// Generate tags using OpenAI
async function generateTagsWithOpenAI(description: string, platform: string, count: number): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }
  
  try {
    const platformContext: Record<string, string> = {
      'tiktok': 'TikTok - short-form video platform popular for trends, challenges, and viral content',
      'instagram': 'Instagram - visual platform for photos, reels, and stories',
      'youtube-shorts': 'YouTube Shorts - short-form vertical videos on YouTube',
      'youtube-long': 'YouTube - long-form video platform',
      'facebook-reels': 'Facebook Reels - short-form video content on Facebook'
    }
    
    const prompt = `Generate ${count} relevant hashtags for a content description. The content is for ${platformContext[platform.toLowerCase()] || platform}.

Description: "${description}"

Requirements:
- Return ONLY a JSON array of hashtag strings (without the # symbol)
- Make tags specific to the content described
- Include platform-relevant tags
- Ensure tags are lowercase and use only letters, numbers, and underscores
- No generic tags like "fyp", "viral", "trending" unless specifically relevant
- Focus on the actual content, game, topic, or activity mentioned

Example output format: ["gaming", "callofduty", "warzone", "fps", "competitive"]

Return ONLY the JSON array, nothing else.`
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a hashtag generator for social media content. You respond only with valid JSON arrays of hashtag strings.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in OpenAI response')
    }
    
    // Parse the JSON response
    let tags: string[]
    try {
      tags = JSON.parse(content)
    } catch (e) {
      const match = content.match(/\[([^\]]+)\]/)
      if (match) {
        tags = match[1].split(',').map((t: string) => t.trim().replace(/"/g, '').replace(/'/g, ''))
      } else {
        tags = content.split(/[,;\n]/).map((t: string) => t.trim().replace(/[#"']/g, '')).filter((t: string) => t.length > 0)
      }
    }
    
    // Clean and format tags
    const cleanedTags = tags
      .map(tag => tag.toLowerCase().replace(/[^a-z0-9_]/g, ''))
      .filter(tag => tag.length > 2)
      .slice(0, count)
    
    // Add hashtag prefix
    const hashtagTags = cleanedTags.map(tag => `#${tag}`)
    
    return hashtagTags
  } catch (error) {
    throw error
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using OpenAI for tag generation',
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
    
    // Generate tags using OpenAI
    const tags = await generateTagsWithOpenAI(description, platform, count)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      algorithm: 'openai',
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
