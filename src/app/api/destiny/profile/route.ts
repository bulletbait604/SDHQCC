import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { getPlayerProfile } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') ?? undefined
    const profile = await getPlayerProfile(userId)
    return NextResponse.json({ profile })
  })
}
