import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

const MODEL_NAME = 'gemini-2.5-flash'

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

    const geminiApiKey = process.env.GEMINI_API
    if (!geminiApiKey) {
      return NextResponse.json({
        error: 'API not configured',
        userMessage: 'Gemini is having a tough time right now. Please check back later.',
        details: 'GEMINI_API key not configured',
      }, { status: 503 })
    }

    console.log('Re-analyzing for new platform:', newPlatform, 'from:', originalPlatform)

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout after 52 seconds')), 52000)
    })

    const prompt = `You are a social media algorithm expert and video content strategist. Analyze the provided video information and return a comprehensive optimization report for ${newPlatform}.

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
}

Re-analyze this video information for optimization on ${newPlatform}. The video was originally created for ${originalPlatform}.

Extracted Video Information (includes both visual and audio analysis):
${JSON.stringify(extractedData, null, 2)}

Focus on:
1. Content analysis - topics, key points, visual elements, audio content, captions, pacing, editing style, hook strength, production quality
2. ${newPlatform}'s current (2026) algorithm priorities: completion rate, shares, comments, saves/bookmarks, early engagement signals, trending audio usage, hook strength in first 2 seconds, caption keyword density, hashtag strategy, optimal posting signals, and watch time patterns
3. How both the visual and audio content aligns with ${newPlatform}'s algorithm best practices compared to ${originalPlatform}
4. Specific recommendations for overlays, text overlays, audio choices, visual edits, and CTAs that work well on ${newPlatform} but may differ from ${originalPlatform}
5. Optimized title, description, and hashtag suggestions tailored for ${newPlatform}

Provide a realistic score based on the comprehensive content analysis (visual + audio) and ${newPlatform}'s algorithm alignment.`

    const geminiResponse = await Promise.race([
      genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
      timeoutPromise,
    ]) as { text?: string | (() => string) }

    let rawText: string
    try {
      rawText = typeof geminiResponse.text === 'function'
        ? geminiResponse.text()
        : geminiResponse.text ?? ''
    } catch {
      throw new Error('Gemini returned a response with no readable text')
    }

    if (!rawText) {
      throw new Error('Empty Gemini response')
    }

    let cleanContent = rawText
    if (rawText.includes('```')) {
      cleanContent = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const result = JSON.parse(cleanContent)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Re-analyzer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('timeout')) {
      return NextResponse.json({
        error: 'Analysis timeout',
        userMessage: 'The re-analysis is taking too long. Please try again later.',
        details: errorMessage,
      }, { status: 504 })
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
