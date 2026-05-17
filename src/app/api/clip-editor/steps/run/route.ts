import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { advanceClipEditorStep } from '@/lib/clip-editor/pipeline'
import { verifyClipEditorStepRequest } from '@/lib/clip-editor/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const bodySchema = z.object({
  jobId: z.string().min(1).max(80),
})

/**
 * Cloud step runner — invoked by Upstash QStash (not a local worker).
 * Each call executes one pipeline stage on Vercel, then QStash schedules the next.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('upstash-signature')

  const verified = await verifyClipEditorStepRequest({ signature, body: rawBody })
  if (!verified) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })
  }

  let jobId: string
  try {
    const parsed = bodySchema.parse(JSON.parse(rawBody))
    jobId = parsed.jobId
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  try {
    const result = await advanceClipEditorStep(jobId)
    console.info('[clip-editor] step ok', { jobId, state: result.state, done: result.done })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Step failed'
    console.error('[clip-editor] step failed', { jobId, error: message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
