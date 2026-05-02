import crypto from 'crypto'

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export function signSessionJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec: number
): string {
  const header = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64urlEncode(
    Buffer.from(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expiresInSec,
      })
    )
  )
  const sig = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  )
  return `${header}.${body}.${sig}`
}

export function verifySessionJwt(
  token: string,
  secret: string
): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, bodyB64, sig] = parts
  const expected = base64urlEncode(
    crypto.createHmac('sha256', secret).update(`${headerB64}.${bodyB64}`).digest()
  )
  if (expected !== sig) return null
  const padded = bodyB64.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const bodyJson = Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8')
  const payload = JSON.parse(bodyJson) as Record<string, unknown>
  const exp = payload.exp
  if (typeof exp === 'number' && Date.now() >= exp * 1000) return null
  return payload
}

export function getSessionSecret(): string | null {
  const s = process.env.SESSION_SECRET || process.env.JWT_SECRET
  return s && s.length > 0 ? s : null
}
