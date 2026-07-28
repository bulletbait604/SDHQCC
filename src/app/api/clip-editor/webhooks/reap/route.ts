import { NextRequest, NextResponse } from 'next/server'
import { handleReapProjectWebhook } from '@/lib/clip-editor/reapPipeline'

export const dynamic = 'force-dynamic'

/**
 * Reap Automation webhook.
 * Configure in Reap dashboard: Profile → Settings → Webhooks
 * URL: https://YOUR_APP/api/clip-editor/webhooks/reap
 *
 * Must return HTTP 200 with an empty body (Reap requirement).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string
      projectType?: string
      source?: string
      status?: string
    }

    await handleReapProjectWebhook({
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
    })

    // Reap requires empty body + 200
    return new NextResponse('', { status: 200 })
  } catch (error) {
    console.error('[clip-editor/webhooks/reap]', error)
    // Still 200 to avoid auto-disable on transient handler bugs after accept;
    // scheduling failures are logged. Reap disables after 5 consecutive non-200s.
    return new NextResponse('', { status: 200 })
  }
}
