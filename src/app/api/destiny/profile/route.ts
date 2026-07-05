import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { enrichProfile } from '@/lib/destiny/enrich'
import { getDestinyUserBySiteUserId, upsertDestinyUser } from '@/lib/destiny/destinyUserStore'
import { fetchLiveLoadout, refreshGuardianFromBungie } from '@/lib/destiny/liveBungieData'
import { buildPlayerProfileFromStored, emptyPlayerProfile } from '@/lib/destiny/profileBuilder'
import { sanitizeFlexPreferences } from '@/lib/destiny/profileFlex'
import {
  getReputationReviewsForUser,
  getRunsForUser,
  getSeasonStandingForUser,
} from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
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
    const [runs, loadout, reviews, seasonLeaderboardEntries] = await Promise.all([
      getRunsForUser(siteUserId),
      fetchLiveLoadout(stored).catch(() => null),
      getReputationReviewsForUser(siteUserId),
      getSeasonStandingForUser(siteUserId),
    ])

    const profile = buildPlayerProfileFromStored(stored, runs, {
      loadout: loadout ?? undefined,
      reviews,
      seasonLeaderboardEntries,
    })
    return NextResponse.json({
      profile: await enrichProfile(profile),
      bungieLinked: true,
    })
  })
}

export async function PATCH(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(siteUserId)

    if (!stored?.oauth) {
      return NextResponse.json({ error: 'Link Bungie before customizing profile display' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as { profileFlexStats?: unknown } | null
    const profileFlexStats = sanitizeFlexPreferences(body?.profileFlexStats)

    await upsertDestinyUser(siteUserId, { profileFlexStats })

    return NextResponse.json({ profileFlexStats })
  })
}
