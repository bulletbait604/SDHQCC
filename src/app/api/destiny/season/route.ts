import { NextRequest, NextResponse } from 'next/server'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getSeasonCountdown } from '@/lib/destiny/seasonConfig'
import { computeSeasonStandings } from '@/lib/destiny/seasonPrizes'
import { buildWeeklyResetInfo } from '@/lib/destiny/enrich'
import { getSeasonData, getSeasonStandingsInput } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const season = await getSeasonData()
    const weeklyReset = await buildWeeklyResetInfo()
    const { runs, usersById } = await getSeasonStandingsInput()
    const { hallOfFame, eligibility } = computeSeasonStandings(runs, usersById, season)

    return NextResponse.json({
      season,
      countdown: getSeasonCountdown(season),
      weeklyReset,
      eligibility,
      hallOfFame,
    })
  })
}
