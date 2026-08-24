import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // RobotTalk is an R&D tab feature, so it requires site owner access
    await verifyOwnerUser(req)

    const body = await req.json().catch(() => ({}))
    const { messages } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', details: 'messages array is required' },
        { status: 400 }
      )
    }

    const apiKey = (process.env.GEMINI_API || process.env.GOOGLE_API_KEY || '').trim()
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          details: 'GEMINI_API environment variable is not configured on the server.',
        },
        { status: 503 }
      )
    }

    const ai = new GoogleGenAI({ apiKey })
    const model = (process.env.ROBOTTALK_GEMINI_MODEL || 'gemini-2.5-flash').trim()

    // Map roles: 'assistant' -> 'model', 'user' -> 'user'
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }))

    const systemInstruction = 
      "You are RobotTalk, a friendly, witty, and highly knowledgeable AI assistant embedded in the Stream Dreams Creator Corner (SDHQCC) R&D dashboard. " +
      "Your mission is to help the site owner (Bulletbait) brainstorm, design, and optimize streaming tools, video editing workflows, platform algorithms (Kick, Twitch, YouTube, TikTok), " +
      "and general creator strategies. " +
      "Keep your tone engaging, professional yet creator-friendly, and highly practical. " +
      "Feel free to use bullet points, code snippets, or structured advice where helpful."

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    })

    const text = response.text?.trim() || 'No response generated.'

    return NextResponse.json({ text })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[robot-talk POST]', error)
    return NextResponse.json(
      { error: 'Failed to generate response', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
