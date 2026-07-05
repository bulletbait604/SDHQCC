import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichProfile } from '@/lib/destiny/enrich'
import { getPlayerProfile } from '@/lib/destiny/store'
import { getDestinyUserBySiteUserId, storedUserToPlayerProfile } from '@/lib/destiny/destinyUserStore'
import { verifyAuth } from '@/lib/auth/verifyAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const authUser = await verifyAuth(req)
    const siteUserId = authUser.username.toLowerCase()
    const stored = await getDestinyUserBySiteUserId(siteUserId)
    const profile = stored
      ? storedUserToPlayerProfile(stored)
      : await getPlayerProfile(siteUserId)
    return NextResponse.json({ profile: await enrichProfile(profile), bungieLinked: Boolean(stored) })
  })
}
