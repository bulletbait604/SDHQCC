import { NextRequest, NextResponse } from 'next/server'
import RunwayML from '@runwayml/sdk'
import { verifyAuth, hasClipEditorAccess, AuthError } from '@/lib/auth/verifyAuth'
import { resolveRunwayApiSecret } from '@/lib/clipEditorServerKeys'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    if (!hasClipEditorAccess(user)) {
      return NextResponse.json({ error: 'Clip Editor requires the Editor badge.' }, { status: 403 })
    }
    const runwaySecret = resolveRunwayApiSecret()
    if (!runwaySecret) {
      return NextResponse.json(
        { error: 'Runway is not configured', details: 'Set RUNWAY_API (or RUNWAYML_API_SECRET).' },
        { status: 503 }
      )
    }

    const taskId = request.nextUrl.searchParams.get('taskId') || ''
    if (!taskId || taskId.length > 200) {
      return NextResponse.json({ error: 'taskId query parameter is required' }, { status: 400 })
    }

    const client = new RunwayML({ apiKey: runwaySecret })
    const task = await client.tasks.retrieve(taskId)
    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[clip-editor/runway/task]', error)
    const message = error instanceof Error ? error.message : 'Task fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
