import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { listViralClipJobsForUser } from '@/lib/viralClipGen/history'
import { runViralClipPipeline, validateViralClipInput } from '@/lib/viralClipGen/pipeline'
import { VIDEO_GENERATION_COSTS } from '@/lib/viralClipGen/costs'
import { VIRAL_CLIP_DURATIONS } from '@/lib/viralClipGen/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function statusOf(err: unknown): number {
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number' && s >= 400 && s < 600) return s
  }
  return 503
}

/** Owner-only R&D: Gemini plan → fal video → optional Shotstack concat. */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const body = await req.json().catch(() => ({}))
    const input = validateViralClipInput(body)
    const result = await runViralClipPipeline({
      user,
      prompt: input.prompt,
      duration: input.duration,
      references: input.references,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[viral-clip-gen]', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json(
      { error: message, userMessage: message },
      { status: statusOf(err) }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyOwnerUser(req)
    const jobs = await listViralClipJobsForUser(user.username, 20)
    return NextResponse.json({
      jobs,
      durations: VIRAL_CLIP_DURATIONS,
      costs: VIDEO_GENERATION_COSTS,
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[viral-clip-gen] history', err)
    return NextResponse.json({ error: 'Could not load clip history.' }, { status: 503 })
  }
}
