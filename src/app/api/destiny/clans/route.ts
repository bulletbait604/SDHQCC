import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { enrichClan } from '@/lib/destiny/enrich'
import { MOCK_CLAN } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    return NextResponse.json({ clan: await enrichClan(MOCK_CLAN) })
  })
}
