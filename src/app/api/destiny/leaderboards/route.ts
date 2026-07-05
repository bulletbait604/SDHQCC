import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { getLeaderboardEntries } from '@/lib/destiny/store'
import type { LeaderboardCategory, LeaderboardPeriod } from '@/lib/destiny/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const { searchParams } = new URL(req.url)
    const category = (searchParams.get('category') || 'raid') as LeaderboardCategory
    const period = (searchParams.get('period') || 'season') as LeaderboardPeriod
    const entries = await getLeaderboardEntries(category, period)
    return NextResponse.json({ entries, category, period })
  })
}
