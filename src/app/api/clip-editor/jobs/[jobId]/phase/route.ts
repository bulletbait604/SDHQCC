import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { getClipEditorJobForUser } from '@/lib/clip-editor/jobs'
import { startClipEditorWizardPhase } from '@/lib/clip-editor/pipeline'
import { startClipEditorPhaseSchema } from '@/lib/clip-editor/schemas'
import {
  isQStashFullyConfigured,
  clipEditorAppBaseUrl,
} from '@/lib/clip-editor/dispatch'
import { CLIP_EDITOR_STATE_LABELS } from '@/lib/clip-editor/jobStates'
import { ZodError } from 'zod'
import { deductCoinsForUser } from '@/lib/coins/deductCoinsServer'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

const PHASE_COIN_TOOL = {
  cut: 'clip-editor-cut',
  finish: 'clip-editor-finish',
} as const

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    if (!isQStashFullyConfigured() || !clipEditorAppBaseUrl()) {
      return NextResponse.json(
        {
          error: 'Clip Editor queue is not configured',
          userMessage: 'QStash / CLIP_EDITOR_APP_URL must be set on the server.',
        },
        { status: 503 }
      )
    }

    const jobId = context.params.jobId
    if (!jobId || jobId.length > 80) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
    }

    const job = await getClipEditorJobForUser(jobId, user.username)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const body = startClipEditorPhaseSchema.parse(await request.json())
    const coinTool = PHASE_COIN_TOOL[body.phase]

    const deducted = await deductCoinsForUser(user, coinTool)
    if (!deducted.ok) {
      return NextResponse.json(
        {
          error: 'Not enough coins',
          userMessage: `This step needs 1 coin (${coinTool}). Purchase more or subscribe for unlimited access.`,
        },
        { status: 402 }
      )
    }

    const { state } = await startClipEditorWizardPhase(jobId, body.phase)

    return NextResponse.json({
      jobId,
      phase: body.phase,
      state,
      stateLabel: CLIP_EDITOR_STATE_LABELS[state],
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Could not start phase'
    return NextResponse.json({ error: message, userMessage: message }, { status: 400 })
  }
}
