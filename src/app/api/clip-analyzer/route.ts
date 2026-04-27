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
    const formData = await request.formData()
    const file = formData.get('file') as File
    const platform = formData.get('platform') as string
    const userId = formData.get('userId') as string
    const userType = formData.get('userType') as string

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
    }

    // Check file size (limit to 75MB)
    const maxSize = 75 * 1024 * 1024 // 75MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit. Please upload a smaller video.` }, { status: 400 })
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

    // Convert file to base64
    console.log('Converting file to base64, file size:', file.size, 'bytes')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`
    console.log('Base64 data URL length:', dataUrl.length, 'characters')

    const systemPrompt = `You are a social media algorithm expert and video content strategist. Analyze the provided video clip for ${platform} and return a comprehensive optimization report.

Examine the actual visual content from the video and apply deep knowledge of ${platform}'s current (2026) algorithm to give specific, actionable insights. Analyze:
- Visual quality and appeal
- Hook strength in the opening frames
- Text overlays and captions visible
- Overall production value
- Engagement potential based on visual elements
- Pacing and editing quality
- How the content aligns with ${platform}'s specific algorithm priorities

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

    const userPrompt = `Analyze this video clip for maximum discoverability and engagement optimization on ${platform}.

Focus on:
1. Visual analysis of the video content - what elements are visible, colors, composition, text overlays, pacing
2. ${platform}'s current (2026) algorithm priorities: completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals, and watch time patterns
3. How the visual content aligns with ${platform}'s algorithm best practices
4. Specific recommendations for overlays, text overlays, audio choices, visual edits, and CTAs that work well on ${platform}
5. Optimized title, description, and hashtag suggestions tailored for ${platform}

Provide a realistic score based on the actual video content and ${platform}'s algorithm alignment.`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 120 second timeout for video processing

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
              { type: 'image_url', image_url: { url: dataUrl } }
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
      console.error('API Error Response:', errorText)
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
