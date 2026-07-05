import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichOverview } from '@/lib/destiny/enrich'
import { getOverviewData } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const data = await getOverviewData()
    const enriched = await enrichOverview(data)
    return NextResponse.json(enriched)
  })
}
