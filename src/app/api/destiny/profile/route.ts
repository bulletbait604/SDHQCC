import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichProfile } from '@/lib/destiny/enrich'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { fetchLiveLoadout, refreshGuardianFromBungie } from '@/lib/destiny/liveBungieData'
import { buildPlayerProfileFromStored, emptyPlayerProfile } from '@/lib/destiny/profileBuilder'
import { getRunsForUser } from '@/lib/destiny/store'
import { verifyAuth } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    let stored = await getDestinyUserBySiteUserId(siteUserId)

    if (!stored?.oauth) {
      return NextResponse.json({
        profile: await enrichProfile(emptyPlayerProfile(siteUserId)),
        bungieLinked: false,
      })
    }

    stored = await refreshGuardianFromBungie(stored)
    const [runs, loadout] = await Promise.all([
      getRunsForUser(siteUserId),
      fetchLiveLoadout(stored).catch(() => null),
    ])

    const profile = buildPlayerProfileFromStored(stored, runs, loadout ?? undefined)
    return NextResponse.json({
      profile: await enrichProfile(profile),
      bungieLinked: true,
    })
  })
}
