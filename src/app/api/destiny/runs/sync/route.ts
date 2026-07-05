import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { syncRunsForUser } from '@/lib/destiny/runIngestion'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(siteUserId)

    if (!stored?.oauth) {
      return NextResponse.json(
        { error: 'Connect your Bungie account from Overview first.' },
        { status: 400 }
      )
    }

    try {
      const result = await syncRunsForUser(stored)
      return NextResponse.json({
        ok: true,
        synced: result.synced,
        flagged: result.flagged,
        skipped: result.skipped,
        builds: result.builds,
        message: `Synced ${result.synced} run(s) · ${result.builds} build(s) captured.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  })
}
