import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichBuildsResponse } from '@/lib/destiny/enrich'
import { getBuildIntelligenceCards, getExternalBuildSources } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const { searchParams } = new URL(req.url)
    const activity = searchParams.get('activity') ?? ''

    const [verifiedBuilds, externalBuilds] = await Promise.all([
      getBuildIntelligenceCards(),
      getExternalBuildSources(),
    ])

    const filtered = activity
      ? verifiedBuilds.filter((b) => b.activityName.toLowerCase().includes(activity.toLowerCase()))
      : verifiedBuilds

    const aiSummary =
      filtered.length > 0
        ? `Showing ${filtered.length} build(s) from verified Top Nest run data.`
        : 'No build intelligence yet. Sync verified runs from Overview — builds are derived from PGCR data as Phase 4 rolls out.'

    return NextResponse.json(
      await enrichBuildsResponse({
        verifiedBuilds: filtered,
        externalBuilds,
        aiSummary,
        activity: activity || 'all',
      })
    )
  })
}
