import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getSeasonCountdown } from '@/lib/destiny/seasonConfig'
import { prizeEligibleTracks } from '@/lib/destiny/fireteamReputation'
import { buildUserPrizeTrack, computeSeasonStandings } from '@/lib/destiny/seasonPrizes'
import { buildWeeklyResetInfo } from '@/lib/destiny/enrich'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import {
  getPrizeClaimsForUser,
  getSeasonData,
  getSeasonStandingForUser,
  getSeasonStandingsInput,
} from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const season = await getSeasonData()
    const weeklyReset = await buildWeeklyResetInfo()
    const { runs, usersById } = await getSeasonStandingsInput()
    const { hallOfFame, eligibility } = computeSeasonStandings(runs, usersById, season)
    const myStandings = await getSeasonStandingForUser(siteUserId)
    const prizeTrack = buildUserPrizeTrack(myStandings, season)
    const prizeClaims = await getPrizeClaimsForUser(siteUserId, season.id)
    const prizeEligible = prizeEligibleTracks(prizeTrack, season, hallOfFame, siteUserId)
    const stored = await getDestinyUserBySiteUserId(siteUserId)
    const seasonEnded =
      season.status === 'archived' || Date.now() >= new Date(season.endDate).getTime()

    return NextResponse.json({
      season,
      countdown: getSeasonCountdown(season),
      weeklyReset,
      eligibility,
      hallOfFame,
      myStandings,
      prizeTrack,
      prizeEligible,
      prizeClaims,
      seasonEnded,
      bungieLinked: Boolean(stored?.oauth),
    })
  })
}
