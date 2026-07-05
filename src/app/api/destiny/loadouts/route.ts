import { NextRequest, NextResponse } from 'next/server'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import { MOCK_BUILD } from '@/lib/destiny/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    return NextResponse.json({
      current: MOCK_BUILD,
      saved: [MOCK_BUILD],
      favorites: [MOCK_BUILD],
      equipSupported: false,
      equipMessage:
        'Direct equip requires Bungie OAuth with inventory write scope. View and copy loadouts until OAuth is connected in Phase 2.',
    })
  })
}
