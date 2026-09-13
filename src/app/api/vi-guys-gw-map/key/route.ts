import { NextRequest, NextResponse } from 'next/server'
import { AuthError, createAuthErrorResponse, verifyAuth } from '@/lib/auth/verifyAuth'
import { Gw2ApiError } from '@/lib/gw2/client'
import { gw2KeyEncryptionReady } from '@/lib/gw2/keyCrypto'
import { resolveGw2KeyForUser } from '@/lib/gw2/resolveKey'
import { Gw2KeyValidationError, inspectGw2ApiKey } from '@/lib/gw2/tracker'
import { deleteUserGw2Key, saveUserGw2Key } from '@/lib/gw2/userKeys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function encryptionUnavailable() {
  return NextResponse.json(
    {
      error: 'encryption_unavailable',
      userMessage: 'This server cannot store GW2 API keys until SESSION_SECRET (or GW2_KEY_SECRET) is set.',
    },
    { status: 503 }
  )
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    const resolved = await resolveGw2KeyForUser(user)
    return NextResponse.json({
      linkedKey: resolved.linkedKey,
      keySource: resolved.source,
      encryptionReady: gw2KeyEncryptionReady(),
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[vi-guys-gw-map/key GET]', err)
    return NextResponse.json({ error: 'Could not read GW2 key status' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!gw2KeyEncryptionReady()) return encryptionUnavailable()

    const body = (await req.json().catch(() => null)) as { apiKey?: unknown } | null
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : ''
    if (apiKey.length < 20 || apiKey.length > 200) {
      return NextResponse.json(
        {
          error: 'invalid_key',
          userMessage: 'Paste your ArenaNet API key from account.arena.net/applications.',
        },
        { status: 400 }
      )
    }

    const inspected = await inspectGw2ApiKey(apiKey)
    const linkedKey = await saveUserGw2Key(user, apiKey, inspected)
    return NextResponse.json({
      ok: true,
      linkedKey,
      keySource: 'user',
    })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    if (err instanceof Gw2KeyValidationError) {
      return NextResponse.json({ error: err.message, userMessage: err.message }, { status: 400 })
    }
    console.error('[vi-guys-gw-map/key PUT]', err)
    const message = err instanceof Error ? err.message : 'Could not save GW2 API key'
    const userMessage =
      err instanceof Gw2ApiError && (err.status === 401 || err.status === 403)
        ? 'GW2 rejected that API key. Copy a new one from ArenaNet with account, characters, and progression.'
        : message
    return NextResponse.json({ error: message, userMessage }, { status: 502 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    await deleteUserGw2Key(user)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof AuthError) return createAuthErrorResponse(err)
    console.error('[vi-guys-gw-map/key DELETE]', err)
    return NextResponse.json({ error: 'Could not disconnect GW2 API key' }, { status: 500 })
  }
}
