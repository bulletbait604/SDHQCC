import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  hasClipEditorAccess,
  AuthError,
  createAuthErrorResponse,
} from '@/lib/auth/verifyAuth'
import { generatePresignedReadUrl } from '@/lib/r2'
import { ZodError } from 'zod'
import { createClipEditorJobBodySchema } from '@/lib/clip-editor/schemas'
import { createClipEditorJob } from '@/lib/clip-editor/jobs'
import { isQStashFullyConfigured, clipEditorAppBaseUrl } from '@/lib/clip-editor/dispatch'
import { CLIP_EDITOR_STATE_LABELS } from '@/lib/clip-editor/jobStates'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }

    if (!isQStashFullyConfigured()) {
      return NextResponse.json(
        {
          error: 'Clip Editor queue is not configured',
          userMessage:
            'Add QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, QSTASH_URL (US or EU), and CLIP_EDITOR_APP_URL in Vercel.',
        },
        { status: 503 }
      )
    }

    if (!clipEditorAppBaseUrl()) {
      return NextResponse.json(
        {
          error: 'CLIP_EDITOR_APP_URL is not configured',
          userMessage:
            'Set CLIP_EDITOR_APP_URL to your production site URL (e.g. https://your-app.vercel.app) so QStash can call back into Vercel.',
        },
        { status: 503 }
      )
    }

    const body = createClipEditorJobBodySchema.parse(await request.json())
    const storageUser = user.username.replace(/^@/, '').toLowerCase()
    const prefix = `uploads/clips/${storageUser}/`
    if (!body.r2FileKey.startsWith(prefix) || body.r2FileKey.includes('..')) {
      return NextResponse.json({ error: 'Invalid r2FileKey for current user' }, { status: 400 })
    }

    const sourceReadUrl = await generatePresignedReadUrl(body.r2FileKey, 86400)
    if (!sourceReadUrl) {
      return NextResponse.json({ error: 'Could not prepare uploaded clip' }, { status: 503 })
    }

    const job = await createClipEditorJob({
      userId: user.id,
      username: storageUser,
      sourceReadUrl,
      body,
    })

    return NextResponse.json({
      jobId: job._id,
      state: job.state,
      userPhase: job.userPhase,
      stateLabel: CLIP_EDITOR_STATE_LABELS[job.state],
      progress: job.progress,
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.flatten() }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Could not create clip editor job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
