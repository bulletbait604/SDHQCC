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

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 })
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

    const supadataApiKey = process.env.SUPADATA_API_KEY
    if (!supadataApiKey) {
      return NextResponse.json({ error: 'Supadata API key not configured' }, { status: 500 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ API key not configured' }, { status: 500 })
    }

    // Step 1: Extract video information using Supadata
    console.log('Starting Supadata extraction for URL:', url)
    const supadataResponse = await fetch('https://api.supadata.ai/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': supadataApiKey
      },
      body: JSON.stringify({
        url: url,
        prompt: 'Extract comprehensive information about this video including: main topics, key points, visual elements, audio content, captions, engagement indicators, and any other relevant metadata. Provide a detailed summary of the content.'
      })
    })

    if (!supadataResponse.ok) {
      const errorText = await supadataResponse.text()
      console.error('Supadata error:', errorText)
      throw new Error(`Supadata API error: ${supadataResponse.status} - ${errorText}`)
    }

    const supadataJob = await supadataResponse.json()
    console.log('Supadata job created:', supadataJob.jobId)

    // Poll for Supadata results
    let supadataResult = null
    let attempts = 0
    const maxAttempts = 30 // 30 attempts with 2 second delay = 60 seconds max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      
      const resultResponse = await fetch(`https://api.supadata.ai/v1/extract/${supadataJob.jobId}`, {
        headers: {
          'x-api-key': supadataApiKey
        }
      })

      if (resultResponse.ok) {
        const resultData = await resultResponse.json()
        if (resultData.status === 'completed') {
          supadataResult = resultData.data
          break
        } else if (resultData.status === 'failed') {
          throw new Error('Supadata extraction failed')
        }
      }
      
      attempts++
    }

    if (!supadataResult) {
      throw new Error('Supadata extraction timed out')
    }

    console.log('Supadata extraction completed')

    // Step 2: Use GROQ to analyze the extracted information and research algorithms
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a social media algorithm expert and video content strategist. Analyze the provided video information and return a comprehensive optimization report for ${platform}.

Research and apply deep knowledge of ${platform}'s current (2026) algorithm to give specific, actionable insights.

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
          },
          {
            role: 'user',
            content: `Analyze this video information for maximum discoverability and engagement optimization on ${platform}.

Video Information from Supadata:
${JSON.stringify(supadataResult, null, 2)}

Focus on:
1. Content analysis - topics, key points, visual elements, audio, captions
2. ${platform}'s current (2026) algorithm priorities: completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals, and watch time patterns
3. How the content aligns with ${platform}'s algorithm best practices
4. Specific recommendations for overlays, text overlays, audio choices, visual edits, and CTAs that work well on ${platform}
5. Optimized title, description, and hashtag suggestions tailored for ${platform}

Provide a realistic score based on the content and ${platform}'s algorithm alignment.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('GROQ error:', errorText)
      throw new Error(`GROQ API error: ${groqResponse.status} - ${errorText}`)
    }

    const groqData = await groqResponse.json()
    console.log('GROQ Response:', JSON.stringify(groqData, null, 2))

    const content = groqData.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No content in GROQ response')
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
