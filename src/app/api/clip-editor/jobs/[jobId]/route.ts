import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { getClipEditorJobForUser } from '@/lib/clip-editor/jobs'
import { CLIP_EDITOR_STATE_LABELS } from '@/lib/clip-editor/jobStates'
import { clipEditorTierPublicSummary } from '@/lib/clip-editor/tier'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { jobId: string } }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    const jobId = context.params.jobId
    if (!jobId || jobId.length > 80) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
    }

    const job = await getClipEditorJobForUser(jobId, user.username)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const phasePaused = job.state === 'CUT_PHASE_DONE'

    return NextResponse.json({
      jobId: job._id,
      state: job.state,
      userPhase: job.userPhase ?? 'ready',
      stateLabel: CLIP_EDITOR_STATE_LABELS[job.state],
      progress: job.progress,
      phasePaused,
      error: job.error,
      cutPreviewUrl: job.cutPreviewUrl,
      effectsPreviewUrl: job.effectsPreviewUrl,
      outputUrl: job.outputUrl,
      outputR2Key: job.outputR2Key,
      shotstackRenderId: job.shotstackRenderId,
      platform: job.platform,
      layoutTemplate: job.layoutTemplate,
      metadata: job.passes.metadata,
      viralityCut: job.passes.viralityCut,
      viralityEffects: job.passes.viralityEffects,
      viralityText: job.passes.viralityText,
      cutPhasePlan: job.passes.cutPhasePlan,
      cutRanking: job.passes.cutRanking,
      geminiVideo: job.passes.geminiVideo,
      qualityTier: clipEditorTierPublicSummary(),
      editPlan: job.state === 'COMPLETE' ? job.passes.finalEditPlan : undefined,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    const message = error instanceof Error ? error.message : 'Could not load job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
