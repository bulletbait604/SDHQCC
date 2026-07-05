import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichBuildsResponse } from '@/lib/destiny/enrich'
import { MOCK_BUILD_CARDS, MOCK_EXTERNAL_BUILDS } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const { searchParams } = new URL(req.url)
    const activity = searchParams.get('activity') ?? 'Garden of Salvation'
    const verifiedBuilds = MOCK_BUILD_CARDS.filter(
      (b) => !activity || b.activityName === activity
    )
    const aiSummary =
      'Among the top 10 verified Garden of Salvation clears this week, Void Warlock with Ophidian Aspect and Divinity appeared in 40% of teams and had the lowest average death rate. Spire of the Watcher top teams favor Star-Eater Scales Solar Hunter builds.'

    return NextResponse.json(
      await enrichBuildsResponse({
        verifiedBuilds,
        externalBuilds: MOCK_EXTERNAL_BUILDS,
        aiSummary,
        activity,
      })
    )
  })
}
