import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { verifyAuth, hasUnlimitedAccess, AuthError } from '@/lib/auth/verifyAuth'
import { resolveCoinBalanceUserId } from '@/lib/coinUserId'
import clientPromise from '@/lib/mongodb'
import { readAlgorithmSnapshotFromMongo } from '@/lib/algorithmSnapshotRead'
import {
  clipEditorOpenAiModel,
  resolveOpenAiApiKey,
} from '@/lib/clipEditorServerKeys'

export const dynamic = 'force-dynamic'

const PLAN_COIN_COST = 2

export type ClipEditorPlanModel = 'gen4_aleph' | 'seedance2'

function extractFirstJsonObject(raw: string): string | null {
  const s = raw.trim()
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (inString) {
      if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    const openaiKey = resolveOpenAiApiKey()
    if (!openaiKey) {
      return NextResponse.json(
        {
          error: 'OpenAI is not configured',
          details: 'Set OPENAI_API_KEY or OPENAI_API for Clip Editor planning.',
        },
        { status: 503 }
      )
    }

    if (!hasUnlimitedAccess(user)) {
      if (user.role !== 'free') {
        return NextResponse.json({ error: 'Access denied. Subscription required.' }, { status: 403 })
      }
      const db = await clientPromise
      const database = db.db('sdhq')
      const balanceKey = await resolveCoinBalanceUserId(database, user)
      const row = await database.collection('coinBalances').findOne({ userId: balanceKey })
      const coins = typeof row?.coins === 'number' ? row.coins : 0
      if (coins < PLAN_COIN_COST) {
        return NextResponse.json(
          {
            error: 'Not enough coins',
            userMessage: `Clip Editor plan needs at least ${PLAN_COIN_COST} coins.`,
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { platform, clipBrief } = body as {
      platform?: string
      clipBrief?: string
    }

    if (!platform || typeof platform !== 'string') {
      return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    }
    if (!clipBrief || typeof clipBrief !== 'string' || clipBrief.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            'clipBrief is required (at least ~20 characters). Summarize the footage, hook, pacing, and audio.',
        },
        { status: 400 }
      )
    }

    const snapshot = await readAlgorithmSnapshotFromMongo()
    const algorithmBlock = snapshot?.data?.[platform] ?? null

    const model = clipEditorOpenAiModel()
    const client = new OpenAI({ apiKey: openaiKey })

    const sys = `You are a senior short-form video strategist and editor for social platforms.
You receive (1) Creator Corner stored algorithm notes for the TARGET platform and (2) a text brief describing the source clip (up to ~90s 1080p may be edited later with external video models).
Produce a concrete plan optimized for discovery and retention. Be specific about pacing, hook, captions, framing, and what instructions to send to Runway — including pure text-to-video (Gen-4.5), video-guided generations, or video-to-video transforms.`

    const userMsg = `TARGET_PLATFORM_ID: ${platform}

STORED_ALGORITHM_NOTES_JSON:
${JSON.stringify(algorithmBlock, null, 2)}

CLIP_BRIEF_FROM_CREATOR:
${clipBrief.trim()}

Reply with a single JSON object only (no markdown fences) matching this shape:
{
  "platformFitSummary": "string",
  "viralHypothesis": "string",
  "recommendedRunwayModel": "gen4_aleph" | "seedance2" | "gen4.5",
  "seedanceDuration": number | null,
  "gen45Duration": number | null,
  "gen45Ratio": "1280:720" | "720:1280" | null,
  "runwayPromptText": "string (<= 980 chars — prompts cap at 1000 UTF-16 units for Aleph and Gen-4.5)",
  "editChecklist": ["string"],
  "risksAndDisclaimers": ["string"],
  "modelChoiceRationale": "string"
}

Model choice:
- gen4_aleph: stylistic/transform on the user's uploaded footage (video-to-video).
- seedance2: a new 4–15s clip guided by the source video — set seedanceDuration 4–15.
- gen4.5: Runway Gen-4.5 **text-to-video** (optional reference image may exist in-product later; describe the clip cinematically). Set gen45Duration 2–10 and gen45Ratio for landscape shorts vs portrait. Does not ingest the user's upload in API v1 unless combined with future image references.`

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.6,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const jsonSlice = extractFirstJsonObject(raw) || raw
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonSlice)
    } catch {
      return NextResponse.json(
        { error: 'Planner returned non-JSON', raw: raw.slice(0, 2000) },
        { status: 502 }
      )
    }

    return NextResponse.json({
      plan: parsed,
      openaiModel: model,
      algorithmLastUpdated: snapshot?.lastUpdated ?? null,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[clip-editor/plan]', error)
    const message = error instanceof Error ? error.message : 'Plan failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
