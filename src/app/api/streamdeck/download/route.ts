import { NextRequest, NextResponse } from 'next/server'
import {
  AuthError,
  createAuthErrorResponse,
  extractSessionToken,
  hasProAccess,
  verifyAuth,
} from '@/lib/auth/verifyAuth'
import { buildStreamDeckPlugin } from '@/lib/streamdeck/packagePlugin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function upgradePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stream Deck Pro · Stream Dreams Creator Corner</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#05070d;color:#e5e7eb;">
    <main style="max-width:36rem;margin:4rem auto;padding:0 1.25rem;">
      <h1 style="font-size:1.75rem;">Stream Deck Pro is included with Pro</h1>
      <p>Start the 7-day Pro trial, subscribe, or buy the lifetime pass, then download the plugin from this same link.</p>
      <p><a href="/pricing" style="color:#67e8f9;">View pricing</a></p>
    </main>
  </body>
</html>`
}

export async function GET(req: NextRequest) {
  if (!extractSessionToken(req)) {
    const back = '/api/streamdeck/download'
    return NextResponse.redirect(
      new URL(`/api/auth/kick/start?return=${encodeURIComponent(back)}`, req.url)
    )
  }

  try {
    const user = await verifyAuth(req)
    if (!hasProAccess(user)) {
      return new NextResponse(upgradePage(), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const built = buildStreamDeckPlugin('pro')
    return new NextResponse(new Uint8Array(built.bytes), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${built.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return createAuthErrorResponse(error)
    console.error('[streamdeck/download]', error)
    return NextResponse.json({ error: 'Could not build the Stream Deck plugin' }, { status: 500 })
  }
}
