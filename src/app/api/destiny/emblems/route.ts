import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { fetchEquippedEmblem, fetchOwnedEmblems } from '@/lib/destiny/guardianEmblems'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const stored = await getDestinyUserBySiteUserId(authUser.username.toLowerCase())

    if (!stored?.oauth) {
      return NextResponse.json({ error: 'Link Bungie first' }, { status: 400 })
    }

    const [equipped, collection] = await Promise.all([
      fetchEquippedEmblem(stored, stored.activeCharacterId),
      fetchOwnedEmblems(stored),
    ])

    return NextResponse.json({
      equipped,
      collection,
      selectedSource: stored.displayEmblemSource ?? 'equipped',
      selectedHash: stored.displayEmblemHash ?? null,
    })
  })
}
