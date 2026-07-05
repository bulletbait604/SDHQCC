import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { enrichProfile } from '@/lib/destiny/enrich'
import { resolveDisplayEmblem } from '@/lib/destiny/guardianEmblems'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { fetchLiveLoadout, refreshGuardianFromBungie } from '@/lib/destiny/liveBungieData'
import { buildPlayerProfileFromStored, emptyPlayerProfile } from '@/lib/destiny/profileBuilder'
import { sanitizeFlexPreferences } from '@/lib/destiny/profileFlex'
import {
  getReputationReviewsForUser,
  getRunsForUser,
  getSeasonStandingForUser,
  getTrustReviewsForUser,
} from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

async function buildProfile(siteUserId: string, scope: 'summary' | 'full') {
  let stored = await getDestinyUserBySiteUserId(siteUserId)

  if (!stored?.oauth) {
    return {
      profile: await enrichProfile(emptyPlayerProfile(siteUserId), scope),
      bungieLinked: false,
    }
  }

  stored = await refreshGuardianFromBungie(stored)
  const displayEmblem = await resolveDisplayEmblem(stored)
  stored = (await getDestinyUserBySiteUserId(siteUserId)) ?? stored

  let loadout = undefined
  if (scope === 'full') {
    loadout = (await fetchLiveLoadout(stored).catch(() => null)) ?? undefined
    stored = (await getDestinyUserBySiteUserId(siteUserId)) ?? stored
  }

  const [runs, reviews, trustReviews, seasonLeaderboardEntries] = await Promise.all([
    scope === 'full' ? getRunsForUser(siteUserId) : Promise.resolve([]),
    scope === 'full' ? getReputationReviewsForUser(siteUserId) : Promise.resolve([]),
    getTrustReviewsForUser(siteUserId),
    scope === 'full' ? getSeasonStandingForUser(siteUserId) : Promise.resolve([]),
  ])

  const profile = buildPlayerProfileFromStored(stored, runs, {
    loadout,
    reviews,
    trustReviews,
    seasonLeaderboardEntries,
    displayEmblem,
  })

  return {
    profile: await enrichProfile(profile, scope),
    bungieLinked: true,
  }
}

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const scopeParam = new URL(req.url).searchParams.get('scope')
    const scope = scopeParam === 'full' ? 'full' : 'summary'

    const result = await buildProfile(siteUserId, scope)
    return NextResponse.json(result)
  })
}

export async function PATCH(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(siteUserId)

    if (!stored?.oauth) {
      return NextResponse.json({ error: 'Link Bungie before customizing your profile' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as {
      profileFlexStats?: unknown
      displayEmblemSource?: 'equipped' | 'collection'
      displayEmblemHash?: number | null
    } | null

    const { upsertDestinyUser } = await import('@/lib/destiny/destinyUserStore')
    const patch: Record<string, unknown> = {}

    if (body?.profileFlexStats !== undefined) {
      patch.profileFlexStats = sanitizeFlexPreferences(body.profileFlexStats)
    }

    if (body?.displayEmblemSource === 'equipped') {
      patch.displayEmblemSource = 'equipped'
    } else if (body?.displayEmblemSource === 'collection' && body.displayEmblemHash) {
      patch.displayEmblemSource = 'collection'
      patch.displayEmblemHash = body.displayEmblemHash
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    await upsertDestinyUser(siteUserId, patch)

    if (body?.displayEmblemSource === 'equipped') {
      const client = await (await import('@/lib/mongodb')).default
      const { DESTINY_COLLECTIONS } = await import('@/lib/destiny/collections')
      await client.db('sdhq').collection(DESTINY_COLLECTIONS.users).updateOne(
        { userId: siteUserId },
        { $unset: { displayEmblemHash: '' } }
      )
    }
    const displayEmblem = await resolveDisplayEmblem((await getDestinyUserBySiteUserId(siteUserId))!)

    return NextResponse.json({
      profileFlexStats: patch.profileFlexStats,
      displayEmblemSource: patch.displayEmblemSource ?? stored.displayEmblemSource,
      displayEmblemHash: patch.displayEmblemHash ?? stored.displayEmblemHash,
      displayEmblem,
    })
  })
}
