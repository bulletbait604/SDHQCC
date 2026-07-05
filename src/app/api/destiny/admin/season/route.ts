import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verifyAuth'
import { destinyStaffHandler } from '@/lib/destiny/apiHandler'
import {
  finalizeActiveSeason,
  getPendingPrizeClaims,
  getSeasonData,
  getSeasonStandingsInput,
  updatePrizeClaimStatus,
} from '@/lib/destiny/store'
import { computeSeasonStandings } from '@/lib/destiny/seasonPrizes'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    const season = await getSeasonData()
    const { runs, usersById } = await getSeasonStandingsInput()
    const { hallOfFame } = computeSeasonStandings(runs, usersById, season)
    const pendingClaims = await getPendingPrizeClaims()

    return NextResponse.json({
      season,
      hallOfFamePreview: hallOfFame.slice(0, 15),
      pendingClaims,
      canFinalize: season.status === 'active',
    })
  })
}

export async function POST(req: NextRequest) {
  return destinyStaffHandler(req, async () => {
    await verifyAuth(req)
    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      claimId?: string
      claimStatus?: 'fulfilled' | 'rejected'
      adminNotes?: string
    }

    if (body.action === 'finalize') {
      const season = await getSeasonData()
      if (season.status !== 'active') {
        return NextResponse.json({ error: 'No active season to finalize' }, { status: 400 })
      }
      const archived = await finalizeActiveSeason()
      return NextResponse.json({
        ok: true,
        message: 'Season finalized and winners locked.',
        season: archived,
      })
    }

    if (body.action === 'update_claim') {
      if (!body.claimId || !body.claimStatus) {
        return NextResponse.json({ error: 'claimId and claimStatus required' }, { status: 400 })
      }
      const ok = await updatePrizeClaimStatus(body.claimId, body.claimStatus, body.adminNotes)
      if (!ok) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, claimId: body.claimId, status: body.claimStatus })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  })
}
