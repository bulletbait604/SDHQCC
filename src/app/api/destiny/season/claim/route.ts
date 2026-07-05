import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { canSubmitPrizeClaim, prizeEligibleTracks } from '@/lib/destiny/fireteamReputation'
import { buildUserPrizeTrack } from '@/lib/destiny/seasonPrizes'
import {
  getPrizeClaimsForUser,
  getSeasonData,
  getSeasonStandingForUser,
  savePrizeClaim,
} from '@/lib/destiny/store'
import type { DestinyPlatform, PrizeClaim } from '@/lib/destiny/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const userId = authUser.username.toLowerCase()
    const season = await getSeasonData()
    const claims = await getPrizeClaimsForUser(userId, season.id)
    return NextResponse.json({ claims, seasonId: season.id })
  })
}

export async function POST(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const userId = authUser.username.toLowerCase()
    const season = await getSeasonData()
    const body = (await req.json().catch(() => null)) as {
      category?: string
      platform?: string
      contact?: string
    } | null

    const category = body?.category as PrizeClaim['category'] | undefined
    const platform = body?.platform as DestinyPlatform | undefined
    const contact = body?.contact?.trim()

    if (!category || !platform || !contact) {
      return NextResponse.json({ error: 'category, platform, and contact are required' }, { status: 400 })
    }
    if (contact.length > 120) {
      return NextResponse.json({ error: 'contact must be 120 characters or less' }, { status: 400 })
    }

    const [myStandings, existingClaims] = await Promise.all([
      getSeasonStandingForUser(userId),
      getPrizeClaimsForUser(userId, season.id),
    ])
    const prizeTrack = buildUserPrizeTrack(myStandings, season)
    const eligible = prizeEligibleTracks(prizeTrack, season, season.winners ?? [], userId)

    const check = canSubmitPrizeClaim(userId, season, eligible, existingClaims, category)
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }

    const claim: PrizeClaim = {
      id: `claim-${userId}-${season.id}-${category}-${Date.now()}`,
      userId,
      seasonId: season.id,
      category,
      rank: check.rank,
      prize: check.prize,
      platform,
      contact,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    await savePrizeClaim(claim)
    return NextResponse.json({ ok: true, claim })
  })
}
