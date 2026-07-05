import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { getSeasonCountdown } from '@/lib/destiny/mockData'
import { getSeasonData } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const season = await getSeasonData()
    return NextResponse.json({
      season,
      countdown: getSeasonCountdown(),
      eligibility:
        'Top 5 in Raid, Dungeon, or Full Clan Team categories at season end win prizes. Verified full clears only.',
      hallOfFame: season.winners ?? [],
    })
  })
}
