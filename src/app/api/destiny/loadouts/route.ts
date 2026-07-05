import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { getDestinyUserBySiteUserId } from '@/lib/destiny/destinyUserStore'
import { enrichLoadoutsResponse } from '@/lib/destiny/enrich'
import { fetchLiveLoadout } from '@/lib/destiny/liveBungieData'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const stored = await getDestinyUserBySiteUserId(authUser.username.toLowerCase())

    if (!stored?.oauth) {
      return NextResponse.json({
        current: null,
        saved: [],
        favorites: [],
        equipSupported: false,
        equipMessage: 'Connect Bungie on Overview to view your live loadout.',
        linked: false,
      })
    }

    const current = await fetchLiveLoadout(stored)
    if (!current) {
      return NextResponse.json({
        current: null,
        saved: [],
        favorites: [],
        equipSupported: false,
        equipMessage:
          'Could not load equipment from Bungie. Try reconnecting your account or check OAuth scopes.',
        linked: true,
      })
    }

    return NextResponse.json(
      await enrichLoadoutsResponse({
        current,
        saved: [],
        favorites: [],
        equipSupported: false,
        equipMessage:
          'Direct equip requires Bungie OAuth with MoveEquipDestinyItems scope. View and copy loadouts for now.',
      })
    )
  })
}
