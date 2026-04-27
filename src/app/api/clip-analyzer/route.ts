import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, platform } = body

    if (!url || !platform) {
      return NextResponse.json({ error: 'URL and platform are required' }, { status: 400 })
    }

    const apiKey = process.env.RAPID_API_UNLIMITED_GPT
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const apiUrl = 'https://chatgpt-vision1.p.rapidapi.com/v1/chat/completions'

    const systemPrompt = `You are a social media algorithm expert and video content strategist. Given a clip URL and platform, analyze the content as it would appear on that platform and return a comprehensive optimization report.

You cannot fetch the actual video, but analyze the URL structure, likely content type, and apply deep knowledge of ${platform}'s current (2024–2025) algorithm to give specific, actionable insights.

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

    const userPrompt = `Analyze this ${platform} clip URL for maximum discoverability and engagement optimization: ${url}

Cross-reference with ${platform}'s current algorithm priorities (completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals). Give platform-specific, highly actionable insights tailored to ${platform}.`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'chatgpt-vision1.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
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
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in API response')
    }

    // Parse JSON from response (handle markdown code blocks if present)
    let cleanContent = content
    if (content.includes('```')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    let result
    try {
      result = JSON.parse(cleanContent)
    } catch (e) {
      // Fallback: extract first JSON object from response
      const match = cleanContent.match(/\{[\s\S]*\}/)
      if (match) {
        result = JSON.parse(match[0])
      } else {
        throw new Error('Could not parse API response as JSON')
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Clip analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
