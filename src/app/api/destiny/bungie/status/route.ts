import { NextRequest, NextResponse } from 'next/server'
import { destinyAuthHandler } from '@/lib/destiny/apiHandler'
import { checkBungieApiHealth } from '@/lib/destiny/bungieClient'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyAuthHandler(req, async () => {
    const health = await checkBungieApiHealth()
    return NextResponse.json(health)
  })
}
