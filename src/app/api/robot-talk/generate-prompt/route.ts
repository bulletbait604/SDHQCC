import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // RobotTalk features are for the site owner
    await verifyOwnerUser(req)

    const body = await req.json().catch(() => ({}))
    const { idea, targetModel, provider } = body

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'idea is required' },
        { status: 400 }
      )
    }

    const apiKey = (process.env.OPENAI_API || process.env.OPENAI_API_KEY || '').trim()
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          details: 'OPENAI_API or OPENAI_API_KEY environment variable is not configured on the server.',
        },
        { status: 503 }
      )
    }

    const systemPrompt = 
      "You are an expert Prompt Engineer. Your task is to take a user's raw idea/request and transform it into a highly effective, optimized, and professional prompt tailored specifically for a target AI model.\n\n" +
      `The target model is: ${targetModel} (Provider: ${provider})\n\n` +
      "Your response must be a JSON object with exactly two keys:\n" +
      "1. \"generatedPrompt\": The final optimized prompt, beautifully formatted in Markdown. Do not include markdown code fences around the JSON itself.\n" +
      "2. \"explanation\": A brief (2-3 sentences) explanation of the prompt engineering techniques applied and why they are optimal for this specific model/provider.\n\n" +
      "Tailoring Guidelines:\n" +
      "- Anthropic Claude: Use XML tags (e.g., <instructions>, <context>, <examples>) to structure the prompt. Claude models excel at parsing XML.\n" +
      "- OpenAI GPT-4o/mini: Use clear Markdown headings, bullet points, and explicit system/user role division. Keep instructions logical and structured.\n" +
      "- OpenAI o1/o3-mini (Reasoning): Do not use chain-of-thought or 'think step-by-step' prompts. Keep instructions direct, highly specific, and focus on constraints and final output requirements.\n" +
      "- Google Gemini: Use clear contextual framing, structured instructions, and explicit input/output definitions.\n" +
      "- Llama/Open Source: Use explicit system prompt blocks, clear delimiters, and few-shot examples if applicable.\n" +
      "- Cursor: Focus heavily on precise code generation, refactoring instructions, explicit file paths, and function signatures. Keep prompts concise, direct, and highly actionable for an IDE assistant.\n" +
      "- Local / Downloadable (Ollama, LM Studio): Keep instructions simple, direct, and highly structured with clear system prompts and delimiters. Local models have smaller context windows and lower reasoning capacity, so avoid overly complex nested reasoning instructions unless target is a reasoning model like DeepSeek-R1.\n" +
      "- AI Video Editors (CapCut, Descript, Runway, Opus Clip, Vizard, Premiere, DaVinci, etc.): Write practical editing briefs, not chatbot system prompts. Include: target platform (TikTok/Reels/Shorts), aspect ratio (9:16), duration, pacing/cut style, caption style, overlays/text hooks, music/SFX vibe, B-roll guidance, and export settings. Use short imperative steps the editor's AI/auto tools can follow (e.g. AutoCut, Auto Captions, Magic Mask). Avoid abstract chain-of-thought; be visual and production-ready.\n" +
      "- Reasoning/Coding models: Focus heavily on edge cases, logical constraints, and precise output schemas.\n\n" +
      "Return ONLY a valid JSON object. No conversational filler, no markdown formatting outside the JSON."

    const userPrompt = `User's raw idea: "${idea}"\n\nGenerate the optimized prompt for ${targetModel}.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI API call failed (${res.status}): ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI returned empty content')
    }

    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[generate-prompt POST]', error)
    return NextResponse.json(
      { error: 'Failed to generate prompt', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
