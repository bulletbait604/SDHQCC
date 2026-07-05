import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { enrichClan } from '@/lib/destiny/enrich'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { fetchLiveClan } from '@/lib/destiny/liveBungieData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const stored = await getDestinyUserBySiteUserId(authUser.username.toLowerCase())

    if (!stored?.oauth) {
      return NextResponse.json({
        clan: null,
        message: 'Connect Bungie on Overview to view your clan.',
      })
    }

    const clan = await fetchLiveClan(stored)
    if (!clan) {
      return NextResponse.json({
        clan: null,
        message: 'No clan found for your linked Bungie account.',
      })
    }

    return NextResponse.json({ clan: await enrichClan(clan) })
  })
}
