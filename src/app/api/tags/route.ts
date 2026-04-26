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

// Generate tags using Hugging Face Inference API
async function generateTagsWithRapidAPI(description: string, platform: string, count: number): Promise<string[]> {
  const apiKey = process.env.HUGGINGFACE_TOKEN || process.env.RAPID_API_UNLIMITED_GPT || process.env.RAPIDAPI || process.env.RAPID_API_KEY
  const modelName = process.env.HUGGINGFACE_MODEL || 'deepseek-ai/DeepSeek-R1'
  
  const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`
  
  console.log('API Key present:', !!apiKey)
  console.log('API Key length:', apiKey?.length)
  console.log('API Key prefix:', apiKey?.substring(0, 5))
  console.log('Model:', modelName)
  
  if (!apiKey) {
    throw new Error('Hugging Face token not configured')
  }
  
  try {
    console.log(`Calling Hugging Face API: ${apiUrl}`)
    
    const platformContext: Record<string, string> = {
      'tiktok': 'TikTok',
      'instagram': 'Instagram',
      'youtube-shorts': 'YouTube Shorts',
      'youtube-long': 'YouTube',
      'facebook-reels': 'Facebook Reels'
    }
    
    const platformName = platformContext[platform.toLowerCase()] || platform
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout for Hugging Face
    
    const prompt = `Generate ${count} highly effective hashtags for: "${description}" for ${platformName}.

Requirements:
- Analyze the content and extract key themes, topics, and entities
- Consider ${platformName}'s algorithm preferences (what types of tags perform well)
- Include a mix of specific content tags and broader discovery tags
- Focus on tags that are currently popular and likely to get impressions
- Ensure all tags are directly relevant to the described content
- Return exactly ${count} tags as a JSON array of lowercase strings without # symbols
- Example format: ["gaming", "callofduty", "warzone", "fps", "competitive"]`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false
        }
      })
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hugging Face error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    const content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || data.output || data.text || JSON.stringify(data)
    
    if (!content) {
      throw new Error('No content in Hugging Face response')
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
    message: 'Using Hugging Face for tag generation',
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
