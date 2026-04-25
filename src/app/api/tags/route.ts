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

// Generate tags using Google Cloud Natural Language API
async function generateTagsWithGoogle(description: string, platform: string, count: number): Promise<string[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  
  console.log('[GOOGLE API] API Key present:', !!apiKey)
  console.log('[GOOGLE API] Description length:', description.length)
  console.log('[GOOGLE API] Platform:', platform)
  console.log('[GOOGLE API] Count:', count)
  
  if (!apiKey) {
    throw new Error('Google API key not configured')
  }
  
  try {
    const requestBody = {
      document: { 
        content: description, 
        type: 'PLAIN_TEXT' 
      },
      encodingType: 'UTF8',
    }
    
    console.log('[GOOGLE API] Request body:', JSON.stringify(requestBody).substring(0, 200))
    
    const entityResponse = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    )
    
    console.log('[GOOGLE API] Response status:', entityResponse.status)
    
    if (!entityResponse.ok) {
      const errorText = await entityResponse.text()
      console.error('[GOOGLE API] Error response:', errorText)
      throw new Error(`Google API error: ${entityResponse.status} - ${errorText}`)
    }
    
    const entityData = await entityResponse.json()
    console.log('[GOOGLE API] Response data keys:', Object.keys(entityData))
    const entities = entityData.entities || []
    console.log('[GOOGLE API] Number of entities:', entities.length)
    
    const tags: string[] = []
    const seen = new Set<string>()
    
    // Extract entities and convert to tags
    for (const entity of entities) {
      if (entity.name && entity.name.length > 2) {
        const tag = entity.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (!seen.has(tag) && tag.length > 2) {
          tags.push(tag)
          seen.add(tag)
        }
      }
      
      // Extract from Wikipedia URLs
      if (entity.metadata && entity.metadata.wikipedia_url) {
        const wikiMatch = entity.metadata.wikipedia_url.match(/\/wiki\/([^\/]+)$/)
        if (wikiMatch) {
          const tag = wikiMatch[1].toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9\s]/g, '').trim()
          if (!seen.has(tag) && tag.length > 2) {
            tags.push(tag)
            seen.add(tag)
          }
        }
      }
      
      // Extract from mentions
      if (entity.mentions && entity.mentions.length > 0) {
        for (const mention of entity.mentions) {
          if (mention.text && mention.text.content) {
            const tag = mention.text.content.toLowerCase().replace(/[^a-z0-9]/g, '')
            if (!seen.has(tag) && tag.length > 2) {
              tags.push(tag)
              seen.add(tag)
            }
          }
        }
      }
    }
    
    console.log('[GOOGLE API] Extracted tags before platform:', tags)
    
    // Add platform-specific tags
    const platformTags: Record<string, string[]> = {
      'tiktok': ['fyp', 'foryou', 'tiktok', 'viral', 'trending'],
      'instagram': ['instagram', 'reels', 'explore', 'viral', 'trending'],
      'youtube-shorts': ['shorts', 'youtube', 'viral', 'trending', 'subscribe'],
      'youtube-long': ['youtube', 'viral', 'trending', 'subscribe', 'watch'],
      'facebook-reels': ['facebook', 'reels', 'viral', 'trending', 'social']
    }
    
    const platformSpecific = platformTags[platform.toLowerCase()] || []
    for (const tag of platformSpecific) {
      if (!seen.has(tag)) {
        tags.push(tag)
        seen.add(tag)
      }
    }
    
    console.log('[GOOGLE API] Tags after platform addition:', tags)
    
    // Add hashtags format
    const hashtagTags = tags.slice(0, count).map(tag => `#${tag}`)
    
    console.log('[GOOGLE API] Final hashtag tags:', hashtagTags)
    
    return hashtagTags.slice(0, count)
  } catch (error) {
    console.error('[GOOGLE API] Error generating tags with Google API:', error)
    throw error
  }
}

// GET endpoint - retrieve tag database status
export async function GET() {
  return NextResponse.json({ 
    message: 'Using Google Cloud Natural Language API for tag generation',
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
    
    console.log('[TAGS API] Generating tags with Google API for:', { platform, description, count })
    
    // Generate tags using Google API
    const tags = await generateTagsWithGoogle(description, platform, count)
    
    console.log('[TAGS API] Generated tags:', tags)
    
    // Add artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return NextResponse.json({
      tags,
      platform,
      count: tags.length,
      algorithm: 'google-nlp',
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating tags:', error)
    return NextResponse.json({ error: 'Failed to generate tags' }, { status: 500 })
  }
}
