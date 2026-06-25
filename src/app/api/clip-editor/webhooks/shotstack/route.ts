import { NextRequest, NextResponse } from 'next/server'
import { handleShotstackWebhook } from '@/lib/clip-editor/shotstackWebhook'

export const dynamic = 'force-dynamic'

/**
 * Shotstack render status webhook.
 * Configure in Shotstack dashboard to POST completed/failed events here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nested =
      body.response && typeof body.response === 'object'
        ? (body.response as Record<string, unknown>)
        : body

    const result = await handleShotstackWebhook({
      id:
        typeof nested.id === 'string'
          ? nested.id
          : typeof body.id === 'string'
            ? body.id
            : undefined,
      status:
        typeof nested.status === 'string'
          ? nested.status
          : typeof body.status === 'string'
            ? body.status
            : undefined,
      url:
        typeof nested.url === 'string'
          ? nested.url
          : typeof body.url === 'string'
            ? body.url
            : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
