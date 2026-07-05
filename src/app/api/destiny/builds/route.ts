import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { MOCK_BUILD_CARDS, MOCK_EXTERNAL_BUILDS } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const { searchParams } = new URL(req.url)
    const activity = searchParams.get('activity') ?? 'Salvation\'s Edge'
    const verifiedBuilds = MOCK_BUILD_CARDS.filter(
      (b) => !activity || b.activityName === activity
    )
    const aiSummary =
      'Among the top 10 verified Ghosts of the Deep clears this month, Prismatic Warlock using Rime-Coat Raiment appeared in 40% of teams and had the lowest average death rate. (Mock summary — Phase 4 will use real verified run data.)'

    return NextResponse.json({
      verifiedBuilds,
      externalBuilds: MOCK_EXTERNAL_BUILDS,
      aiSummary,
      activity,
    })
  })
}
