import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, verifyAuth } from '@/lib/auth/verifyAuth'
import { verifyOwnerUser } from '@/lib/auth/staffAccess'
import { isSiteOwner } from '@/lib/home/ownerIdentity'
import { allGrantableRndTabs, listRndGrants, readGrantedRndTabs, saveRndGrant } from '@/lib/home/rndGrants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (isSiteOwner(user.username)) {
      const grants = await listRndGrants()
      return NextResponse.json({ tabs: allGrantableRndTabs(), grants })
    }
    const tabs = await readGrantedRndTabs(user.username)
    return NextResponse.json({ tabs, grants: [{ username: user.username, tabs }] })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[rnd-grants GET]', err)
    return NextResponse.json({ error: 'Could not load R&D access' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    await verifyOwnerUser(req)
    const body = (await req.json().catch(() => null)) as { username?: unknown; tabs?: unknown } | null
    const username = typeof body?.username === 'string' ? body.username : ''
    const tabs = await saveRndGrant(username, body?.tabs)
    return NextResponse.json({ ok: true, username: username.replace(/^@/, '').toLowerCase().trim(), tabs })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    const message = err instanceof Error ? err.message : 'Could not save R&D access'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
