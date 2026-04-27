import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { extractedData, originalPlatform, newPlatform, userId, userType } = body

    if (!extractedData) {
      return NextResponse.json({ error: 'Extracted data is required' }, { status: 400 })
    }

    if (!originalPlatform) {
      return NextResponse.json({ error: 'Original platform is required' }, { status: 400 })
    }

    if (!newPlatform) {
      return NextResponse.json({ error: 'New platform is required' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ error: 'GROQ API key not configured' }, { status: 500 })
    }

    console.log('Re-analyzing for new platform:', newPlatform, 'from:', originalPlatform)

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
            content: `You are a social media algorithm expert and video content strategist. Analyze the provided video information and return a comprehensive optimization report for ${newPlatform}.

The video was originally from ${originalPlatform}. Your task is to re-optimize it for ${newPlatform} by considering the differences in algorithm priorities, audience behavior, and content expectations between the two platforms.

Research and apply deep knowledge of ${newPlatform}'s current (2026) algorithm to give specific, actionable insights. Compare and contrast with ${originalPlatform}'s algorithm to highlight what needs to change.

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
            content: `Re-analyze this video information for optimization on ${newPlatform}. The video was originally created for ${originalPlatform}.

Extracted Video Information (includes both visual and audio analysis):
${JSON.stringify(extractedData, null, 2)}

Focus on:
1. Content analysis - topics, key points, visual elements (people, objects, scenes, colors, text overlays), audio content (speech/transcript, music, sound effects), captions, pacing, editing style, hook strength, production quality
2. ${newPlatform}'s current (2026) algorithm priorities: completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals, and watch time patterns
3. How both the visual and audio content aligns with ${newPlatform}'s algorithm best practices compared to ${originalPlatform}
4. Specific recommendations for overlays, text overlays, audio choices, visual edits, and CTAs that work well on ${newPlatform} but may differ from ${originalPlatform}
5. Optimized title, description, and hashtag suggestions tailored for ${newPlatform}

Provide a realistic score based on the comprehensive content analysis (visual + audio) and ${newPlatform}'s algorithm alignment.`
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
    const content = groqData.choices[0]?.message?.content || ''

    // Parse JSON from response
    let cleanContent = content
    if (content.includes('```')) {
      cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const result = JSON.parse(cleanContent)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Re-analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
