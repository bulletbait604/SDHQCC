import { NextRequest, NextResponse } from 'next/server'
import {
  INTERNAL_API_SECRET_HEADER,
  isValidCronRequest,
  isValidInternalApiSecret,
} from '@/lib/internalApi'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyStaffUser } from '@/lib/auth/staffAccess'

export const dynamic = 'force-dynamic'
/** Full multi-platform research can exceed default serverless limits. */
export const maxDuration = 300

async function runAlgorithmsUpdate(): Promise<Response> {
  // Dynamic import avoids static circular coupling between route modules.
  // On failure, prior Mongo snapshot is preserved — app keeps working.
  const { runAlgorithmRefresh } = await import('@/app/api/algorithms/route')
  const response = await runAlgorithmRefresh({
    force: false,
    source: 'monthly-cron',
    actorUsername: 'system',
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.userMessage === 'string'
        ? data.userMessage
        : typeof data.error === 'string'
          ? data.error
          : 'Failed to update algorithms'
    return NextResponse.json(
      { error: message, details: data.details },
      { status: response.status }
    )
  }

  return NextResponse.json({
    success: true,
    skipped: data.skipped === true,
    message:
      data.skipped === true
        ? typeof data.message === 'string'
          ? data.message
          : 'Already updated this month'
        : 'Algorithm data updated successfully',
    provider: typeof data.provider === 'string' ? data.provider : undefined,
    model: typeof data.model === 'string' ? data.model : undefined,
    lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : undefined,
    estimatedCostNote:
      typeof data.estimatedCostNote === 'string' ? data.estimatedCostNote : undefined,
  })
}

async function authorizeAndRun(req: NextRequest): Promise<Response> {
  // Monthly Vercel Cron sets x-vercel-cron: 1 (no env var needed).
  if (isValidCronRequest(req)) {
    return await runAlgorithmsUpdate()
  }
  const secret = req.headers.get(INTERNAL_API_SECRET_HEADER)
  if (isValidInternalApiSecret(secret)) {
    return await runAlgorithmsUpdate()
  }
  await verifyStaffUser(req)
  return await runAlgorithmsUpdate()
}

/** Vercel Cron (1st of month) — authorized via x-vercel-cron header */
export async function GET(req: NextRequest) {
  try {
    return await authorizeAndRun(req)
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error updating algorithms (GET cron):', error)
    return NextResponse.json({ error: 'Failed to update algorithms' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await authorizeAndRun(req)
  } catch (error: unknown) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('Error updating algorithms:', error)
    return NextResponse.json({ error: 'Failed to update algorithms' }, { status: 500 })
  }
}
