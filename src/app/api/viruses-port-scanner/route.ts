import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse } from '@/lib/auth/verifyAuth'
import { verifyRndToolUser } from '@/lib/auth/staffAccess'
import { cloudScanBlockedReason, CLOUD_SCAN_USER_MESSAGE } from '@/lib/virusesPortScanner/localScan'
import { scanAllLocalPorts } from '@/lib/virusesPortScanner/scan'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Owner-only R&D: Open/Closed for every local TCP port, plus inbound/outbound sessions. */
export async function GET(req: NextRequest) {
  try {
    await verifyRndToolUser(req, 'viruses-port-scanner')
    const blocked = cloudScanBlockedReason(req.headers.get('host'), Boolean(process.env.VERCEL))
    if (blocked) {
      return NextResponse.json({ error: 'local-only', userMessage: blocked }, { status: 409 })
    }
    const result = await scanAllLocalPorts()
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[viruses-port-scanner]', err)
    const message = err instanceof Error ? err.message : 'Port scan failed'
    return NextResponse.json(
      {
        error: message,
        userMessage:
          message === CLOUD_SCAN_USER_MESSAGE
            ? message
            : 'Could not read ports on this PC. Open http://127.0.0.1:3847/ after npm run viruses-server.',
      },
      { status: 503 }
    )
  }
}
