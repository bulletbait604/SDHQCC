import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { checkBungieApiHealth } from '@/lib/destiny/bungieClient'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const health = await checkBungieApiHealth()
    return NextResponse.json(health)
  })
}
