import { NextResponse } from 'next/server'

// In-memory rate limit storage for clip analyzer
const clipAnalyzerRateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(identifier: string, maxUses: number): { allowed: boolean; remaining: number; resetTime: number | null } {
  const now = Date.now()
  const record = clipAnalyzerRateLimitStore.get(identifier)

  if (!record || now > record.resetTime) {
    const newRecord = { count: 1, resetTime: now + 24 * 60 * 60 * 1000 }
    clipAnalyzerRateLimitStore.set(identifier, newRecord)
    return { allowed: true, remaining: maxUses - 1, resetTime: newRecord.resetTime }
  }

  if (record.count >= maxUses) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  record.count += 1
  clipAnalyzerRateLimitStore.set(identifier, record)
  return { allowed: true, remaining: maxUses - record.count, resetTime: record.resetTime }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, platform, userId, userType } = body

    if (!url || !platform) {
      return NextResponse.json({ error: 'URL and platform are required' }, { status: 400 })
    }

    // Rate limiting
    const identifier = userId || 'anonymous'
    let maxUses = 5 // Default for subscribers

    if (userType === 'owner' || userType === 'admin' || userType === 'lifetime') {
      maxUses = 999999 // Unlimited
    } else if (userType === 'subscribed') {
      maxUses = 5
    } else {
      return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
    }

    const rateLimit = checkRateLimit(`clip-analyzer-${identifier}`, maxUses)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You have used your daily limit.', resetTime: rateLimit.resetTime },
        { status: 429 }
      )
    }

    const apiKey = process.env.RAPID_API_UNLIMITED_GPT
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const apiUrl = 'https://gemini-ai-all-models.p.rapidapi.com/v1/chat/completions'

    // Fetch the page to extract thumbnail image
    let imageUrl = url
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })
      if (pageResponse.ok) {
        const html = await pageResponse.text()
        // Try to extract og:image
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        if (ogImageMatch && ogImageMatch[1]) {
          imageUrl = ogImageMatch[1]
        }
      }
    } catch (e) {
      console.log('Could not fetch page for thumbnail extraction, using original URL')
    }

    const systemPrompt = `You are a social media algorithm expert and video content strategist. Analyze the video content from the provided ${platform} URL and return a comprehensive optimization report.

Examine the actual visual content, including the thumbnail/frame, and apply deep knowledge of ${platform}'s current (2026) algorithm to give specific, actionable insights. Analyze:
- Visual quality and appeal
- Hook strength in the opening frame
- Text overlays and captions visible in the thumbnail
- Overall production value
- Engagement potential based on visual elements

IMPORTANT: Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.

Return this exact structure:
{
  "score": <integer 0-100>,
  "scoreTitle": "<short title for the score level>",
  "scoreSummary": "<2 sentence summary of discoverability strengths and gaps>",
  "insights": [
    { "icon": "<emoji>", "label": "<category name>", "value": "<specific insight>" },
    { "icon": "<emoji>", "label": "<category name>", "value": "<specific insight>" },
    { "icon": "<emoji>", "label": "<category name>", "value": "<specific insight>" },
    { "icon": "<emoji>", "label": "<category name>", "value": "<specific insight>" }
  ],
  "recommendations": [
    { "priority": "high", "category": "<category>", "text": "<actionable recommendation>" },
    { "priority": "high", "category": "<category>", "text": "<actionable recommendation>" },
    { "priority": "med",  "category": "<category>", "text": "<actionable recommendation>" },
    { "priority": "med",  "category": "<category>", "text": "<actionable recommendation>" },
    { "priority": "low",  "category": "<category>", "text": "<actionable recommendation>" }
  ],
  "overlays": [
    { "type": "text",   "description": "<text overlay to add>",           "timing": "<when in video, e.g. '0–2s hook'>"},
    { "type": "sound",  "description": "<audio/music suggestion>",        "timing": "<when>" },
    { "type": "visual", "description": "<visual effect or edit cut>",     "timing": "<when>" },
    { "type": "cta",    "description": "<call-to-action overlay>",        "timing": "<when>" }
  ],
  "title": "<optimized title with strong hook>",
  "description": "<optimized description with keywords and CTAs>",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"]
}`

    const userPrompt = `Analyze this ${platform} video content from the URL: ${url}

Focus on:
1. Visual analysis of the thumbnail/frame - what elements are visible, colors, composition, text overlays
2. ${platform}'s current (2026) algorithm priorities: completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals, and watch time patterns
3. How the visual content aligns with ${platform}'s algorithm best practices
4. Specific recommendations for overlays, text overlays, audio choices, visual edits, and CTAs
5. Optimized title, description, and hashtag suggestions

Provide a realistic score based on the actual visual content and algorithm alignment.`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'gemini-ai-all-models.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gemini-1.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${systemPrompt}\n\n${userPrompt}` },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('API Response:', JSON.stringify(data, null, 2))

    // Try different response structures (Gemini uses OpenAI-compatible format)
    let content = data.choices?.[0]?.message?.content
    if (!content) {
      content = data.result
    }
    if (!content) {
      content = data.content
    }
    if (!content) {
      content = data.message
    }
    if (!content) {
      content = data.text
    }
    if (!content) {
      content = data.data?.content
    }
    if (!content) {
      content = data.data?.message
    }

    if (!content) {
      throw new Error('No content in API response. Response structure: ' + JSON.stringify(data))
    }

    // Parse JSON from response (handle markdown code blocks if present)
    let cleanContent = content
    if (content.includes('```')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const result = JSON.parse(cleanContent)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Clip analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
