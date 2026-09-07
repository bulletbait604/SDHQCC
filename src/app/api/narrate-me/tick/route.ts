import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import {
  INTERNAL_API_SECRET_HEADER,
  isValidCronRequest,
  isValidInternalApiSecret,
} from '@/lib/internalApi'
import { tickActiveJobs, tickNarrateMeJob } from '@/lib/narrateMe/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function authorize(req: NextRequest): Promise<'internal' | 'owner'> {
  if (isValidCronRequest(req) || isValidInternalApiSecret(req.headers.get(INTERNAL_API_SECRET_HEADER))) {
    return 'internal'
  }
  const bearer = req.headers.get('authorization') || ''
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
  const modalSecret = process.env.MODAL_SECRET?.trim()
  if (modalSecret && token && token === modalSecret) return 'internal'
  await verifyOwnerUser(req)
  return 'owner'
}

async function run(req: NextRequest) {
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const jobId =
    (typeof body.jobId === 'string' && body.jobId) ||
    req.nextUrl.searchParams.get('jobId') ||
    ''
  if (jobId) {
    const job = await tickNarrateMeJob(jobId)
    return NextResponse.json({ job })
  }
  const processed = await tickActiveJobs(4)
  return NextResponse.json({ processed })
}

export async function GET(req: NextRequest) {
  try {
    await authorize(req)
    return await run(req)
  } catch (err) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[narrate-me/tick]', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req)
    return await run(req)
  } catch (err) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[narrate-me/tick]', err)
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 })
  }
}
