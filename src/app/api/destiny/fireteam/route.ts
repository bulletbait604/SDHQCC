import { NextRequest, NextResponse } from 'next/server'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { enrichLobbies } from '@/lib/destiny/enrich'
import { getFireteamLobbies } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const lobbies = await enrichLobbies(await getFireteamLobbies())
    return NextResponse.json({ lobbies })
  })
}
